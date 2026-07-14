import Cloudflare from 'cloudflare'
import { Domain, DnsRecord } from './types.js'
import { getToken } from './auth.js'

let client: Cloudflare | null = null

function getClient(): Cloudflare {
  if (!client) {
    const token = getToken()
    if (!token) {
      throw new Error('No API token configured. Set CLOUDFLARE_API_TOKEN env var or run `cloudflare-dns auth set <token>`.')
    }
    client = new Cloudflare({ apiToken: token })
  }
  return client
}

export function resetClient(): void {
  client = null
}

export interface ListZonesParams {
  page?: number
  per_page?: number
}

export async function listZones(params: ListZonesParams = {}): Promise<Domain[]> {
  const cf = getClient()
  const response = await cf.zones.list({
    page: params.page ?? 1,
    per_page: params.per_page ?? 50,
  })

  return response.result.map((zone) => ({
    id: zone.id,
    name: zone.name,
    status: zone.status as Domain['status'],
    plan: (zone.plan as any)?.name ?? 'Free',
    paused: zone.paused ?? false,
    createdOn: zone.created_on,
    modifiedOn: zone.modified_on,
  }))
}

export interface ListRecordsParams {
  zone_id: string
  page?: number
  per_page?: number
  type?: string
}

export async function listRecords(params: ListRecordsParams): Promise<DnsRecord[]> {
  const cf = getClient()
  const response = await cf.dns.records.list({
    zone_id: params.zone_id,
    page: params.page ?? 1,
    per_page: params.per_page ?? 50,
    type: params.type as any,
  })

  return response.result.map((record) => ({
    id: record.id,
    name: record.name,
    type: record.type as DnsRecord['type'],
    content: record.content ?? '',
    proxied: record.proxied ?? false,
    ttl: record.ttl ?? 1,
    zoneId: (record as any).zone_id ?? '',
    zoneName: (record as any).zone_name ?? '',
    createdOn: record.created_on,
    modifiedOn: record.modified_on,
  }))
}

export async function createRecord(params: {
  zone_id: string
  type: string
  name: string
  content: string
  ttl?: number
  proxied?: boolean
}): Promise<DnsRecord> {
  const cf = getClient()
  const body: any = {
    zone_id: params.zone_id,
    type: params.type,
    name: params.name,
    content: params.content,
    ttl: params.ttl ?? 1,
    proxied: params.proxied ?? false,
  }
  const response = await cf.dns.records.create(body)
  const r = response
  return {
    id: r.id,
    name: r.name,
    type: r.type as DnsRecord['type'],
    content: r.content ?? '',
    proxied: r.proxied ?? false,
    ttl: r.ttl ?? 1,
    zoneId: (r as any).zone_id ?? params.zone_id,
    zoneName: (r as any).zone_name ?? '',
    createdOn: r.created_on,
    modifiedOn: r.modified_on,
  }
}

export async function updateRecord(params: {
  zone_id: string
  recordId: string
  type: string
  name: string
  content: string
  ttl?: number
  proxied?: boolean
}): Promise<DnsRecord> {
  const cf = getClient()
  const body: any = {
    zone_id: params.zone_id,
    type: params.type,
    name: params.name,
    content: params.content,
    ttl: params.ttl ?? 1,
    proxied: params.proxied ?? false,
  }
  const response = await cf.dns.records.update(params.recordId, body)
  const r = response
  return {
    id: r.id,
    name: r.name,
    type: r.type as DnsRecord['type'],
    content: r.content ?? '',
    proxied: r.proxied ?? false,
    ttl: r.ttl ?? 1,
    zoneId: (r as any).zone_id ?? params.zone_id,
    zoneName: (r as any).zone_name ?? '',
    createdOn: r.created_on,
    modifiedOn: r.modified_on,
  }
}

export async function deleteRecord(params: {
  zone_id: string
  recordId: string
}): Promise<void> {
  const cf = getClient()
  await cf.dns.records.delete(params.recordId, { zone_id: params.zone_id })
}

export async function getRecordById(params: {
  zone_id: string
  recordId: string
}): Promise<DnsRecord | null> {
  const records = await listRecords({ zone_id: params.zone_id })
  return records.find((r) => r.id === params.recordId) ?? null
}

