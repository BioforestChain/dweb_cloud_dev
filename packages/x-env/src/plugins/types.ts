// 重新导出新的插件系统
export type {
  SafenvPlugin,
  PluginContext,
  PluginPhase,
  PluginExecutionResult,
} from './plugin-system.ts'
export {
  PluginManager,
  definePlugin,
  createFilePlugin,
  createTransformPlugin,
  createValidationPlugin,
} from './plugin-system.ts'

// 插件配置接口
export interface SafenvPluginConfig {
  name: string
  options?: any
}

export interface GenFilePluginOptions {
  name: string
  formats: Array<'env' | 'json' | 'yaml' | 'toml'>
  outputDir?: string
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
  envFilePath?: string
  customDeps?: string[]
  customInjectCode?: string[]
}
