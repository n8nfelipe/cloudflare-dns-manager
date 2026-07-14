import { Command } from 'commander'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseTemplateFile, saveTemplateFile, listTemplateFiles, resolveRecordName, ensureTemplatesDir } from './template.js'
import { getZoneByName, createRecord, validateRecordInput } from './client.js'
import { logAudit } from './audit.js'
import { DnsTemplate, TemplateRecord } from './types.js'
import { confirmAction } from './utils.js'

export function createTemplateCommand(): Command {
  const tmpl = new Command('template')
    .description('Manage DNS record templates')

  tmpl
    .command('apply')
    .description('Apply a template to a domain')
    .requiredOption('-f, --file <path>', 'Template YAML file path')
    .requiredOption('-d, --domain <domain>', 'Domain to apply the template to')
    .option('--dry-run', 'Show what would be created without applying')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        const template = parseTemplateFile(options.file)
        const zone = await getZoneByName(options.domain)
        if (!zone) {
          throw new Error(`Domain '${options.domain}' not found.`)
        }

        console.log(`Template: ${template.name}`)
        if (template.description) console.log(`Description: ${template.description}`)
        console.log(`Domain: ${zone.name}`)
        console.log(`Records to create: ${template.records.length}\n`)

        const resolvedRecords = template.records.map((rec) => ({
          ...rec,
          name: resolveRecordName(rec.name, zone.name),
        }))

        for (const rec of resolvedRecords) {
          console.log(`  ${rec.type.padEnd(8)} ${rec.name.padEnd(50)} ${rec.content}`)
        }

        if (options.dryRun) {
          console.log('\nDry-run mode. No changes applied.')
          return
        }

        if (!options.yes) {
          const ok = await confirmAction('\nApply this template?')
          if (!ok) {
            console.log('Cancelled.')
            return
          }
        }

        let created = 0
        let errors = 0

        for (const rec of resolvedRecords) {
          try {
            const result = await createRecord({
              zone_id: zone.id,
              type: rec.type,
              name: rec.name,
              content: rec.content,
              ttl: rec.ttl ?? 1,
              proxied: rec.proxied ?? false,
            })
            created++
            logAudit(process.cwd(), {
              operation: 'template_apply',
              domain: zone.name,
              recordId: result.id,
              details: `Template "${template.name}": created ${rec.type} ${rec.name} -> ${rec.content}`,
            })
          } catch (err: any) {
            console.error(`  Error creating ${rec.type} ${rec.name}: ${err.message}`)
            errors++
          }
        }

        console.log(`\nDone. ${created} records created, ${errors} errors.`)
      } catch (err: any) {
        console.error('Error applying template:', err.message)
        throw err
      }
    })

  tmpl
    .command('list')
    .description('List available templates')
    .action(() => {
      const files = listTemplateFiles(process.cwd())
      if (files.length === 0) {
        console.log('No templates found. Create one in ./templates/ directory.')
        return
      }
      console.log('Available templates:')
      for (const f of files) {
        try {
          const tmpl = parseTemplateFile(join(process.cwd(), 'templates', f))
          console.log(`  ${f} - ${tmpl.name}${tmpl.description ? `: ${tmpl.description}` : ''} (${tmpl.records.length} records)`)
        } catch {
          console.log(`  ${f} - (invalid or unparseable)`)
        }
      }
    })

  tmpl
    .command('export')
    .description('Export existing DNS records as a template')
    .requiredOption('-d, --domain <domain>', 'Domain to export records from')
    .option('-n, --name <name>', 'Template name', 'exported-template')
    .option('-o, --output <path>', 'Output file path')
    .option('--description <desc>', 'Template description')
    .action(async (options) => {
      try {
        const zone = await getZoneByName(options.domain)
        if (!zone) {
          throw new Error(`Domain '${options.domain}' not found.`)
        }

        const { listRecords } = await import('./client.js')
        const records = await listRecords({ zone_id: zone.id })

        const templateRecords: TemplateRecord[] = records.map((r) => ({
          type: r.type,
          name: r.name,
          content: r.content,
          ttl: r.ttl,
          proxied: r.proxied,
        }))

        const template: DnsTemplate = {
          name: options.name,
          description: options.description,
          records: templateRecords,
        }

        if (options.output) {
          saveTemplateFile(template, options.output)
          console.log(`Template saved to: ${resolve(options.output)}`)
        } else {
          const dir = ensureTemplatesDir(process.cwd())
          const filePath = join(dir, `${options.name.replace(/\s+/g, '-').toLowerCase()}.yaml`)
          saveTemplateFile(template, filePath)
          console.log(`Template saved to: ${filePath}`)
        }
      } catch (err: any) {
        console.error('Error exporting template:', err.message)
        throw err
      }
    })

  return tmpl
}
