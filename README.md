# Cloudflare DNS Manager

CLI tool for managing Cloudflare domains and DNS records.

## Installation

```bash
git clone <repo-url>
cd cloudflare-dns-manager
pnpm install
pnpm build
```

Or run directly:

```bash
pnpm start --help
```

## Authentication

```bash
# Set API token (stored in config file)
pnpm start auth set <your-cloudflare-api-token>

# Or use environment variable
export CLOUDFLARE_API_TOKEN=<your-token>

# Check status
pnpm start auth status

# Clear token
pnpm start auth clear
```

## Usage

### Domains

```bash
# List all domains
pnpm start domains list

# List domains as JSON
pnpm start domains list --json
```

### DNS Records

```bash
# List records for a domain
pnpm start records list -d example.com

# Filter by type
pnpm start records list -d example.com -t A

# Add a new record (with confirmation prompt)
pnpm start records add -d example.com -t A -n www -c 192.0.2.1

# Add without confirmation
pnpm start records add -d example.com -t CNAME -n api -c target.example.com. --yes

# Dry-run (see what would be created)
pnpm start records add -d example.com -t A -n @ -c 192.0.2.1 --dry-run

# Edit a record
pnpm start records edit -d example.com -i <record-id> -c 10.0.0.1

# Delete a record
pnpm start records delete -d example.com -i <record-id>
```

### Email Routing

Configure free email forwarding (e.g., `contato@example.com` -> your Gmail) using
Cloudflare Email Routing.

```bash
# Check Email Routing status
pnpm start email status -d example.com

# Enable Email Routing (creates the required MX/SPF records automatically)
pnpm start email enable -d example.com

# Add a destination address (sends a verification email — confirm it first)
pnpm start email address add -d example.com -e you@gmail.com

# List destination addresses
pnpm start email address list -d example.com

# Add a forwarding rule: contato@example.com -> you@gmail.com
pnpm start email rules add -d example.com -f contato@example.com -t you@gmail.com

# List forwarding rules
pnpm start email rules list -d example.com

# Delete a forwarding rule
pnpm start email rules delete -d example.com -i <rule-id>
```

Order matters: `enable` first, verify the destination address, then add rules.
Forwarding only works once the destination address is verified.

### Templates

```bash
# List existing templates
pnpm start template list

# Apply a template to a domain
pnpm start template apply -f templates/basic-static-site.yaml -d example.com

# Export existing records as a template
pnpm start template export -d example.com -n my-site
```

### Batch Operations

```bash
# Create a file with domains (one per line)
echo "example.com" > domains.txt
echo "test.org" >> domains.txt

# Apply a template to all domains in the file
pnpm start batch apply -f templates/basic-static-site.yaml --domains-file domains.txt
```

### Audit Log

All operations are logged to `audit/dns-audit.log`:

```
[2026-07-10T21:00:00.000Z] | create | example.com | rec-123 | "Created A record www.example.com -> 192.0.2.1" | cli
```

## Development

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch

# Build
pnpm build
```

## Project Structure

```
src/
  index.ts        # CLI entry point
  auth.ts         # Authentication (API token)
  client.ts       # Cloudflare API client
  domains.ts      # Domain list command
  records.ts       # DNS record CRUD commands
  email.ts         # Email Routing commands (forwarding)
  template.ts     # Template engine (YAML)
  templates-cli.ts# Template CLI commands
  batch.ts        # Batch operations
  audit.ts        # Audit logging
  types.ts        # TypeScript types
  utils.ts        # Shared utilities
tests/            # Vitest test suite
templates/        # Example DNS templates
```
