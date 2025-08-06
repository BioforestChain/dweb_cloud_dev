export type SupportedFormat = 'json' | 'env' | 'yaml' | 'toml'

export interface ImportExportAdapter {
  /**
   * Import configuration from external source
   */
  importConfig(): Promise<Record<string, unknown>>

  /**
   * Export configuration to external destination
   */
  exportConfig(variables: Record<string, unknown>): Promise<void>

  /**
   * Check if the adapter is supported in current environment
   */
  isSupported(): boolean
}

export interface ImportExportOptions {
  format?: SupportedFormat
  filename?: string
}

export interface ImportResult {
  variables: Record<string, unknown>
  format: SupportedFormat
}

export interface ExportRequest {
  variables: Record<string, unknown>
  format: SupportedFormat
  filename?: string
}
