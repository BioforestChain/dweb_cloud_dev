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
import { EnhancedDependencyResolver } from './enhanced-dependency-resolver.ts'
import { PluginManager } from './plugins/plugin-system.ts'
import { SchemaAdapter } from './schema-adapter.ts'

export class SafenvCore {
  private config: SafenvConfig | null = null
  protected options: SafenvOptions
  private dependencyResolver: DependencyResolver
  private enhancedDependencyResolver: EnhancedDependencyResolver
  private pluginManager: PluginManager

  constructor(options: SafenvOptions = {}) {
    this.options = {
      configFile: 'safenv.config',
      ...options,
    }
    this.dependencyResolver = new DependencyResolver()
    this.enhancedDependencyResolver = new EnhancedDependencyResolver(
      this.options.root
    )
    this.pluginManager = new PluginManager()
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
    const genFileModule = await import('./plugins/genFile.ts')
    const genTsModule = await import('./plugins/genTs.ts')
    const GenFilePlugin = genFileModule.genFilePlugin
    const GenTsPlugin = genTsModule.genTsPlugin

    const pluginMap: Record<string, any> = {
      genFilePlugin: GenFilePlugin,
      genTsPlugin: GenTsPlugin,
      genFile: GenFilePlugin,
      genTs: GenTsPlugin,
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
      // 如果已经是完整的插件对象，直接使用
      if (
        typeof plugin === 'object' &&
        plugin !== null &&
        'name' in plugin &&
        typeof plugin.name === 'string'
      ) {
        // 检查是否是插件实例（有生命周期方法）
        if (
          'afterGenerate' in plugin ||
          'beforeGenerate' in plugin ||
          'afterLoad' in plugin
        ) {
          resolvedPlugins.push(plugin as SafenvPlugin)
        } else {
          // 是插件配置对象，需要加载
          const resolvedPlugin = await this.loadPlugin(
            plugin as SafenvPluginConfig
          )
          resolvedPlugins.push(resolvedPlugin)
        }
      } else {
        // 其他情况，尝试作为配置处理
        const resolvedPlugin = await this.loadPlugin(
          plugin as SafenvPluginConfig
        )
        resolvedPlugins.push(resolvedPlugin)
      }
    }

    return resolvedPlugins
  }

