import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export async function confirmAction(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output })
  const answer = await rl.question(`${prompt} (y/N) `)
  rl.close()
  return answer.toLowerCase() === 'y'
}

export function exitError(message: string): never {
  console.error(message)
  return process.exit(1) as never
}

export function readDomainsFile(filePath: string): string[] {
  const resolved = resolve(filePath)
  if (!existsSync(resolved)) {
    throw new Error(`Domains file not found: ${resolved}`)
  }
  const content = readFileSync(resolved, 'utf-8')
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
}
