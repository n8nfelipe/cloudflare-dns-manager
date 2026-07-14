import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const tmpDir = join(tmpdir(), 'cloudflare-dns-test-audit-' + Date.now())

beforeEach(() => {
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true })
  }
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('audit log', () => {
  it('should create audit directory and file on first log', async () => {
    const { logAudit, getAuditFilePath } = await import('../src/audit.js')
    logAudit(tmpDir, {
      operation: 'create',
      domain: 'example.com',
      recordId: 'rec-1',
      details: 'Created A record www.example.com -> 1.2.3.4',
    })

    const filePath = getAuditFilePath(tmpDir)
    expect(existsSync(filePath)).toBe(true)

    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('create')
    expect(content).toContain('example.com')
    expect(content).toContain('rec-1')
    expect(content).toContain('www.example.com')
  })

  it('should append multiple entries', async () => {
    const { logAudit, getAuditFilePath } = await import('../src/audit.js')

    logAudit(tmpDir, { operation: 'create', domain: 'a.com', details: 'First' })
    logAudit(tmpDir, { operation: 'delete', domain: 'b.com', details: 'Second' })

    const filePath = getAuditFilePath(tmpDir)
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('First')
    expect(lines[1]).toContain('Second')
  })

  it('should include timestamp in log entries', async () => {
    const { logAudit, getAuditFilePath } = await import('../src/audit.js')
    logAudit(tmpDir, { operation: 'update', domain: 'test.com', details: 'Updated record' })

    const filePath = getAuditFilePath(tmpDir)
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T/)
  })

  it('should include user if provided', async () => {
    const { logAudit, getAuditFilePath } = await import('../src/audit.js')
    logAudit(tmpDir, {
      operation: 'template_apply',
      domain: 'test.com',
      details: 'Applied template',
      user: 'admin@example.com',
    })

    const filePath = getAuditFilePath(tmpDir)
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('admin@example.com')
  })
})
