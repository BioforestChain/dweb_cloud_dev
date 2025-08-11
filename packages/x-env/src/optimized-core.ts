import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import {
  SafenvConfig,
  SafenvContext,
  SafenvResolvedValue,
  SafenvVariable,
} from './types.ts'
import { DependencyResolver } from './dependency-resolver.ts'
import { PluginManager } from './plugins/plugin-system.ts'
import {
  PerformanceManager,
  type PerformanceOptions,
  type TaskType,
} from './performance-manager.ts'
import { EnhancedDependencyResolver } from './enhanced-dependency-resolver.ts'
import { EnhancedVariableResolver } from './enhanced-variable-resolver.ts'
import { HotReloadManager } from './hot-reload-manager.ts'

/**
 * 优化的核心解析器选项
 */
export interface OptimizedCoreOptions {
  /** 性能优化选项 */
  performance?: PerformanceOptions
  /** 是否启用增强的依赖解析器 */
  useEnhancedDependencyResolver?: boolean
  /** 是否启用增强的变量解析器 */
  useEnhancedVariableResolver?: boolean
  /** 是否启用热更新 */
  enableHotReload?: boolean
  /** 热更新选项 */
  hotReloadOptions?: {
    debounceMs?: number
    maxSnapshots?: number
    autoRollback?: boolean
  }
  /** 输出目录 */
  outputDir?: string
}

/**
 * 解析结果
 */
export interface OptimizedResolveResult {
  variables: Record<string, any>
  context: SafenvContext & {
    variables?: any
    dependencies?: any
    configPath?: string
  }
  metrics: {
    totalTime: number
    configLoadTime: number
    dependencyResolutionTime: number
    variableResolutionTime: number
    pluginExecutionTime: number
    cacheHitRate: number
    parallelOperationsCount: number
  }
  warnings: string[]
  errors: Error[]
}

/**
 * 优化的 x-env 核心解析器
 * 集成性能优化、缓存、并行处理等功能
 */
export class OptimizedCore {
  private performanceManager: PerformanceManager
  private dependencyResolver: DependencyResolver | EnhancedDependencyResolver
  private variableResolver: EnhancedVariableResolver | null = null
  private pluginManager: PluginManager
  private hotReloadManager: HotReloadManager | null = null
  private options: Required<OptimizedCoreOptions>

  constructor(options: OptimizedCoreOptions = {}) {
    this.options = {
      performance: {},
      useEnhancedDependencyResolver: true,
      useEnhancedVariableResolver: true,
      enableHotReload: false,
      hotReloadOptions: {},
      outputDir: './dist',
      ...options,
    }

    // 初始化性能管理器
    this.performanceManager = new PerformanceManager(this.options.performance)

    // 初始化依赖解析器
    this.dependencyResolver = this.options.useEnhancedDependencyResolver
      ? new EnhancedDependencyResolver()
      : new DependencyResolver()

    // 初始化变量解析器
    if (this.options.useEnhancedVariableResolver) {
      this.variableResolver = new EnhancedVariableResolver()
    }

    // 初始化插件管理器
    this.pluginManager = new PluginManager()

    // 初始化热更新管理器
    if (this.options.enableHotReload) {
      this.hotReloadManager = new HotReloadManager({
        debounceMs: 300,
        onChange: async (changes: any) => this.handleHotReload(changes),
      })
    }
  }

