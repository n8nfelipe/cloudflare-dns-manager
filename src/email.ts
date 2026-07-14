import { Command } from 'commander'
import {
  getZoneByName,
  getEmailRouting,
  enableEmailRouting,
  listEmailRules,
  createEmailRule,
  deleteEmailRule,
  getAccountIdByZone,
  listDestinationAddresses,
  createDestinationAddress,
} from './client.js'
import { confirmAction } from './utils.js'

function printRulesTable(rules: Array<{ id: string; name: string; enabled: boolean; from: string; to: string[] }>): void {
  const header = `${'ID'.padEnd(36)} ${'Enabled'.padEnd(8)} ${'From'.padEnd(35)} ${'To'}`
  console.log(header)
  console.log('-'.repeat(header.length))
  for (const r of rules) {
    console.log(`${r.id.padEnd(36)} ${(r.enabled ? 'Yes' : 'No').padEnd(8)} ${r.from.padEnd(35)} ${r.to.join(', ')}`)
  }
}

export function createEmailCommand(): Command {
  const email = new Command('email')
    .description('Manage Cloudflare Email Routing (free email forwarding)')

  email
    .command('status')
    .description('Show Email Routing status for a domain')
    .requiredOption('-d, --domain <domain>', 'Domain name')
    .action(async (options) => {
      try {
        const zone = await getZoneByName(options.domain)
        if (!zone) {
          throw new Error(`Domain '${options.domain}' not found in your Cloudflare account.`)
        }
        const settings = await getEmailRouting(zone.id)
        console.log(`Email Routing for ${zone.name}:`)
        console.log(`  Enabled: ${settings.enabled ? 'Yes' : 'No'}`)
        if (settings.status) console.log(`  Status:  ${settings.status}`)
      } catch (err: any) {
        console.error('Error getting Email Routing status:', err.message)
        throw err
      }
    })

  email
    .command('enable')
    .description('Enable Email Routing (creates required MX/TXT records)')
    .requiredOption('-d, --domain <domain>', 'Domain name')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        const zone = await getZoneByName(options.domain)
        if (!zone) {
          throw new Error(`Domain '${options.domain}' not found.`)
        }
        console.log(`This will enable Email Routing for ${zone.name} and add the required MX/SPF records.`)
        if (!options.yes) {
          const ok = await confirmAction('\nEnable Email Routing?')
          if (!ok) {
            console.log('Cancelled.')
            return
          }
        }
        const settings = await enableEmailRouting(zone.id)
        console.log(`\nEmail Routing enabled: ${settings.enabled ? 'Yes' : 'No'}`)
      } catch (err: any) {
        console.error('Error enabling Email Routing:', err.message)
        throw err
      }
    })

  const rules = new Command('rules')
    .description('Manage Email Routing forwarding rules')

  rules
    .command('list')
    .description('List forwarding rules for a domain')
    .requiredOption('-d, --domain <domain>', 'Domain name')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const zone = await getZoneByName(options.domain)
        if (!zone) {
          throw new Error(`Domain '${options.domain}' not found.`)
        }
        const list = await listEmailRules(zone.id)
        if (list.length === 0) {
          console.log('No forwarding rules found.')
          return
        }
        if (options.json) {
          console.log(JSON.stringify(list, null, 2))
          return
        }
        printRulesTable(list)
      } catch (err: any) {
        console.error('Error listing rules:', err.message)
        throw err
      }
    })

  rules
    .command('add')
    .description('Add a forwarding rule (e.g., contato@dominio -> seu@gmail.com)')
    .requiredOption('-d, --domain <domain>', 'Domain name')
    .requiredOption('-f, --from <address>', 'Source address at your domain (e.g., contato@dominio.com)')
    .requiredOption('-t, --to <address>', 'Destination address to forward to')
    .option('-n, --name <name>', 'Optional rule name')
    .option('--dry-run', 'Show what would be created without applying')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        const zone = await getZoneByName(options.domain)
        if (!zone) {
          throw new Error(`Domain '${options.domain}' not found.`)
        }
        console.log('Forwarding rule to create:')
        console.log(`  Domain: ${zone.name}`)
        console.log(`  From:   ${options.from}`)
        console.log(`  To:     ${options.to}`)

        if (options.dryRun) {
          console.log('\nDry-run mode. No changes applied.')
          return
        }
        if (!options.yes) {
          const ok = await confirmAction('\nCreate this rule?')
          if (!ok) {
            console.log('Cancelled.')
            return
          }
        }
        const rule = await createEmailRule({
          zone_id: zone.id,
          from: options.from,
          to: options.to,
          name: options.name,
        })
        console.log(`\nRule created: ${rule.id}`)
        console.log('Note: the destination address must be verified for forwarding to work.')
      } catch (err: any) {
        console.error('Error creating rule:', err.message)
        throw err
      }
    })

  rules
    .command('delete')
    .description('Delete a forwarding rule')
    .requiredOption('-d, --domain <domain>', 'Domain name')
    .requiredOption('-i, --id <id>', 'Rule ID to delete')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        const zone = await getZoneByName(options.domain)
        if (!zone) {
          throw new Error(`Domain '${options.domain}' not found.`)
        }
        console.log(`Rule to delete: ${options.id} (${zone.name})`)
        if (!options.yes) {
          const ok = await confirmAction('\nDelete this rule?')
          if (!ok) {
            console.log('Cancelled.')
            return
          }
        }
        await deleteEmailRule({ zone_id: zone.id, ruleId: options.id })
        console.log('\nRule deleted.')
      } catch (err: any) {
        console.error('Error deleting rule:', err.message)
        throw err
      }
    })

  email.addCommand(rules)

  const address = new Command('address')
    .description('Manage destination addresses (where emails are forwarded)')

  address
    .command('list')
    .description('List destination addresses for the account owning a domain')
    .requiredOption('-d, --domain <domain>', 'Domain name (used to resolve the account)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const accountId = await getAccountIdByZone(options.domain)
        if (!accountId) {
          throw new Error(`Could not resolve account for domain '${options.domain}'.`)
        }
        const addresses = await listDestinationAddresses(accountId)
        if (addresses.length === 0) {
          console.log('No destination addresses found.')
          return
        }
        if (options.json) {
          console.log(JSON.stringify(addresses, null, 2))
          return
        }
        for (const a of addresses) {
          console.log(`${a.email.padEnd(40)} ${a.verified ? 'verified' : 'pending'} (${a.id})`)
        }
      } catch (err: any) {
        console.error('Error listing destination addresses:', err.message)
        throw err
      }
    })

  address
    .command('add')
    .description('Add a destination address (sends a verification email)')
    .requiredOption('-d, --domain <domain>', 'Domain name (used to resolve the account)')
    .requiredOption('-e, --email <address>', 'Destination email address')
    .action(async (options) => {
      try {
        const accountId = await getAccountIdByZone(options.domain)
        if (!accountId) {
          throw new Error(`Could not resolve account for domain '${options.domain}'.`)
        }
        const address = await createDestinationAddress({ account_id: accountId, email: options.email })
        console.log(`Destination address added: ${address.email}`)
        console.log('Check your inbox and confirm the verification email from Cloudflare.')
      } catch (err: any) {
        console.error('Error adding destination address:', err.message)
        throw err
      }
    })

  email.addCommand(address)

  return email
}
