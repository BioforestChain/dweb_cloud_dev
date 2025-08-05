import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  existsSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  HttpImportExportAdapter,
  FileImportExportAdapter,
} from '../adapters.ts'

describe('HttpImportExportAdapter', () => {
  let adapter: HttpImportExportAdapter

  beforeEach(() => {
    adapter = new HttpImportExportAdapter()
  })

  it('should create adapter instance', () => {
    expect(adapter).toBeInstanceOf(HttpImportExportAdapter)
  })

  it('should handle fetch errors during import', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    })

    await expect(
      adapter.import('https://example.com/config.json')
    ).rejects.toThrow(
      'Failed to import from https://example.com/config.json: Not Found'
    )
  })

  it('should import JSON data from URL', async () => {
    const mockData = { key: 'value' }
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce(mockData),
    })

    const result = await adapter.import('https://example.com/config.json')
    expect(result).toEqual(mockData)
  })

  it('should handle fetch errors during export', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
    })

    await expect(
      adapter.export('https://example.com/config.json', { key: 'value' })
    ).rejects.toThrow(
      'Failed to export to https://example.com/config.json: Bad Request'
    )
  })

  it('should export JSON data to URL', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
    })

    await adapter.export('https://example.com/config.json', { key: 'value' })

    expect(fetch).toHaveBeenCalledWith('https://example.com/config.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'value' }),
    })
  })
})

describe('FileImportExportAdapter', () => {
  let adapter: FileImportExportAdapter
  const testOutputDir = join(process.cwd(), 'test-output')

  beforeEach(() => {
    adapter = new FileImportExportAdapter()
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true })
    }
    mkdirSync(testOutputDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true })
    }
  })

  it('should create adapter instance', () => {
    expect(adapter).toBeInstanceOf(FileImportExportAdapter)
  })

  it('should import JSON file', async () => {
    const testData = { key: 'value', number: 42 }
    const filePath = join(testOutputDir, 'test.json')
    writeFileSync(filePath, JSON.stringify(testData), 'utf8')

    const result = await adapter.import(filePath)
    expect(result).toEqual(testData)
  })

  it('should import env file', async () => {
    const envContent = `KEY1=value1
KEY2="value with spaces"
# This is a comment
KEY3=value3`
    const filePath = join(testOutputDir, 'test.env')
    writeFileSync(filePath, envContent, 'utf8')

    const result = await adapter.import(filePath)
    expect(result).toEqual({
      KEY1: 'value1',
      KEY2: 'value with spaces',
      KEY3: 'value3',
    })
  })

  it('should export JSON file', async () => {
    const testData = { key: 'value', number: 42 }
    const filePath = join(testOutputDir, 'test.json')

    await adapter.export(filePath, testData)

    expect(existsSync(filePath)).toBe(true)
    const content = JSON.parse(readFileSync(filePath, 'utf8'))
    expect(content).toEqual(testData)
  })

  it('should export env file', async () => {
    const testData = {
      KEY1: 'value1',
      KEY2: 'value with spaces',
      KEY3: 42,
      KEY4: true,
    }
    const filePath = join(testOutputDir, 'test.env')

    await adapter.export(filePath, testData)

    expect(existsSync(filePath)).toBe(true)
    const content = readFileSync(filePath, 'utf8')
    expect(content).toContain('KEY1=value1')
    expect(content).toContain('KEY2="value with spaces"')
    expect(content).toContain('KEY3=42')
    expect(content).toContain('KEY4=true')
  })

  it('should handle browser environment check', async () => {
    // The adapter should work in Node.js environment
    const testData = { key: 'value' }
    const filePath = join(testOutputDir, 'test.json')

    await adapter.export(filePath, testData)
    expect(existsSync(filePath)).toBe(true)
  })
})
