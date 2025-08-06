import { loadConfig } from 'unconfig'
import { resolve } from 'node:path'
import type {
  SafenvConfig,
  SafenvOptions,
  SafenvContext,
  SafenvPlugin,
  SafenvPluginConfig,
} from './types.ts'
import { DependencyResolver } from './dependency-resolver.ts'

export class SafenvCore {
  private config: SafenvConfig | null = null
  protected options: SafenvOptions
  private dependencyResolver: DependencyResolver

  constructor(options: SafenvOptions = {}) {
    this.options = {
      mode: 'serve',
      configFile: 'safenv.config',
      outputDir: './dist',
      watch: true,
      ...options,
    }
    this.dependencyResolver = new DependencyResolver()
  }

  async loadConfig(): Promise<SafenvConfig> {
    let files: string[]

    if (this.options.configFile) {
      // If a specific config file is provided, use it directly
      files = [this.options.configFile]
    } else {
      // Otherwise, search for default config files
      files = [
        'safenv.config.ts',
        'safenv.config.js',
        'safenv.config.json',
        'safenv.config.yaml',
        'safenv.config.yml',
      ]
    }

    const { config } = await loadConfig<SafenvConfig>({
      sources: [
        {
          files,
        },
      ],
      defaults: {
        name: 'safenv',
        variables: {},
        plugins: [],
      },
    })

    if (!config) {
      throw new Error('No safenv config found')
    }

    this.config = config
    return config
  }

  private async loadPlugin(
    pluginConfig: SafenvPluginConfig
  ): Promise<SafenvPlugin> {
    const { GenFilePlugin } = await import('./plugins/genFile.ts')
    const { GenTsPlugin } = await import('./plugins/genTs.ts')

    const pluginMap: Record<string, new (options?: any) => SafenvPlugin> = {
      genFilePlugin: GenFilePlugin,
      genTsPlugin: GenTsPlugin,
    }

    const PluginClass = pluginMap[pluginConfig.name]
    if (!PluginClass) {
      throw new Error(`Unknown plugin: ${pluginConfig.name}`)
    }

    return new PluginClass(pluginConfig.options)
  }

  private async resolvePlugins(
    plugins: (SafenvPlugin | SafenvPluginConfig)[]
  ): Promise<SafenvPlugin[]> {
    const resolvedPlugins: SafenvPlugin[] = []

    for (const plugin of plugins) {
      if ('apply' in plugin) {
        resolvedPlugins.push(plugin)
      } else {
        const resolvedPlugin = await this.loadPlugin(plugin)
        resolvedPlugins.push(resolvedPlugin)
      }
    }

    return resolvedPlugins
  }

  async resolveVariables(config: SafenvConfig): Promise<Record<string, any>> {
    let allVariables = config.variables

    // Auto-discover dependencies if enabled
    if (config.autoDependencies) {
      const dependencyConfigs =
        await this.dependencyResolver.discoverDependencies()
      allVariables = this.dependencyResolver.mergeDependencyVariables(
        config.variables,
        dependencyConfigs
      )
    }

    const resolved: Record<string, any> = {}

    for (const [key, variable] of Object.entries(allVariables)) {
      let value = process.env[key] ?? variable.default

      if (variable.required && value === undefined) {
        throw new Error(`Required variable ${key} is not set`)
      }

      if (value !== undefined) {
        value = this.parseValue(value, variable.type)

        if (variable.validate) {
          const result = variable.validate(value)
          if (result !== true) {
            throw new Error(`Validation failed for ${key}: ${result}`)
          }
        }
      }

      resolved[key] = value
    }

    return resolved
  }

  private parseValue(value: any, type: string): any {
    if (typeof value === 'string') {
      switch (type) {
        case 'number':
          return Number(value)
        case 'boolean':
          return value.toLowerCase() === 'true'
        case 'array':
          return value.split(',').map(v => v.trim())
        case 'object':
          return JSON.parse(value)
        default:
          return value
      }
    }
    return value
  }

  async run(): Promise<void> {
    const config = await this.loadConfig()
    const resolvedVariables = await this.resolveVariables(config)
    const resolvedPlugins = await this.resolvePlugins(config.plugins || [])

    const context: SafenvContext = {
      config,
      resolvedVariables,
      mode: this.options.mode!,
      outputDir: resolve(this.options.outputDir!),
    }

    for (const plugin of resolvedPlugins) {
      await plugin.apply(context)
    }
  }
}
