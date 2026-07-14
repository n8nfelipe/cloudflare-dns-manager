#!/usr/bin/env node
import { Command } from 'commander'
import { createDomainCommand } from './domains.js'
import { createRecordCommand } from './records.js'
import { createTemplateCommand } from './templates-cli.js'
import { createBatchCommand } from './batch.js'
import { createEmailCommand } from './email.js'
import { getToken, setToken, clearToken, validateToken } from './auth.js'
import { validateTokenOnline } from './client.js'

const program = new Command()

program
  .name('cloudflare-dns')
  .description('CLI tool for managing Cloudflare domains and DNS records')
  .version('1.0.0')

const auth = new Command('auth')
  .description('Manage API authentication')

auth
  .command('set')
  .description('Set Cloudflare API token')
  .argument('<token>', 'Cloudflare API token')
  .action(async (token: string) => {
    const validation = validateToken(token)
    if (!validation.valid) {
      console.error('Invalid token:', validation.error)
      process.exit(1)
    }

    const online = await validateTokenOnline(token)
    if (!online.valid) {
      console.error('Token verification failed:', online.error)
      process.exit(1)
    }

    setToken(token)
    console.log('API token configured successfully.')
  })

auth
  .command('status')
  .description('Show current authentication status')
  .action(() => {
    const token = getToken()
    if (token) {
      const masked = token.slice(0, 8) + '...' + token.slice(-4)
      console.log(`Token: ${masked}`)
    } else {
      console.log('No API token configured.')
      console.log('Set one with: cloudflare-dns auth set <token>')
      console.log('Or use: CLOUDFLARE_API_TOKEN env variable')
    }
  })

auth
  .command('clear')
  .description('Clear stored API token')
  .action(() => {
    clearToken()
    console.log('API token cleared.')
  })

program.addCommand(auth)
program.addCommand(createDomainCommand())
program.addCommand(createRecordCommand())
program.addCommand(createTemplateCommand())
program.addCommand(createBatchCommand())
program.addCommand(createEmailCommand())

program.parse(process.argv)
