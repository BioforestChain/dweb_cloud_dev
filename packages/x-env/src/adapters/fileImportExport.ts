import type {
  ImportExportAdapter,
  ImportExportOptions,
  SupportedFormat,
} from './types.ts'

// Type definitions for File System Access API
interface FileSystemFileHandle {
  getFile(): Promise<File>
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream {
  write(data: string): Promise<void>
  close(): Promise<void>
}

interface ShowOpenFilePickerOptions {
  types?: Array<{
    description: string
    accept: Record<string, string[]>
  }>
}

interface ShowSaveFilePickerOptions {
  suggestedName?: string
  types?: Array<{
    description: string
    accept: Record<string, string[]>
  }>
}

// File System Access API types for globalThis
interface FileSystemAccessWindow {
  showOpenFilePicker(
    options?: ShowOpenFilePickerOptions
  ): Promise<FileSystemFileHandle[]>
  showSaveFilePicker(
    options?: ShowSaveFilePickerOptions
  ): Promise<FileSystemFileHandle>
}

/**
 * File Import/Export Adapter for html-tools mode
 * Uses File System Access API to manage local configuration files
 */
export class FileImportExportAdapter implements ImportExportAdapter {
  constructor(private options: ImportExportOptions = {}) {}

  async importConfig(): Promise<Record<string, unknown>> {
    if (!this.isSupported()) {
      throw new Error('File System Access API is not supported in this browser')
    }

    try {
      // Open file picker
      const [fileHandle] = await (globalThis as any).showOpenFilePicker({
        types: [
          {
            description: 'Configuration files',
            accept: {
              'application/json': ['.json'],
              'text/plain': ['.env'],
              'application/x-yaml': ['.yaml', '.yml'],
              'application/toml': ['.toml'],
            },
          },
        ],
      })

      const file = await fileHandle.getFile()
      const content = await file.text()

      // Parse based on file extension
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (!extension || !this.isSupportedFormat(extension)) {
        throw new Error(`Unsupported file format: ${extension}`)
      }
      return this.parseConfigContent(content, extension)
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        throw new Error('Import cancelled by user')
      }
      throw new Error(
        `Failed to import config: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  async exportConfig(variables: Record<string, unknown>): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('File System Access API is not supported in this browser')
    }

    try {
      const format = this.options.format || 'json'
      const filename = this.options.filename || `safenv-config.${format}`

      // Generate content based on format
      const content = this.generateConfigContent(variables, format)

      // Open save file picker
      const fileHandle = await (globalThis as any).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'Configuration files',
            accept: {
              'application/json': ['.json'],
              'text/plain': ['.env'],
              'application/x-yaml': ['.yaml', '.yml'],
              'application/toml': ['.toml'],
            },
          },
        ],
      })

      const writable = await fileHandle.createWritable()
      await writable.write(content)
      await writable.close()
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        throw new Error('Export cancelled by user')
      }
      throw new Error(
        `Failed to export config: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  isSupported(): boolean {
    return (
      typeof globalThis !== 'undefined' &&
      'showOpenFilePicker' in globalThis &&
      'showSaveFilePicker' in globalThis
    )
  }

  private isSupportedFormat(
    format: string
  ): format is 'json' | 'env' | 'yaml' | 'yml' | 'toml' {
    return ['json', 'env', 'yaml', 'yml', 'toml'].includes(format)
  }

  private parseConfigContent(
    content: string,
    format: 'json' | 'env' | 'yaml' | 'yml' | 'toml'
  ): Record<string, unknown> {
    switch (format) {
      case 'json':
        try {
          const parsed = JSON.parse(content)
          if (
            typeof parsed !== 'object' ||
            parsed === null ||
            Array.isArray(parsed)
          ) {
            throw new Error('JSON file must contain an object')
          }
          return parsed as Record<string, unknown>
        } catch (error) {
          throw new Error(
            `Invalid JSON format: ${error instanceof Error ? error.message : String(error)}`
          )
        }

      case 'env':
        const variables: Record<string, unknown> = {}
        content.split('\\n').forEach(line => {
          line = line.trim()
          if (line && !line.startsWith('#')) {
            const [key, ...valueParts] = line.split('=')
            if (key && valueParts.length > 0) {
              let value = valueParts.join('=')
              // Remove quotes if present
              if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
              ) {
                value = value.slice(1, -1)
              }
              variables[key.trim()] = value
            }
          }
        })
        return variables

      case 'yaml':
      case 'yml':
        // Note: In a real implementation, you'd use a YAML parser
        // For now, we'll throw an error suggesting JSON format
        throw new Error('YAML import not implemented. Please use JSON format.')

      case 'toml':
        // Note: In a real implementation, you'd use a TOML parser
        throw new Error('TOML import not implemented. Please use JSON format.')

      default:
        throw new Error(`Unsupported format: ${format}`)
    }
  }

  private safeStringify(value: unknown): string {
    if (typeof value === 'string') {
      return value
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    if (value === null || value === undefined) {
      return ''
    }
    if (Array.isArray(value)) {
      return value.join(',')
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  }

  private generateConfigContent(
    variables: Record<string, unknown>,
    format: SupportedFormat
  ): string {
    switch (format) {
      case 'json':
        return JSON.stringify(variables, null, 2)

      case 'env':
        return Object.entries(variables)
          .map(([key, value]) => {
            const stringValue = this.safeStringify(value)
            const needsQuotes =
              stringValue.includes(' ') || stringValue.includes('"')
            return `${key}=${needsQuotes ? `"${stringValue.replace(/"/g, '\\\\"')}"` : stringValue}`
          })
          .join('\\n')

      case 'yaml':
        // Simple YAML generation (for basic cases)
        return Object.entries(variables)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join('\\n')

      case 'toml':
        // Simple TOML generation (for basic cases)
        return Object.entries(variables)
          .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
          .join('\\n')

      default:
        throw new Error(`Unsupported format: ${format}`)
    }
  }
}
