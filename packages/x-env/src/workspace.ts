import { resolve, dirname } from 'node:path'
import { SafenvCore } from './core.ts'
import type { SafenvOptions, SafenvConfig } from './types.ts'

export interface WorkspaceConfig {
  workspace: string[]
  [key: string]: any
}

export class SafenvWorkspace {
  private workspaceConfig: WorkspaceConfig | null = null
  private options: SafenvOptions

  constructor(options: SafenvOptions = {}) {
    this.options = options
  }

  async loadWorkspace(): Promise<SafenvConfig[]> {
    const { loadConfig } = await import('unconfig')

    const { config } = await loadConfig<WorkspaceConfig>({
      sources: [
        {
          files: [
            `${this.options.configFile || 'safenv.config'}.ts`,
            `${this.options.configFile || 'safenv.config'}.js`,
            `${this.options.configFile || 'safenv.config'}.json`,
            `${this.options.configFile || 'safenv.config'}.yaml`,
            `${this.options.configFile || 'safenv.config'}.yml`,
          ],
        },
      ],
    })

    if (!config || !config.workspace) {
      throw new Error('No workspace configuration found')
    }

    this.workspaceConfig = config
    const configs: SafenvConfig[] = []

    for (const workspacePath of config.workspace) {
      const fullPath = resolve(workspacePath)
      const safenv = new SafenvCore({
        ...this.options,
        configFile: resolve(fullPath, 'safenv.config'),
      })

      try {
        const workspaceConfig = await safenv.loadConfig()
        configs.push(workspaceConfig)
      } catch (error) {
        console.warn(`Failed to load workspace config at ${fullPath}:`, error)
      }
    }

    return configs
  }

  async runWorkspace(): Promise<void> {
    const configs = await this.loadWorkspace()

    for (const config of configs) {
      const safenv = new SafenvCore({
        ...this.options,
        configFile: resolve(
          dirname(config.name || 'safenv.config'),
          'safenv.config'
        ),
      })

      await safenv.run()
    }
  }
}