  /**
   * 解析配置文件
   */
  async resolve(configPath: string): Promise<OptimizedResolveResult> {
    const startTime = performance.now()
    const warnings: string[] = []
    const errors: Error[] = []

    try {
      // 使用缓存的配置加载
      const config = await this.performanceManager.cached(
        `config:${configPath}`,
        () => this.loadConfig(configPath),
        { dependencies: [configPath] }
      )

      // 创建上下文
      const context: SafenvContext & {
        variables?: any
        dependencies?: any
        configPath?: string
      } = {
        config,
        resolvedVariables: {} as any,
        root: process.cwd(),
        configFile: 'safenv.config',
        variables: {},
        dependencies: [],
        configPath,
      }

      // 执行 beforeLoad 钩子
      await this.pluginManager.executePhase('beforeLoad', context, configPath)

      // 执行 afterLoad 钩子
      const modifiedConfig = await this.pluginManager.executePhase(
        'afterLoad',
        context,
        config
      )
      if (modifiedConfig) {
        context.config = modifiedConfig
      }

      // 并行执行主要解析任务
      const parallelTasks = [
        {
          id: 'dependency-resolution',
          type: 'config-load' as TaskType,
          fn: () => this.resolveDependencies(context),
        },
        {
          id: 'plugin-beforeResolve',
          type: 'plugin-execution' as TaskType,
          fn: () => this.pluginManager.executePhase('beforeResolve', context),
        },
      ]

      const [dependencyResult] =
        await this.performanceManager.executeParallel(parallelTasks)

      // 合并依赖结果
      if (dependencyResult) {
        context.variables = {
          ...context.variables,
          ...dependencyResult.variables,
        }
        context.dependencies = dependencyResult.dependencies
        warnings.push(...(dependencyResult.warnings || []))
      }

      // 变量解析
      const variableResult = await this.performanceManager.withProfiling(
        'variable-resolution',
        () => this.resolveVariables(context)
      )

      context.variables = { ...context.variables, ...variableResult.variables }
      warnings.push(...(variableResult.warnings || []))

      // 执行插件钩子
      await this.performanceManager.withProfiling(
        'plugin-execution',
        async () => {
          await this.pluginManager.executePhase('afterResolve', context)
          await this.pluginManager.executePhase('beforeGenerate', context)
          await this.pluginManager.executePhase('afterGenerate', context)
        }
      )

      // 启动热更新监听
      if (this.hotReloadManager) {
        await this.hotReloadManager.startWatching(configPath, context.config)
      }

      const totalTime = performance.now() - startTime
      const metrics = this.collectMetrics(totalTime)

      return {
        variables: context.variables,
        context,
        metrics,
        warnings,
        errors,
      }
    } catch (error) {
      errors.push(error as Error)

      // 触发错误钩子
      if (error instanceof Error) {
        await this.pluginManager.executePhase('onError', error as any)
      }

      throw error
    }
  }

  /**
   * 增量更新解析
   */
  async incrementalResolve(
    configPath: string,
    changes: string[]
  ): Promise<OptimizedResolveResult> {
    console.log(
      `🔄 Performing incremental resolve for changes: ${changes.join(', ')}`
    )

    // 检查是否可以进行增量更新
    const canIncremental = await this.canPerformIncrementalUpdate(changes)

    if (!canIncremental) {
      console.log('📦 Full resolve required due to structural changes')
      return this.resolve(configPath)
    }

    // 执行增量更新
    return this.performanceManager.withProfiling('incremental-update', () =>
      this.performIncrementalUpdate(configPath, changes)
    )
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return this.performanceManager.getMetrics()
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.performanceManager.getCacheStats()
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 清理热更新
    if (this.hotReloadManager) {
      await this.hotReloadManager.stopWatching()
    }

    // 清理插件
    if (this.pluginManager) {
      // Plugin cleanup is handled in executePhase('cleanup')
    }

    // 清理缓存
    this.performanceManager.clearCache()

    console.log('🧹 OptimizedCore cleanup completed')
  }

  /**
   * 加载配置文件
   */
  private async loadConfig(configPath: string): Promise<SafenvConfig> {
    const startTime = performance.now()

    try {
      const configContent = await readFile(resolve(configPath), 'utf-8')
      const config = JSON.parse(configContent) as SafenvConfig

      const loadTime = performance.now() - startTime
      console.log(`📄 Config loaded in ${loadTime.toFixed(2)}ms`)

      return config
    } catch (error) {
      console.error(`❌ Failed to load config from ${configPath}:`, error)
      throw error
    }
  }

  /**
   * 解析依赖
   */
  private async resolveDependencies(context: SafenvContext) {
    if (
      this.options.useEnhancedDependencyResolver &&
      this.dependencyResolver instanceof EnhancedDependencyResolver
    ) {
      return await (this.dependencyResolver as any).resolveDependencies(
        context.config,
        {
          performanceManager: this.performanceManager,
          configPath: (context as any).configPath,
        }
      )
    } else {
      const result = await (
        this.dependencyResolver as any
      ).discoverDependencies()
      return {
        variables: result.variables,
        dependencies: result.dependencies,
        warnings: [],
      }
    }
  }

