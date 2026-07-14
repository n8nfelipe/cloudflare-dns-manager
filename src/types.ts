export interface Domain {
  id: string
  name: string
  status: 'active' | 'pending' | 'disabled'
  plan: string
  paused: boolean
  createdOn: string
  modifiedOn: string
}

export interface DnsRecord {
  id: string
  name: string
  type: RecordType
  content: string
  proxied: boolean
  ttl: number
  zoneId: string
  zoneName: string
  createdOn: string
  modifiedOn: string
}

export type RecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'CAA'

export interface ApiError {
  code: number
  message: string
}

export interface CliConfig {
  apiToken?: string
}

export interface TemplateRecord {
  type: RecordType
  name: string
  content: string
  ttl?: number
  proxied?: boolean
}

export interface DnsTemplate {
  name: string
  description?: string
  records: TemplateRecord[]
}

export interface AuditEntry {
  timestamp: string
  operation: 'create' | 'update' | 'delete' | 'template_apply' | 'batch'
  domain: string
  recordId?: string
  details: string
  user?: string
}
