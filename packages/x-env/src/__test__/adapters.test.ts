import { describe, it, expect, beforeEach } from 'vitest'
import {
  FileImportExportAdapter,
  HttpImportExportAdapter,
} from '../adapters/index.ts'

describe('Import/Export Adapters', () => {
  describe('FileImportExportAdapter', () => {
    let adapter: FileImportExportAdapter

    beforeEach(() => {
      adapter = new FileImportExportAdapter({ format: 'json' })
    })

    it('should check if File System Access API is supported', () => {
      // In Node.js environment, it should not be supported
      expect(adapter.isSupported()).toBe(false)
    })

    it('should throw error when trying to import in unsupported environment', async () => {
      await expect(adapter.importConfig()).rejects.toThrow(
        'File System Access API is not supported in this browser'
      )
    })

    it('should throw error when trying to export in unsupported environment', async () => {
      const variables = { TEST: 'value' }
      await expect(adapter.exportConfig(variables)).rejects.toThrow(
        'File System Access API is not supported in this browser'
      )
    })
  })

  describe('HttpImportExportAdapter', () => {
    let adapter: HttpImportExportAdapter

    beforeEach(() => {
      adapter = new HttpImportExportAdapter('http://localhost:3000', {
        format: 'json',
      })
    })

    it('should check if fetch API is supported', () => {
      // In Node.js environment with fetch polyfill, it might be supported
      const isSupported = adapter.isSupported()
      expect(typeof isSupported).toBe('boolean')
    })

    it('should handle import errors gracefully', async () => {
      // This will fail because we're not running a server
      await expect(adapter.importConfig()).rejects.toThrow()
    })

    it('should handle export errors gracefully', async () => {
      const variables = { TEST: 'value' }
      // This will fail because we're not running a server
      await expect(adapter.exportConfig(variables)).rejects.toThrow()
    })
  })
})
