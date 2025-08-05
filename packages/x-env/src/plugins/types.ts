import type { SafenvContext } from '../types.ts'

export interface SafenvPlugin {
  name: string
  apply: (context: SafenvContext) => Promise<void> | void
  cleanup?: () => Promise<void> | void
}

export interface SafenvPluginConfig {
  name: string
  options?: any
}

export interface GenFilePluginOptions {
  name: string
  formats: Array<'env' | 'json' | 'yaml' | 'toml'>
  outputDir?: string
  webUi?: {
    enabled: boolean
    port?: number
    host?: string
  }
  htmlTools?: {
    enabled: boolean
    outputPath?: string
  }
}

export interface ImportExportAdapter {
  import: (filePath: string) => Promise<Record<string, any>>
  export: (filePath: string, data: Record<string, any>) => Promise<void>
}

export interface WebUiOptions {
  enabled: boolean
  port?: number
  host?: string
}

export interface HtmlToolsOptions {
  enabled: boolean
  outputPath?: string
}

export interface GenTsPluginOptions {
  outputPath: string
  validatorName?: string
  exportValidator?: boolean
  validatorStyle: 'zod' | 'pure' | 'none'
  exportMode?:
    | 'process.env'
    | 'process.env-static'
    | 'env-file'
    | 'json-file'
    | 'yaml-file'
    | 'toml-file'
  exportType?: 'named' | 'default' | 'object'
  exportName?: string
  customDeps?: string[]
  customInjectCode?: string[]
}
