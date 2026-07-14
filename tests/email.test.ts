import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resetClient,
  getEmailRouting,
  enableEmailRouting,
  listEmailRules,
  createEmailRule,
  deleteEmailRule,
  getAccountIdByZone,
  listDestinationAddresses,
  createDestinationAddress,
} from '../src/client.js'
vi.mock('../src/auth.js', () => ({
  getToken: () => 'valid-test-token-12345',
}))

const mockZonesList = vi.hoisted(() => vi.fn())
const mockGet = vi.hoisted(() => vi.fn())
const mockEmailGet = vi.hoisted(() => vi.fn())
const mockEmailEnable = vi.hoisted(() => vi.fn())
const mockRuleCreate = vi.hoisted(() => vi.fn())
const mockRuleDelete = vi.hoisted(() => vi.fn())
const mockAddressCreate = vi.hoisted(() => vi.fn())

vi.mock('cloudflare', () => {
  function MockCloudflare() {
    return {
      zones: { list: mockZonesList },
      get: mockGet,
      emailRouting: {
        get: mockEmailGet,
        enable: mockEmailEnable,
        rules: { create: mockRuleCreate, delete: mockRuleDelete },
        addresses: { create: mockAddressCreate },
      },
    }
  }
  return { default: MockCloudflare }
})

beforeEach(() => {
  resetClient()
  vi.clearAllMocks()
})

describe('getEmailRouting', () => {
  it('should map settings', async () => {
    mockEmailGet.mockResolvedValue({ enabled: true, status: 'ready', name: 'example.com' })

    const result = await getEmailRouting('zone-1')
    expect(result.enabled).toBe(true)
    expect(result.status).toBe('ready')
    expect(mockEmailGet).toHaveBeenCalledWith({ zone_id: 'zone-1' })
  })

  it('should default enabled to false', async () => {
    mockEmailGet.mockResolvedValue({})
    const result = await getEmailRouting('zone-1')
    expect(result.enabled).toBe(false)
  })
})

describe('enableEmailRouting', () => {
  it('should enable and map settings', async () => {
    mockEmailEnable.mockResolvedValue({ enabled: true })

    const result = await enableEmailRouting('zone-1')
    expect(result.enabled).toBe(true)
    expect(mockEmailEnable).toHaveBeenCalledWith({ zone_id: 'zone-1', body: {} })
  })
})

describe('listEmailRules', () => {
  it('should map rules from result array', async () => {
    mockGet.mockResolvedValue({
      result: [
        {
          id: 'rule-1',
          name: 'Forward',
          enabled: true,
          matchers: [{ type: 'literal', field: 'to', value: 'contato@example.com' }],
          actions: [{ type: 'forward', value: ['dest@gmail.com'] }],
        },
      ],
    })

    const result = await listEmailRules('zone-1')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'rule-1',
      name: 'Forward',
      enabled: true,
      from: 'contato@example.com',
      to: ['dest@gmail.com'],
    })
    expect(mockGet).toHaveBeenCalledWith('/zones/zone-1/email/routing/rules')
  })

  it('should return empty array when no rules', async () => {
    mockGet.mockResolvedValue({ result: [] })
    const result = await listEmailRules('zone-1')
    expect(result).toEqual([])
  })

  it('should handle catch-all matcher', async () => {
    mockGet.mockResolvedValue({
      result: [{ id: 'r', matchers: [{ type: 'all' }], actions: [{ type: 'forward', value: ['x@y.com'] }] }],
    })
    const result = await listEmailRules('zone-1')
    expect(result[0].from).toBe('*')
  })
})

describe('createEmailRule', () => {
  it('should create rule with literal matcher and forward action', async () => {
    mockRuleCreate.mockResolvedValue({
      id: 'rule-1',
      name: 'custom',
      enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: 'contato@example.com' }],
      actions: [{ type: 'forward', value: ['dest@gmail.com'] }],
    })

    const result = await createEmailRule({
      zone_id: 'zone-1',
      from: 'contato@example.com',
      to: 'dest@gmail.com',
      name: 'custom',
    })

    expect(result.id).toBe('rule-1')
    expect(result.to).toEqual(['dest@gmail.com'])
    expect(mockRuleCreate).toHaveBeenCalledWith({
      zone_id: 'zone-1',
      name: 'custom',
      enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: 'contato@example.com' }],
      actions: [{ type: 'forward', value: ['dest@gmail.com'] }],
    })
  })

  it('should build a default name when not provided', async () => {
    mockRuleCreate.mockResolvedValue({ id: 'r' })
    await createEmailRule({ zone_id: 'z', from: 'a@x.com', to: 'b@y.com' })
    expect(mockRuleCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Forward a@x.com to b@y.com' })
    )
  })
})

describe('deleteEmailRule', () => {
  it('should call delete with rule id and zone', async () => {
    mockRuleDelete.mockResolvedValue({})
    await deleteEmailRule({ zone_id: 'zone-1', ruleId: 'rule-1' })
    expect(mockRuleDelete).toHaveBeenCalledWith('rule-1', { zone_id: 'zone-1' })
  })
})

describe('getAccountIdByZone', () => {
  it('should return account id for matching zone', async () => {
    mockZonesList.mockResolvedValue({
      result: [{ id: 'z1', name: 'example.com', account: { id: 'acc-1' } }],
    })
    const result = await getAccountIdByZone('example.com')
    expect(result).toBe('acc-1')
  })

  it('should return null when zone not found', async () => {
    mockZonesList.mockResolvedValue({ result: [] })
    const result = await getAccountIdByZone('missing.com')
    expect(result).toBeNull()
  })
})

describe('listDestinationAddresses', () => {
  it('should map addresses', async () => {
    mockGet.mockResolvedValue({
      result: [{ id: 'a1', email: 'dest@gmail.com', verified: '2024-01-01T00:00:00Z' }],
    })
    const result = await listDestinationAddresses('acc-1')
    expect(result[0]).toEqual({ id: 'a1', email: 'dest@gmail.com', verified: true })
    expect(mockGet).toHaveBeenCalledWith('/accounts/acc-1/email/routing/addresses')
  })
})

describe('createDestinationAddress', () => {
  it('should create address', async () => {
    mockAddressCreate.mockResolvedValue({ id: 'a1', email: 'dest@gmail.com', verified: null })
    const result = await createDestinationAddress({ account_id: 'acc-1', email: 'dest@gmail.com' })
    expect(result.email).toBe('dest@gmail.com')
    expect(result.verified).toBe(false)
    expect(mockAddressCreate).toHaveBeenCalledWith({ account_id: 'acc-1', email: 'dest@gmail.com' })
  })
})
