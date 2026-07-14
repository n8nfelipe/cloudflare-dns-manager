import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse, stringify } from 'yaml'
import { DnsTemplate, TemplateRecord } from './types.js'
import { validateRecordInput } from './client.js'

export function parseTemplateFile(filePath: string): DnsTemplate {
  const resolved = resolve(filePath)
  if (!existsSync(resolved)) {
    throw new Error(`Template file not found: ${resolved}`)
  }

  const content = readFileSync(resolved, 'utf-8')
  const parsed = parse(content)

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid template file: must contain a YAML object')
  }

  if (!parsed.name || typeof parsed.name !== 'string') {
    throw new Error('Invalid template: missing required "name" field')
  }

  if (!Array.isArray(parsed.records) || parsed.records.length === 0) {
    throw new Error('Invalid template: missing required "records" array')
  }

  for (let i = 0; i < parsed.records.length; i++) {
    const rec = parsed.records[i]
    if (!rec.type || !rec.name || !rec.content) {
      throw new Error(`Invalid template record at index ${i}: missing type, name, or content`)
    }
    const validation = validateRecordInput(rec.type, rec.content)
    if (!validation.valid) {
      throw new Error(`Invalid template record at index ${i} (${rec.type} ${rec.name}): ${validation.error}`)
    }
  }

  return parsed as DnsTemplate
}

export function generateTemplateYaml(template: DnsTemplate): string {
  return stringify(template, { lineWidth: 120 })
}

export function saveTemplateFile(template: DnsTemplate, filePath: string): void {
  const yaml = generateTemplateYaml(template)
  writeFileSync(resolve(filePath), yaml, 'utf-8')
}

export function resolveRecordName(name: string, domain: string): string {
  if (name === '@') return domain
  if (name.endsWith(`.${domain}`)) return name
  if (name.includes('.')) return name
  return `${name}.${domain}`
}

export function createTemplateFromRecords(
  name: string,
  description: string | undefined,
  records: TemplateRecord[]
): DnsTemplate {
  return { name, description, records }
}

const TEMPLATES_DIR = 'templates'

export function ensureTemplatesDir(basePath: string): string {
  const dir = join(basePath, TEMPLATES_DIR)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function listTemplateFiles(basePath: string): string[] {
  const dir = ensureTemplatesDir(basePath)
  try {
    return readdirSync(dir).filter((f: string) => f.endsWith('.yaml') || f.endsWith('.yml'))
  } catch {
    return []
  }
}
