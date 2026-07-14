import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getToken, setToken, clearToken, validateToken, getConfigPath } from '../src/auth.js'

const mockStore = vi.hoisted(() => new Map<string, string>())

vi.mock('conf', () => {
  function MockConf() {
    return {
      get: (key: string) => mockStore.get(key),
      set: (key: string, val: string) => { mockStore.set(key, val) },
      delete: (key: string) => { mockStore.delete(key) },
      get path() { return '/fake/path/config.json' },
    }
  }
  return { default: MockConf }
})


describe('auth', () => {
  beforeEach(() => {
    mockStore.clear()
    delete process.env.CLOUDFLARE_API_TOKEN
  })

  describe('validateToken', () => {
    it('should reject empty token', () => {
      const result = validateToken('')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty')
    })

    it('should reject whitespace-only token', () => {
      const result = validateToken('   ')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty')
    })

    it('should reject token that is too short', () => {
      const result = validateToken('short')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('too short')
    })

    it('should accept valid-looking token', () => {
      const result = validateToken('a'.repeat(40))
      expect(result.valid).toBe(true)
    })
  })

  describe('setToken / getToken / clearToken', () => {
    it('should return undefined when no token is set', () => {
      expect(getToken()).toBeUndefined()
    })

    it('should return token from config after setting', () => {
      setToken('test-token-123')
      expect(getToken()).toBe('test-token-123')
    })

    it('should return undefined after clearing', () => {
      setToken('test-token-123')
      clearToken()
      expect(getToken()).toBeUndefined()
    })

    it('should read token from environment variable', () => {
      process.env.CLOUDFLARE_API_TOKEN = 'env-token'
      expect(getToken()).toBe('env-token')
    })

    it('should return path from getConfigPath', () => {
      const path = getConfigPath()
      expect(path).toBe('/fake/path/config.json')
    })
  })
})