  async resolveVariables(
    config: SafenvConfig,
    context?: SafenvContext
  ): Promise<Record<string, any>> {
    let processedConfig = config

    // 使用增强的依赖解析器处理声明式依赖
    if (config.dependencies) {
      try {
        console.log('🔍 Resolving dependencies...')
        const dependencyGraph =
          await this.enhancedDependencyResolver.resolveDependencies(
            config,
            context
          )

        // 报告冲突和警告
        if (dependencyGraph.conflicts.length > 0) {
          console.warn(
            `⚠️ Found ${dependencyGraph.conflicts.length} dependency conflicts`
          )
          dependencyGraph.conflicts.forEach(conflict => {
            console.warn(
              `  - Variable '${conflict.variable}' conflicts between: ${conflict.dependencies.map(d => d.source).join(', ')}`
            )
          })
        }

        // 合并依赖变量
        processedConfig =
          this.enhancedDependencyResolver.mergeDependencyVariables(
            config,
            dependencyGraph
          )
        console.log(
          `✅ Resolved ${dependencyGraph.resolved.length} dependencies`
        )

        // 在调试模式下显示依赖信息
        if (process.env.SAFENV_DEBUG === 'true') {
          console.log('📋 Dependency resolution order:')
          dependencyGraph.dependencyOrder.forEach((depId, index) => {
            const dep = dependencyGraph.dependencies.get(depId)
            console.log(
              `  ${index + 1}. ${depId} (${dep?.type}): ${dep?.source}`
            )
          })
        }
      } catch (error) {
        console.warn(
          '⚠️ Enhanced dependency resolution failed, falling back to basic resolution:',
          error
        )

        // 回退到基础依赖解析
        if (config.autoDependencies) {
          const dependencyConfigs =
            await this.dependencyResolver.discoverDependencies()
          processedConfig = {
            ...config,
            variables: this.dependencyResolver.mergeDependencyVariables(
              config.variables,
              dependencyConfigs
            ),
          }
        }
      }
    } else if (config.autoDependencies) {
      // 只有自动发现依赖的情况
      const dependencyConfigs =
        await this.dependencyResolver.discoverDependencies()
      processedConfig = {
        ...config,
        variables: this.dependencyResolver.mergeDependencyVariables(
          config.variables,
          dependencyConfigs
        ),
      }
    }

    const resolved: Record<string, any> = {}

    for (const [key, variable] of Object.entries(processedConfig.variables)) {
      let value = process.env[key] ?? variable.default

      if (variable.required && value === undefined) {
        throw new Error(`Required variable ${key} is not set`)
      }

      if (value !== undefined) {
        if (variable.type) {
          value = this.parseValue(value, variable.type)
        }

        if (variable.validate && value !== undefined) {
          const result = variable.validate(value)
          if (result !== true) {
            throw new Error(`Validation failed for ${key}: ${result}`)
          }
        }

        // Standard Schema 验证
        if (variable.schema && value !== undefined) {
          try {
            const standardSchema = SchemaAdapter.adaptToStandardSchema(
              variable.schema
            )
            const schemaResult =
              await standardSchema['~standard'].validate(value)

            if ('issues' in schemaResult && schemaResult.issues) {
              const issues = schemaResult.issues
                .map(issue => issue.message)
                .join(', ')
              throw new Error(`Schema validation failed for ${key}: ${issues}`)
            } else if ('value' in schemaResult) {
              // 使用 schema 验证后的值（可能包含类型转换）
              value = schemaResult.value
            }
          } catch (error) {
            throw new Error(
              `Schema validation error for ${key}: ${error instanceof Error ? error.message : String(error)}`
            )
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
    const configPath = resolve(
      this.options.root || process.cwd(),
      this.options.configFile!
    )

    // Phase 1: beforeLoad - 配置文件加载前的预处理
    await this.pluginManager.executePhase(
      'beforeLoad',
      {} as SafenvContext,
      configPath
    )

    // Load configuration
    const config = await this.loadConfig()

    // Phase 2: afterLoad - 配置文件加载后的处理
    const processedConfig =
      (await this.pluginManager.executePhase(
        'afterLoad',
        {} as SafenvContext,
        config
      )) || config

    // Register all plugins
    const resolvedPlugins = await this.resolvePlugins(
      processedConfig.plugins || []
    )
    this.pluginManager.registerAll(resolvedPlugins)

    const context: SafenvContext = {
      config: processedConfig,
      resolvedVariables: {},
      configFile: this.options.configFile!,
      root: resolve(this.options.root || process.cwd()),
    }

    // Phase 3: beforeResolve - 解析环境变量前的处理
    await this.pluginManager.executePhase('beforeResolve', context)

    // Resolve variables (with context for enhanced dependency resolution)
    const resolvedVariables = await this.resolveVariables(
      processedConfig,
      context
    )

    // Update context with resolved variables
    context.resolvedVariables = resolvedVariables

    // Phase 4: afterResolve - 环境变量解析后的处理和验证
    const finalVariables =
      (await this.pluginManager.executePhase(
        'afterResolve',
        context,
        resolvedVariables
      )) || resolvedVariables
    context.resolvedVariables = finalVariables

    // Phase 5: beforeGenerate - 文件生成前的最终处理
    await this.pluginManager.executePhase('beforeGenerate', context)

    // Phase 6: afterGenerate - 文件生成完成后的处理
    await this.pluginManager.executePhase('afterGenerate', context)

    // Phase 7: cleanup - 清理资源
    await this.pluginManager.executePhase('cleanup', context)

    // Log results if in debug mode
    if (process.env.SAFENV_DEBUG === 'true') {
      this.logExecutionResults()
    }
  }

  /**
   * 记录插件执行结果（调试模式）
   */
  private logExecutionResults(): void {
    const results = this.pluginManager.getResults()
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0)

    console.log('\n📊 Plugin Execution Summary:')
    console.log(`Total execution time: ${totalTime}ms`)

    results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      console.log(
        `${status} ${result.plugin.name} (${result.phase}): ${result.duration}ms`
      )

      if (result.warnings.length > 0) {
        result.warnings.forEach(warning => console.warn(`  ⚠️ ${warning}`))
      }

      if (result.error) {
        console.error(`  ❌ ${result.error.message}`)
        if (result.error.suggestions && result.error.suggestions.length > 0) {
          console.error(
            `  💡 Suggestions: ${result.error.suggestions.join(', ')}`
          )
        }
      }
    })

    const emittedFiles = this.pluginManager.getAllEmittedFiles()
    if (emittedFiles.length > 0) {
      console.log('\n📁 Generated Files:')
      emittedFiles.forEach(file => {
        console.log(`  📄 ${file.fileName} (by ${file.plugin})`)
      })
    }
  }
}
