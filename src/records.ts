import { Command } from 'commander'
import {
  listRecords,
  getZoneByName,
  createRecord,
  updateRecord,
  deleteRecord,
  getRecordById,
  validateRecordInput,
} from './client.js'
import { confirmAction } from './utils.js'

function printTable(records: Array<{ id: string; type: string; name: string; content: string; ttl: number; proxied: boolean }>): void {
  const header = `${'ID'.padEnd(36)} ${'Type'.padEnd(8)} ${'Name'.padEnd(40)} ${'Content'.padEnd(45)} ${'TTL'.padEnd(6)} ${'Proxy'}`
  const separator = '-'.repeat(header.length)
  console.log(header)
  console.log(separator)
  for (const r of records) {
    console.log(
      `${r.id.padEnd(36)} ${r.type.padEnd(8)} ${r.name.padEnd(40)} ${r.content.padEnd(45)} ${String(r.ttl).padEnd(6)} ${r.proxied ? 'Yes' : 'No'}`
    )
  }
}

export function createRecordCommand(): Command {
  const records = new Command('records')
    .description('Manage DNS records')

  records
    .command('list')
    .description('List DNS records for a domain')
    .requiredOption('-d, --domain <domain>', 'Domain name')
    .option('-t, --type <type>', 'Filter by record type (A, AAAA, CNAME, MX, TXT)')
    .option('--page <number>', 'Page number', '1')
    .option('--per-page <number>', 'Results per page', '50')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const zone = await getZoneByName(options.domain)
        if (!zone) {
          throw new Error(`Domain '${options.domain}' not found in your Cloudflare account.`)
        }

        const records = await listRecords({
          zone_id: zone.id,
          page: parseInt(options.page),
          per_page: parseInt(options.perPage),
          type: options.type,
        })

        if (records.length === 0) {
          console.log('No DNS records found.')
          return
        }

        if (options.json) {
          console.log(JSON.stringify(records, null, 2))
          return
        }

        printTable(records)
      } catch (err: any) {
        console.error('Error listing records:', err.message)
        throw err
      }
    })

  records
    .command('add')
    .description('Add a new DNS record')
    .requiredOption('-d, --domain <domain>', 'Domain name')
    .requiredOption('-t, --type <type>', 'Record type (A, AAAA, CNAME, MX, TXT)')
    .requiredOption('-n, --name <name>', 'Record name (e.g., www, @ for root)')
    .requiredOption('-c, --content <content>', 'Record content/value')
    .option('--ttl <number>', 'TTL in seconds (1 = auto)', '1')
    .option('--proxied', 'Enable Cloudflare proxy (orange cloud)')
    .option('--dry-run', 'Show what would be created without applying')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        const zone = await getZoneByName(options.domain)
        if (!zone) {
          throw new Error(`Domain '${options.domain}' not found.`)
        }

        const recordName = options.name === '@' ? zone.name : `${options.name}.${zone.name}`

        const validation = validateRecordInput(options.type, options.content)
        if (!validation.valid) {
          throw new Error(`Validation error: ${validation.error}`)
        }

        const ttl = parseInt(options.ttl)
        const proxied = options.proxied ?? false

        console.log('DNS Record to create:')
        console.log(`  Domain:  ${zone.name}`)
        console.log(`  Type:    ${options.type.toUpperCase()}`)
        console.log(`  Name:    ${recordName}`)
        console.log(`  Content: ${options.content}`)
        console.log(`  TTL:     ${ttl === 1 ? 'auto' : `${ttl}s`}`)
        console.log(`  Proxy:   ${proxied ? 'Yes' : 'No'}`)

        if (options.dryRun) {
          console.log('\nDry-run mode. No changes applied.')
          return
        }

        if (!options.yes) {
          const ok = await confirmAction('\nApply this change?')
          if (!ok) {
            console.log('Cancelled.')
            return
          }
        }

        const result = await createRecord({
          zone_id: zone.id,
          type: options.type.toUpperCase(),
          name: recordName,
          content: options.content,
          ttl,
          proxied,
        })
        console.log(`\nRecord created: ${result.id}`)
      } catch (err: any) {
        console.error('Error creating record:', err.message)
        throw err
      }
    })

  records
    .command('edit')
    .description('Edit an existing DNS record')
    .requiredOption('-d, --domain <domain>', 'Domain name')
    .requiredOption('-i, --id <id>', 'Record ID to edit')
    .option('-t, --type <type>', 'New record type')
    .option('-n, --name <name>', 'New record name')
    .option('-c, --content <content>', 'New record content/value')
    .option('--ttl <number>', 'New TTL in seconds')
    .option('--proxied', 'Enable Cloudflare proxy')
    .option('--no-proxied', 'Disable Cloudflare proxy')
    .option('--dry-run', 'Show what would be changed without applying')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        const zone = await getZoneByName(options.domain)
        if (!zone) {
          throw new Error(`Domain '${options.domain}' not found.`)
        }

        const existing = await getRecordById({ zone_id: zone.id, recordId: options.id })
        if (!existing) {
          throw new Error(`Record '${options.id}' not found in domain '${options.domain}'.`)
        }

        const newType = (options.type || existing.type).toUpperCase()
        const newName = options.name
          ? (options.name === '@' ? zone.name : `${options.name}.${zone.name}`)
          : existing.name
        const newContent = options.content || existing.content
        const newTtl = options.ttl !== undefined ? parseInt(options.ttl) : existing.ttl
        const newProxied = options.proxied !== undefined ? options.proxied : existing.proxied

        if (options.content) {
          const validation = validateRecordInput(newType, options.content)
          if (!validation.valid) {
            throw new Error(`Validation error: ${validation.error}`)
          }
        }

        console.log('Changes:')
        if (existing.type !== newType) console.log(`  Type:    ${existing.type} -> ${newType}`)
        if (existing.name !== newName) console.log(`  Name:    ${existing.name} -> ${newName}`)
        if (existing.content !== newContent) console.log(`  Content: ${existing.content} -> ${newContent}`)
        if (existing.ttl !== newTtl) console.log(`  TTL:     ${existing.ttl} -> ${newTtl}`)
        if (existing.proxied !== newProxied) console.log(`  Proxy:   ${existing.proxied} -> ${newProxied}`)

        if (!options.content && !options.type && !options.name && options.ttl === undefined && options.proxied === undefined) {
          console.log('  No changes specified.')
          return
        }

        if (options.dryRun) {
          console.log('\nDry-run mode. No changes applied.')
          return
        }

        if (!options.yes) {
          const ok = await confirmAction('\nApply this change?')
          if (!ok) {
            console.log('Cancelled.')
            return
          }
        }

        const result = await updateRecord({
          zone_id: zone.id,
          recordId: options.id,
          type: newType,
          name: newName,
          content: newContent,
          ttl: newTtl,
          proxied: newProxied,
        })
        console.log(`\nRecord updated: ${result.id}`)
      } catch (err: any) {
        console.error('Error updating record:', err.message)
        throw err
      }
    })

  records
    .command('delete')
    .description('Delete a DNS record')
    .requiredOption('-d, --domain <domain>', 'Domain name')
    .requiredOption('-i, --id <id>', 'Record ID to delete')
    .option('--dry-run', 'Show what would be deleted without applying')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        const zone = await getZoneByName(options.domain)
        if (!zone) {
          throw new Error(`Domain '${options.domain}' not found.`)
        }

        const existing = await getRecordById({ zone_id: zone.id, recordId: options.id })
        if (!existing) {
          throw new Error(`Record '${options.id}' not found in domain '${options.domain}'.`)
        }

        console.log('DNS Record to delete:')
        console.log(`  ID:      ${existing.id}`)
        console.log(`  Type:    ${existing.type}`)
        console.log(`  Name:    ${existing.name}`)
        console.log(`  Content: ${existing.content}`)

        if (options.dryRun) {
          console.log('\nDry-run mode. No changes applied.')
          return
        }

        if (!options.yes) {
          const ok = await confirmAction('\nDelete this record?')
          if (!ok) {
            console.log('Cancelled.')
            return
          }
        }

        await deleteRecord({ zone_id: zone.id, recordId: options.id })
        console.log('\nRecord deleted.')
      } catch (err: any) {
        console.error('Error deleting record:', err.message)
        throw err
      }
    })

  return records
}
