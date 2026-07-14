import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const tmpDir = join(tmpdir(), 'cloudflare-dns-test-templates-' + Date.now())

beforeEach(() => {
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true })
  }
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('parseTemplateFile', () => {
  it('should throw for non-existent file', async () => {
    const { parseTemplateFile } = await import('../src/template.js')
    expect(() => parseTemplateFile('/nonexistent/file.yaml')).toThrow('not found')
  })

  it('should parse a valid template file', async () => {
    const filePath = join(tmpDir, 'valid.yaml')
    writeFileSync(filePath, `
name: basic-site
description: Basic static site setup
records:
  - type: A
    name: "@"
    content: "192.168.1.1"
    ttl: 120
    proxied: true
  - type: CNAME
    name: www
    content: "target.example.com."
    `, 'utf-8')

    const { parseTemplateFile } = await import('../src/template.js')
    const template = parseTemplateFile(filePath)
    expect(template.name).toBe('basic-site')
    expect(template.description).toBe('Basic static site setup')
    expect(template.records).toHaveLength(2)
    expect(template.records[0].type).toBe('A')
    expect(template.records[0].name).toBe('@')
    expect(template.records[1].type).toBe('CNAME')
  })

  it('should throw for missing name', async () => {
    const filePath = join(tmpDir, 'no-name.yaml')
    writeFileSync(filePath, 'records: []', 'utf-8')

    const { parseTemplateFile } = await import('../src/template.js')
    expect(() => parseTemplateFile(filePath)).toThrow('name')
  })

  it('should throw for empty records', async () => {
    const filePath = join(tmpDir, 'empty.yaml')
    writeFileSync(filePath, 'name: test\nrecords: []', 'utf-8')

    const { parseTemplateFile } = await import('../src/template.js')
    expect(() => parseTemplateFile(filePath)).toThrow('records')
  })

  it('should throw for records missing required fields', async () => {
    const filePath = join(tmpDir, 'bad-record.yaml')
    writeFileSync(filePath, 'name: test\nrecords:\n  - type: A', 'utf-8')

    const { parseTemplateFile } = await import('../src/template.js')
    expect(() => parseTemplateFile(filePath)).toThrow('missing type, name, or content')
  })
})

describe('generateTemplateYaml / saveTemplateFile', () => {
  it('should generate valid YAML and save it', async () => {
    const { generateTemplateYaml, saveTemplateFile } = await import('../src/template.js')
    const template = {
      name: 'test-template',
      description: 'Test',
      records: [{ type: 'A' as const, name: '@', content: '1.2.3.4', ttl: 60, proxied: false }],
    }

    const yaml = generateTemplateYaml(template)
    expect(yaml).toContain('name: test-template')
    expect(yaml).toContain('type: A')

    const filePath = join(tmpDir, 'output.yaml')
    saveTemplateFile(template, filePath)
    expect(existsSync(filePath)).toBe(true)
  })
})

describe('resolveRecordName', () => {
  it('should return domain for @', async () => {
    const { resolveRecordName } = await import('../src/template.js')
    expect(resolveRecordName('@', 'example.com')).toBe('example.com')
  })

  it('should prepend subdomain to domain', async () => {
    const { resolveRecordName } = await import('../src/template.js')
    expect(resolveRecordName('www', 'example.com')).toBe('www.example.com')
  })

  it('should return as-is if already full name', async () => {
    const { resolveRecordName } = await import('../src/template.js')
    expect(resolveRecordName('www.example.com', 'example.com')).toBe('www.example.com')
  })
})

describe('ensureTemplatesDir / listTemplateFiles', () => {
  it('should create and list template files', async () => {
    const { ensureTemplatesDir, listTemplateFiles } = await import('../src/template.js')
    const dir = ensureTemplatesDir(tmpDir)
    expect(existsSync(dir)).toBe(true)

    writeFileSync(join(dir, 'test1.yaml'), 'name: t1\nrecords: []', 'utf-8')
    writeFileSync(join(dir, 'test2.yml'), 'name: t2\nrecords: []', 'utf-8')
    writeFileSync(join(dir, 'ignored.txt'), 'not a template', 'utf-8')

    const files = listTemplateFiles(tmpDir)
    expect(files).toContain('test1.yaml')
    expect(files).toContain('test2.yml')
    expect(files).not.toContain('ignored.txt')
  })
})
