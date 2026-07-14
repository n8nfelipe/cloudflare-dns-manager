import { describe, it, expect } from 'vitest'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('readDomainsFile', () => {
  it('should throw for non-existent file', async () => {
    const { readDomainsFile } = await import('../src/utils.js')
    expect(() => readDomainsFile('/nonexistent/file.txt')).toThrow('not found')
  })

  it('should read domains from file', async () => {
    const filePath = join(tmpdir(), 'domains-' + Date.now() + '.txt')
    writeFileSync(filePath, 'example.com\ntest.org\n# this is a comment\nmysite.net\n', 'utf-8')

    const { readDomainsFile } = await import('../src/utils.js')
    const domains = readDomainsFile(filePath)
    expect(domains).toEqual(['example.com', 'test.org', 'mysite.net'])
    unlinkSync(filePath)
  })

  it('should skip empty lines', async () => {
    const filePath = join(tmpdir(), 'domains-empty-' + Date.now() + '.txt')
    writeFileSync(filePath, 'example.com\n\n\ntest.org\n', 'utf-8')

    const { readDomainsFile } = await import('../src/utils.js')
    const domains = readDomainsFile(filePath)
    expect(domains).toEqual(['example.com', 'test.org'])
    unlinkSync(filePath)
  })
})
