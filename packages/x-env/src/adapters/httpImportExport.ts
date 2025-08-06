import type { ImportExportAdapter, ImportExportOptions } from './types.ts'

/**
 * HTTP Import/Export Adapter for web-ui mode
 * Uses fetch API to import/export configurations via HTTP endpoints
 */
export class HttpImportExportAdapter implements ImportExportAdapter {
  constructor(
    private baseUrl: string = '',
    private options: ImportExportOptions = {}
  ) {}

  async importConfig(): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/import-config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`)
      }

      const data = (await response.json()) as {
        variables?: Record<string, unknown>
      }
      return data.variables || {}
    } catch (error) {
      throw new Error(
        `Failed to import config: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  async exportConfig(variables: Record<string, unknown>): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/export-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variables,
          format: this.options.format || 'json',
          filename: this.options.filename,
        }),
      })

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`)
      }

      // For web-ui mode, we might trigger a download
      const contentDisposition = response.headers.get('content-disposition')
      if (contentDisposition) {
        if (this.isBrowserEnvironment()) {
          const blob = await response.blob()
          const url = (globalThis as any).window.URL.createObjectURL(blob)
          const a = (globalThis as any).document.createElement('a')
          a.href = url
          a.download = this.options.filename || 'safenv-config.json'
          ;(globalThis as any).document.body.appendChild(a)
          a.click()
          ;(globalThis as any).document.body.removeChild(a)
          ;(globalThis as any).window.URL.revokeObjectURL(url)
        } else {
          throw new Error('Browser environment required for file download')
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to export config: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  isSupported(): boolean {
    return typeof fetch !== 'undefined' && this.isBrowserEnvironment()
  }

  private isBrowserEnvironment(): boolean {
    return (
      typeof globalThis !== 'undefined' &&
      'window' in globalThis &&
      'document' in globalThis
    )
  }
}
