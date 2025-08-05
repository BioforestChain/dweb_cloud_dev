import type { ImportExportAdapter } from './plugins/types.ts'

// Browser API types
declare global {
  interface Window {
    showOpenFilePicker?: (options?: any) => Promise<any[]>
    showSaveFilePicker?: (options?: any) => Promise<any>
  }
}

export class HttpImportExportAdapter implements ImportExportAdapter {
  async import(url: string): Promise<Record<string, any>> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to import from ${url}: ${response.statusText}`)
    }
    return response.json() as Promise<Record<string, any>>
  }

  async export(filePath: string, data: Record<string, any>): Promise<void> {
    const response = await fetch(filePath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`Failed to export to ${filePath}: ${response.statusText}`)
    }
  }
}

export class FileImportExportAdapter implements ImportExportAdapter {
  async import(filePath: string): Promise<Record<string, any>> {
    // Browser environment with File System Access API
    const hasWindow =
      typeof globalThis !== 'undefined' && 'window' in globalThis
    const window = hasWindow ? (globalThis as any).window : undefined

    if (window && 'showOpenFilePicker' in window) {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Configuration files',
            accept: {
              'application/json': ['.json'],
              'application/x-yaml': ['.yaml', '.yml'],
              'text/plain': ['.env', '.toml'],
            },
          },
        ],
      })

      const file = await fileHandle.getFile()
      const content = await file.text()

      if (file.name.endsWith('.json')) {
        return JSON.parse(content)
      } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        const yaml = await import('js-yaml')
        return yaml.load(content) as Record<string, any>
      } else if (file.name.endsWith('.toml')) {
        const TOML = await import('@iarna/toml')
        return TOML.parse(content)
      } else {
        return this.parseEnvFile(content)
      }
    } else {
      const fs = await import('fs')
      const content = fs.readFileSync(filePath, 'utf8')

      if (filePath.endsWith('.json')) {
        return JSON.parse(content)
      } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        const yaml = await import('js-yaml')
        return yaml.load(content) as Record<string, any>
      } else if (filePath.endsWith('.toml')) {
        const TOML = await import('@iarna/toml')
        return TOML.parse(content)
      } else {
        return this.parseEnvFile(content)
      }
    }
  }

  async export(filePath: string, data: Record<string, any>): Promise<void> {
    let content: string
    let mimeType: string

    if (filePath.endsWith('.json')) {
      content = JSON.stringify(data, null, 2)
      mimeType = 'application/json'
    } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      const yaml = await import('js-yaml')
      content = yaml.dump(data)
      mimeType = 'application/x-yaml'
    } else if (filePath.endsWith('.toml')) {
      const TOML = await import('@iarna/toml')
      content = TOML.stringify(data)
      mimeType = 'application/toml'
    } else {
      content = this.generateEnvFile(data)
      mimeType = 'text/plain'
    }

    // Browser environment with File System Access API
    const hasWindow =
      typeof globalThis !== 'undefined' && 'window' in globalThis
    const window = hasWindow ? (globalThis as any).window : undefined

    if (window && 'showSaveFilePicker' in window) {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filePath,
        types: [
          {
            description: 'Configuration file',
            accept: {
              [mimeType]: [filePath.substring(filePath.lastIndexOf('.'))],
            },
          },
        ],
      })

      const writable = await fileHandle.createWritable()
      await writable.write(content)
      await writable.close()
    } else {
      const fs = await import('fs')
      fs.writeFileSync(filePath, content, 'utf8')
    }
  }

  private parseEnvFile(content: string): Record<string, any> {
    const result: Record<string, any> = {}

    content.split('\n').forEach(line => {
      line = line.trim()
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=')
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1)
          }
          result[key.trim()] = value
        }
      }
    })

    return result
  }

  private generateEnvFile(data: Record<string, any>): string {
    return Object.entries(data)
      .map(([key, value]) => {
        const stringValue = String(value)
        return `${key}=${stringValue.includes(' ') ? `"${stringValue}"` : stringValue}`
      })
      .join('\n')
  }
}