export function validateRecordInput(type: string, content: string): { valid: boolean; error?: string } {
  const trimmedContent = content.trim()
  if (!trimmedContent) {
    return { valid: false, error: 'Content cannot be empty' }
  }

  switch (type.toUpperCase()) {
    case 'A': {
      const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
      const match = trimmedContent.match(ipv4Regex)
      if (!match) return { valid: false, error: 'A record requires a valid IPv4 address' }
      const octets = match.slice(1).map(Number)
      if (octets.some((o) => o > 255)) return { valid: false, error: 'IPv4 octets must be between 0 and 255' }
      return { valid: true }
    }
    case 'AAAA': {
      const ipv6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/
      if (!ipv6Regex.test(trimmedContent)) return { valid: false, error: 'AAAA record requires a valid IPv6 address' }
      return { valid: true }
    }
    case 'CNAME': {
      if (!trimmedContent.endsWith('.')) return { valid: false, error: 'CNAME target should end with a dot (e.g., target.example.com.)' }
      return { valid: true }
    }
    case 'MX': {
      if (!trimmedContent.includes(' ')) return { valid: false, error: 'MX record requires priority and target (e.g., 10 mail.example.com.)' }
      const parts = trimmedContent.split(' ')
      const priority = parseInt(parts[0])
      if (isNaN(priority) || priority < 0 || priority > 65535) {
        return { valid: false, error: 'MX priority must be a number between 0 and 65535' }
      }
      return { valid: true }
    }
    case 'TXT':
      if (trimmedContent.length === 0) return { valid: false, error: 'TXT record content cannot be empty' }
      return { valid: true }
    default:
      return { valid: true }
  }
}

export async function getZoneByName(name: string): Promise<Domain | null> {
  const zones = await listZones({ per_page: 100 })
  return zones.find((z) => z.name === name) ?? null
}

export interface EmailRoutingSettings {
  enabled: boolean
  name?: string
  status?: string
  created?: string
  modified?: string
}

export async function getEmailRouting(zone_id: string): Promise<EmailRoutingSettings> {
  const cf = getClient()
  const settings: any = await cf.emailRouting.get({ zone_id })
  return {
    enabled: settings?.enabled ?? false,
    name: settings?.name,
    status: settings?.status,
    created: settings?.created,
    modified: settings?.modified,
  }
}

export async function enableEmailRouting(zone_id: string): Promise<EmailRoutingSettings> {
  const cf = getClient()
  const settings: any = await cf.emailRouting.enable({ zone_id, body: {} })
  return {
    enabled: settings?.enabled ?? true,
    name: settings?.name,
    status: settings?.status,
    created: settings?.created,
    modified: settings?.modified,
  }
}

export interface EmailRule {
  id: string
  name: string
  enabled: boolean
  from: string
  to: string[]
}

function mapRule(rule: any): EmailRule {
  const matcher = (rule?.matchers ?? []).find((m: any) => m.field === 'to')
  const forward = (rule?.actions ?? []).find((a: any) => a.type === 'forward')
  return {
    id: rule?.id ?? '',
    name: rule?.name ?? '',
    enabled: rule?.enabled ?? false,
    from: matcher?.value ?? (rule?.matchers?.[0]?.type === 'all' ? '*' : ''),
    to: forward?.value ?? [],
  }
}

export async function listEmailRules(zone_id: string): Promise<EmailRule[]> {
  const cf = getClient()
  const response: any = await cf.get(`/zones/${zone_id}/email/routing/rules`)
  const result = response?.result ?? response ?? []
  return (Array.isArray(result) ? result : []).map(mapRule)
}

export async function createEmailRule(params: {
  zone_id: string
  from: string
  to: string
  name?: string
}): Promise<EmailRule> {
  const cf = getClient()
  const rule: any = await cf.emailRouting.rules.create({
    zone_id: params.zone_id,
    name: params.name ?? `Forward ${params.from} to ${params.to}`,
    enabled: true,
    matchers: [{ type: 'literal', field: 'to', value: params.from }],
    actions: [{ type: 'forward', value: [params.to] }],
  })
  return mapRule(rule)
}

export async function deleteEmailRule(params: { zone_id: string; ruleId: string }): Promise<void> {
  const cf = getClient()
  await cf.emailRouting.rules.delete(params.ruleId, { zone_id: params.zone_id })
}

export async function getAccountIdByZone(name: string): Promise<string | null> {
  const cf = getClient()
  const response = await cf.zones.list({ per_page: 100 })
  const zone = response.result.find((z) => z.name === name)
  return (zone as any)?.account?.id ?? null
}

export interface DestinationAddress {
  id: string
  email: string
  verified: boolean
}

export async function listDestinationAddresses(account_id: string): Promise<DestinationAddress[]> {
  const cf = getClient()
  const response: any = await cf.get(`/accounts/${account_id}/email/routing/addresses`)
  const result = response?.result ?? response ?? []
  return (Array.isArray(result) ? result : []).map((a: any) => ({
    id: a?.id ?? '',
    email: a?.email ?? '',
    verified: Boolean(a?.verified),
  }))
}

export async function createDestinationAddress(params: {
  account_id: string
  email: string
}): Promise<DestinationAddress> {
  const cf = getClient()
  const address: any = await cf.emailRouting.addresses.create({
    account_id: params.account_id,
    email: params.email,
  })
  return {
    id: address?.id ?? '',
    email: address?.email ?? params.email,
    verified: Boolean(address?.verified),
  }
}

export async function validateTokenOnline(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const cf = new Cloudflare({ apiToken: token })
    await cf.user.tokens.verify()
    return { valid: true }
  } catch (err: any) {
    return { valid: false, error: err?.message ?? 'Failed to validate token' }
  }
}
