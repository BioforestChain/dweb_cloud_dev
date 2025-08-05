import type { SafenvPlugin, SafenvPluginConfig } from './plugins/types.ts'

export interface SafenvVariable {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  default?: any
  required?: boolean
  validate?: (value: any) => boolean | string
}

export interface SafenvConfig {
  name: string
  description?: string
  variables: Record<string, SafenvVariable>
  dependencies?: string[]
  plugins?: (SafenvPlugin | SafenvPluginConfig)[]
  workspace?: string[]
}

export interface SafenvContext {
  config: SafenvConfig
  resolvedVariables: Record<string, any>
  mode: 'serve' | 'build'
  outputDir: string
}

export interface SafenvOptions {
  mode?: 'serve' | 'build'
  configFile?: string
  outputDir?: string
  watch?: boolean
}

// Re-export plugin types for convenience
export type { SafenvPlugin, SafenvPluginConfig } from './plugins/types.ts'
