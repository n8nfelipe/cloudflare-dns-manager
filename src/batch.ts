import { Command } from 'commander'
import { readDomainsFile, confirmAction } from './utils.js'
import { getZoneByName, createRecord, validateRecordInput } from './client.js'
import { logAudit } from './audit.js'
import { parseTemplateFile, resolveRecordName } from './template.js'

export function createBatchCommand(): Command {
  const batch = new Command('batch')
    .description('Batch operations across multiple domains')

  batch
    .command('apply')
    .description('Apply a template to multiple domains')
    .requiredOption('-f, --file <path>', 'Template YAML file path')
    .requiredOption('--domains-file <path>', 'File containing domain names (one per line)')
    .option('--dry-run', 'Show what would be done without applying')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        const template = parseTemplateFile(options.file)
        const domainNames = readDomainsFile(options.domainsFile)

        console.log(`Template: ${template.name}`)
        console.log(`Domains (${domainNames.length}): ${domainNames.join(', ')}`)
        console.log(`Records per domain: ${template.records.length}`)
        console.log(`Total operations: ${domainNames.length * template.records.length}\n`)

        if (options.dryRun) {
          console.log('Dry-run mode. No changes applied.')
          return
        }

        if (!options.yes) {
          const ok = await confirmAction('\nApply to all domains?')
          if (!ok) {
            console.log('Cancelled.')
            return
          }
        }

        let totalCreated = 0
        let totalErrors = 0
        const failedDomains: string[] = []

        for (const domainName of domainNames) {
          console.log(`\n--- ${domainName} ---`)
          const zone = await getZoneByName(domainName)
          if (!zone) {
            console.error(`  Domain not found in Cloudflare account. Skipping.`)
            failedDomains.push(domainName)
            totalErrors += template.records.length
            continue
          }

          for (const rec of template.records) {
            try {
              const fullName = resolveRecordName(rec.name, zone.name)
              const result = await createRecord({
                zone_id: zone.id,
                type: rec.type,
                name: fullName,
                content: rec.content,
                ttl: rec.ttl ?? 1,
                proxied: rec.proxied ?? false,
              })
              totalCreated++
              logAudit(process.cwd(), {
                operation: 'batch',
                domain: zone.name,
                recordId: result.id,
                details: `Batch "${template.name}": created ${rec.type} ${fullName} -> ${rec.content}`,
              })
              console.log(`  Created: ${rec.type} ${fullName}`)
            } catch (err: any) {
              console.error(`  Error: ${rec.type} ${rec.name}: ${err.message}`)
              totalErrors++
            }
          }
        }

        console.log(`\nDone. ${totalCreated} created, ${totalErrors} errors across ${domainNames.length} domains.`)
        if (failedDomains.length > 0) {
          console.log(`Failed domains: ${failedDomains.join(', ')}`)
        }
      } catch (err: any) {
        console.error('Error in batch operation:', err.message)
        throw err
      }
    })

  return batch
}
