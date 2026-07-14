import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resetClient, listZones, listRecords, getZoneByName, getRecordById, createRecord, updateRecord, deleteRecord, validateRecordInput, validateTokenOnline } from '../src/client.js'
import { setToken, clearToken } from '../src/auth.js'

const mockZonesList = vi.hoisted(() => vi.fn())
const mockRecordsList = vi.hoisted(() => vi.fn())
const mockRecordsCreate = vi.hoisted(() => vi.fn())
const mockRecordsUpdate = vi.hoisted(() => vi.fn())
const mockRecordsDelete = vi.hoisted(() => vi.fn())
const mockTokenVerify = vi.hoisted(() => vi.fn())

vi.mock('cloudflare', () => {
  function MockCloudflare() {
    return {
      zones: { list: mockZonesList },
      dns: { records: { list: mockRecordsList, create: mockRecordsCreate, update: mockRecordsUpdate, delete: mockRecordsDelete } },
      user: { tokens: { verify: mockTokenVerify } },
    }
  }
  return { default: MockCloudflare }
})

beforeEach(() => {
  resetClient()
  clearToken()
  setToken('valid-test-token-12345')
  vi.clearAllMocks()
})

describe('getClient errors', () => {
  it('should throw when no token configured', async () => {
    clearToken()
    resetClient()
    await expect(listZones()).rejects.toThrow('No API token configured')
  })
})

describe('listZones', () => {
  it('should return empty array when no zones exist', async () => {
    mockZonesList.mockResolvedValue({ result: [] })

    const result = await listZones()
    expect(result).toEqual([])
  })

  it('should return mapped zones', async () => {
    mockZonesList.mockResolvedValue({
      result: [
        {
          id: 'zone-1',
          name: 'example.com',
          status: 'active',
          paused: false,
          plan: { name: 'Free' },
          created_on: '2024-01-01T00:00:00Z',
          modified_on: '2024-01-02T00:00:00Z',
        },
        {
          id: 'zone-2',
          name: 'test.org',
          status: 'pending',
          paused: true,
          plan: { name: 'Pro' },
          created_on: '2024-02-01T00:00:00Z',
          modified_on: '2024-02-02T00:00:00Z',
        },
      ],
    })

    const result = await listZones()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'zone-1',
      name: 'example.com',
      status: 'active',
      plan: 'Free',
      paused: false,
      createdOn: '2024-01-01T00:00:00Z',
      modifiedOn: '2024-01-02T00:00:00Z',
    })
    expect(result[1].name).toBe('test.org')
    expect(result[1].paused).toBe(true)
  })

  it('should handle missing plan name', async () => {
    mockZonesList.mockResolvedValue({
      result: [
        {
          id: 'zone-1',
          name: 'example.com',
          status: 'active',
          paused: false,
          plan: {},
          created_on: '',
          modified_on: '',
        },
      ],
    })

    const result = await listZones()
    expect(result[0].plan).toBe('Free')
  })
})

describe('listRecords', () => {
  it('should return empty array when no records exist', async () => {
    mockRecordsList.mockResolvedValue({ result: [] })

    const result = await listRecords({ zone_id: 'zone-1' })
    expect(result).toEqual([])
  })

  it('should return mapped records', async () => {
    mockRecordsList.mockResolvedValue({
      result: [
        {
          id: 'record-1',
          name: 'www.example.com',
          type: 'A',
          content: '1.2.3.4',
          proxied: true,
          ttl: 1,
          zone_id: 'zone-1',
          zone_name: 'example.com',
          created_on: '2024-01-01T00:00:00Z',
          modified_on: '2024-01-02T00:00:00Z',
        },
      ],
    })

    const result = await listRecords({ zone_id: 'zone-1' })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'record-1',
      name: 'www.example.com',
      type: 'A',
      content: '1.2.3.4',
      proxied: true,
      ttl: 1,
      zoneId: 'zone-1',
      zoneName: 'example.com',
      createdOn: '2024-01-01T00:00:00Z',
      modifiedOn: '2024-01-02T00:00:00Z',
    })
  })

  it('should handle records with missing optional fields', async () => {
    mockRecordsList.mockResolvedValue({
      result: [
        {
          id: 'r1',
          name: 'test.com',
          type: 'A',
          content: null,
          proxied: null,
          ttl: null,
          zone_id: null,
          zone_name: null,
          created_on: '',
          modified_on: '',
        },
      ],
    })

    const result = await listRecords({ zone_id: 'z1' })
    expect(result[0].content).toBe('')
    expect(result[0].proxied).toBe(false)
    expect(result[0].ttl).toBe(1)
    expect(result[0].zoneId).toBe('')
    expect(result[0].zoneName).toBe('')
  })

  it('should pass type filter to API', async () => {
    mockRecordsList.mockResolvedValue({ result: [] })

    await listRecords({ zone_id: 'zone-1', type: 'MX' })
    expect(mockRecordsList).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MX' })
    )
  })
})

describe('getZoneByName', () => {
  it('should return matching zone', async () => {
    mockZonesList.mockResolvedValue({
      result: [
        { id: 'z1', name: 'foo.com', status: 'active', paused: false, plan: {}, created_on: '', modified_on: '' },
        { id: 'z2', name: 'bar.com', status: 'active', paused: false, plan: {}, created_on: '', modified_on: '' },
      ],
    })

    const zone = await getZoneByName('bar.com')
    expect(zone).not.toBeNull()
    expect(zone!.id).toBe('z2')
  })

  it('should return null for non-matching zone', async () => {
    mockZonesList.mockResolvedValue({ result: [] })

    const zone = await getZoneByName('nonexistent.com')
    expect(zone).toBeNull()
  })
})