  /**
   * 解析变量
   */
  private async resolveVariables(context: SafenvContext) {
    if (this.variableResolver) {
      return await (this.variableResolver as any).resolveVariables(
        context.config.variables || {},
        {
          performanceManager: this.performanceManager,
          existingVariables: (context as any).variables,
        }
      )
    } else {
      // 回退到基本变量解析
      const variables: Record<string, SafenvResolvedValue<any>> = {}
      const warnings: string[] = []

      for (const [name, variable] of Object.entries(
        context.config.variables || {}
      )) {
        try {
          variables[name] = await this.resolveBasicVariable(variable, context)
        } catch (error) {
          warnings.push(`Failed to resolve variable ${name}: ${error}`)
        }
      }

      return { variables, warnings }
    }
  }

  /**
   * 基本变量解析
   */
  private async resolveBasicVariable(
    variable: SafenvVariable,
    _context: SafenvContext
  ): Promise<SafenvResolvedValue<any>> {
    if (typeof variable === 'string') {
      return variable
    }

    if (typeof variable === 'object' && variable !== null) {
      if ('value' in variable) {
        return variable.value ?? (variable as any).defaultValue ?? ''
      }
      if ('env' in variable && variable.env) {
        return process.env[variable.env] || variable.default || ''
      }
    }

    return ''
  }

  /**
   * 检查是否可以进行增量更新
   */
  private async canPerformIncrementalUpdate(
    changes: string[]
  ): Promise<boolean> {
    // 如果变更涉及插件配置或依赖配置，需要完整重新解析
    const structuralChanges = changes.some(
      change =>
        change.includes('plugins') ||
        change.includes('dependencies') ||
        change.includes('mode')
    )

    return !structuralChanges
  }

  /**
   * 执行增量更新
   */
  private async performIncrementalUpdate(
    configPath: string,
    _changes: string[]
  ): Promise<OptimizedResolveResult> {
    // 这里实现增量更新逻辑
    // 目前简化为完整解析，实际实现中应该只更新变更的部分
    console.log('⚡ Performing optimized incremental update')
    return this.resolve(configPath)
  }

  /**
   * 处理热更新
   */
  private async handleHotReload(changes: {
    configPath: string
    dependencies: string[]
    changeType: 'add' | 'change' | 'unlink'
  }): Promise<void> {
    console.log('🔥 Hot reload triggered:', changes)

    try {
      // 清理相关缓存
      this.performanceManager.clearCache()

      // 执行增量更新
      await this.incrementalResolve(changes.configPath, changes.dependencies)

      console.log('✅ Hot reload completed successfully')
    } catch (error) {
      console.error('❌ Hot reload failed:', error)

      // 如果启用了自动回滚
      if (this.hotReloadManager && this.options.hotReloadOptions.autoRollback) {
        console.log('🔄 Attempting automatic rollback...')
        // Hot reload rollback functionality not implemented yet
        console.warn('Hot reload rollback requested but not implemented')
      }
    }
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(totalTime: number) {
    const performanceMetrics = this.performanceManager.getMetrics()

    return {
      totalTime,
      configLoadTime: performanceMetrics.configLoadTime,
      dependencyResolutionTime:
        performanceMetrics.dependencyResolutionTime || 0,
      variableResolutionTime: performanceMetrics.variableResolutionTime,
      pluginExecutionTime: performanceMetrics.pluginExecutionTime,
      cacheHitRate: performanceMetrics.cacheHitRate,
      parallelOperationsCount:
        performanceMetrics.operationCounts.parallelOperations,
    }
  }
}

/**
 * 创建优化的核心实例
 */
export function createOptimizedCore(
  options?: OptimizedCoreOptions
): OptimizedCore {
  return new OptimizedCore(options)
}

/**
 * 便捷的解析函数
 */
export async function resolveOptimized(
  configPath: string,
  options?: OptimizedCoreOptions
): Promise<OptimizedResolveResult> {
  const core = createOptimizedCore(options)

  try {
    return await core.resolve(configPath)
  } finally {
    await core.cleanup()
  }
}
