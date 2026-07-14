import Conf from 'conf'
import { CliConfig } from './types.js'

const config = new Conf<CliConfig>({ projectName: 'cloudflare-dns-manager' })

export function getToken(): string | undefined {
  return process.env.CLOUDFLARE_API_TOKEN || config.get('apiToken')
}

export function setToken(token: string): void {
  config.set('apiToken', token)
}

export function clearToken(): void {
  config.delete('apiToken')
}

export function validateToken(token: string): { valid: boolean; error?: string } {
  if (!token || token.trim().length === 0) {
    return { valid: false, error: 'API token cannot be empty' }
  }
  if (token.trim().length < 20) {
    return { valid: false, error: 'API token appears to be too short' }
  }
  return { valid: true }
}

export function getConfigPath(): string {
  return config.path
}
