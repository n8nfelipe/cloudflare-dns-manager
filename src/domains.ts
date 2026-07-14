import { Command } from 'commander'
import { listZones } from './client.js'

export function createDomainCommand(): Command {
  const domain = new Command('domains')
    .description('Manage Cloudflare domains/zones')

  domain
    .command('list')
    .description('List all domains in your Cloudflare account')
    .option('-p, --page <number>', 'Page number', '1')
    .option('--per-page <number>', 'Results per page', '50')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const domains = await listZones({
          page: parseInt(options.page),
          per_page: parseInt(options.perPage),
        })

        if (domains.length === 0) {
          console.log('No domains found.')
          return
        }

        if (options.json) {
          console.log(JSON.stringify(domains, null, 2))
          return
        }

        const header = `${'ID'.padEnd(36)} ${'Domain'.padEnd(40)} ${'Status'.padEnd(12)} ${'Plan'.padEnd(12)} ${'Paused'}`
        const separator = '-'.repeat(header.length)
        console.log(header)
        console.log(separator)

        for (const d of domains) {
          console.log(
            `${d.id.padEnd(36)} ${d.name.padEnd(40)} ${d.status.padEnd(12)} ${d.plan.padEnd(12)} ${d.paused ? 'Yes' : 'No'}`
          )
        }
      } catch (err: any) {
        console.error('Error listing domains:', err.message)
        throw err
      }
    })

  return domain
}
