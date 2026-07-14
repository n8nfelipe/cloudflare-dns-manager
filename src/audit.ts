import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AuditEntry } from './types.js'

const AUDIT_DIR = 'audit'
const AUDIT_FILE = 'dns-audit.log'

function ensureAuditDir(basePath: string): string {
  const dir = join(basePath, AUDIT_DIR)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getAuditFilePath(basePath: string): string {
  return resolve(join(ensureAuditDir(basePath), AUDIT_FILE))
}

export function logAudit(basePath: string, entry: Omit<AuditEntry, 'timestamp'>): void {
  const fullEntry: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  }

  const logLine = [
    `[${fullEntry.timestamp}]`,
    fullEntry.operation,
    fullEntry.domain,
    fullEntry.recordId ?? '-',
    `"${fullEntry.details.replace(/"/g, '\\"')}"`,
    fullEntry.user ?? 'cli',
  ].join(' | ')

  const filePath = getAuditFilePath(basePath)
  try {
    appendFileSync(filePath, logLine + '\n', 'utf-8')
  } catch (err: any) {
    console.error('Warning: could not write audit log:', err.message)
  }
}

export function formatAuditEntry(entry: AuditEntry): string {
  return [
    `[${entry.timestamp}]`,
    entry.operation.toUpperCase(),
    `Domain: ${entry.domain}`,
    entry.recordId ? `Record: ${entry.recordId}` : '',
    entry.details,
  ]
    .filter(Boolean)
    .join(' | ')
}