describe('validateRecordInput', () => {
  it('should reject empty content', () => {
    expect(validateRecordInput('A', '').valid).toBe(false)
  })

  it('should validate A record with valid IPv4', () => {
    expect(validateRecordInput('A', '192.168.1.1').valid).toBe(true)
    expect(validateRecordInput('A', '256.0.0.1').valid).toBe(false)
    expect(validateRecordInput('A', 'not-an-ip').valid).toBe(false)
  })

  it('should validate AAAA record with valid IPv6', () => {
    expect(validateRecordInput('AAAA', '::1').valid).toBe(true)
    expect(validateRecordInput('AAAA', '2001:db8::1').valid).toBe(true)
    expect(validateRecordInput('AAAA', 'not-ipv6').valid).toBe(false)
  })

  it('should validate CNAME record ends with dot', () => {
    expect(validateRecordInput('CNAME', 'target.example.com.').valid).toBe(true)
    expect(validateRecordInput('CNAME', 'target.example.com').valid).toBe(false)
  })

  it('should validate MX record with priority', () => {
    expect(validateRecordInput('MX', '10 mail.example.com.').valid).toBe(true)
    expect(validateRecordInput('MX', '70000 mail.example.com.').valid).toBe(false)
    expect(validateRecordInput('MX', 'invalid').valid).toBe(false)
  })

  it('should validate TXT record', () => {
    expect(validateRecordInput('TXT', 'some text').valid).toBe(true)
  })

  it('should accept unknown types', () => {
    expect(validateRecordInput('NS', 'ns1.example.com.').valid).toBe(true)
  })
})

describe('createRecord', () => {
  const newRecordResponse = {
    id: 'new-record-1',
    name: 'www.example.com',
    type: 'A',
    content: '1.2.3.4',
    proxied: false,
    ttl: 120,
    zone_id: 'zone-1',
    zone_name: 'example.com',
    created_on: '2024-01-01T00:00:00Z',
    modified_on: '2024-01-01T00:00:00Z',
  }

  it('should create and return mapped record', async () => {
    mockRecordsCreate.mockResolvedValue(newRecordResponse)

    const result = await createRecord({
      zone_id: 'zone-1',
      type: 'A',
      name: 'www.example.com',
      content: '1.2.3.4',
      ttl: 120,
      proxied: false,
    })

    expect(result.id).toBe('new-record-1')
    expect(result.content).toBe('1.2.3.4')
    expect(mockRecordsCreate).toHaveBeenCalledWith({
      zone_id: 'zone-1',
      type: 'A',
      name: 'www.example.com',
      content: '1.2.3.4',
      ttl: 120,
      proxied: false,
    })
  })

  it('should handle missing fields in response', async () => {
    mockRecordsCreate.mockResolvedValue({
      id: 'r1',
      name: 'test.com',
      type: 'A',
      content: null,
      proxied: null,
      ttl: null,
      zone_id: null,
      zone_name: null,
      created_on: '',
      modified_on: '',
    })

    const result = await createRecord({
      zone_id: 'z1',
      type: 'A',
      name: 'test.com',
      content: '1.2.3.4',
    })

    expect(result.content).toBe('')
    expect(result.proxied).toBe(false)
    expect(result.ttl).toBe(1)
  })
})

describe('updateRecord', () => {
  it('should update and return mapped record', async () => {
    mockRecordsUpdate.mockResolvedValue({
      id: 'record-1',
      name: 'www.example.com',
      type: 'A',
      content: '5.6.7.8',
      proxied: true,
      ttl: 300,
      zone_id: 'zone-1',
      zone_name: 'example.com',
      created_on: '2024-01-01T00:00:00Z',
      modified_on: '2024-01-02T00:00:00Z',
    })

    const result = await updateRecord({
      zone_id: 'zone-1',
      recordId: 'record-1',
      type: 'A',
      name: 'www.example.com',
      content: '5.6.7.8',
      ttl: 300,
      proxied: true,
    })

    expect(result.content).toBe('5.6.7.8')
    expect(result.proxied).toBe(true)
  })
})

describe('deleteRecord', () => {
  it('should call delete with correct params', async () => {
    mockRecordsDelete.mockResolvedValue({})

    await deleteRecord({ zone_id: 'zone-1', recordId: 'record-1' })

    expect(mockRecordsDelete).toHaveBeenCalledWith('record-1', { zone_id: 'zone-1' })
  })
})

describe('getRecordById', () => {
  it('should return matching record', async () => {
    mockRecordsList.mockResolvedValue({
      result: [
        { id: 'r1', name: 'a.com', type: 'A', content: '1.2.3.4', proxied: false, ttl: 1, zone_id: 'z1', zone_name: 'a.com', created_on: '', modified_on: '' },
        { id: 'r2', name: 'b.com', type: 'CNAME', content: 'target.', proxied: false, ttl: 1, zone_id: 'z1', zone_name: 'a.com', created_on: '', modified_on: '' },
      ],
    })

    const result = await getRecordById({ zone_id: 'z1', recordId: 'r2' })
    expect(result).not.toBeNull()
    expect(result!.name).toBe('b.com')
  })

  it('should return null when not found', async () => {
    mockRecordsList.mockResolvedValue({ result: [] })

    const result = await getRecordById({ zone_id: 'z1', recordId: 'nonexistent' })
    expect(result).toBeNull()
  })
})

describe('validateTokenOnline', () => {
  it('should return valid=true when verify succeeds', async () => {
    mockTokenVerify.mockResolvedValue({})

    const result = await validateTokenOnline('valid-token')
    expect(result.valid).toBe(true)
  })

  it('should return valid=false when verify fails', async () => {
    mockTokenVerify.mockRejectedValue(new Error('Invalid token'))

    const result = await validateTokenOnline('invalid-token')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid token')
  })
})
