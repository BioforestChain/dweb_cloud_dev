import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import type { SafenvConfig, SafenvContext, SafenvVariable } from './types.ts'
import { DependencyResolver } from './dependency-resolver.ts'
import { PluginManager } from './plugins/plugin-system.ts'
import {
  PerformanceManager,
  type PerformanceOptions,
  type TaskType,
} from './performance-manager.ts'
import { EnhancedDependencyResolver } from './enhanced-dependency-resolver.ts'
import { EnhancedVariableResolver } from './enhanced-variable-resolver.ts'
import { HotReloadManager, type ConfigChange } from './hot-reload-manager.ts'

/**
 * 优化选项
 */
export interface OptimizedOptions {
  /** 性能优化选项 */
  performance?: PerformanceOptions
  /** 是否使用增强的依赖解析器 */
  useEnhancedDependencyResolver?: boolean
  /** 是否使用增强的变量解析器 */
  useEnhancedVariableResolver?: boolean
  /** 是否启用热更新 */
  enableHotReload?: boolean
  /** 热更新选项 */
  hotReloadOptions?: {
    debounceMs?: number
    onChange?: (changes: ConfigChange[]) => Promise<void>
  }
  /** 输出目录 */
  outputDir?: string
}

/**
 * 扩展的上下文类型
 */
export interface ExtendedSafenvContext extends SafenvContext {
  variables?: Record<string, any>
  dependencies?: string[]
  configPath?: string
}

/**
 * 解析结果
 */
export interface OptimizedResolveResult {
  variables: Record<string, any>
  context: ExtendedSafenvContext
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
 * 优化的核心解析器
 * 集成性能管理、增强解析器、热更新等功能
 */
export class OptimizedCore {
  private performanceManager: PerformanceManager
  private dependencyResolver: DependencyResolver | EnhancedDependencyResolver
  private variableResolver: EnhancedVariableResolver
  private pluginManager: PluginManager
  private hotReloadManager?: HotReloadManager
  private options: Required<OptimizedOptions>

  constructor(options: OptimizedOptions = {}) {
    this.options = {
      performance: {
        enableCache: true,
        enableParallel: true,
        enableProfiling: true,
        // cacheOptions: { ttl: 300000, maxSize: 1000 },
        // parallelOptions: { maxConcurrency: 10 }
      },
      useEnhancedDependencyResolver: true,
      useEnhancedVariableResolver: true,
      enableHotReload: false,
      hotReloadOptions: {
        debounceMs: 300,
      },
      outputDir: './dist',
      ...options,
    }

    // 初始化性能管理器
    this.performanceManager = new PerformanceManager(this.options.performance)

    // 初始化解析器
    if (this.options.useEnhancedDependencyResolver) {
      this.dependencyResolver = new EnhancedDependencyResolver()
    } else {
      this.dependencyResolver = new DependencyResolver()
    }

    this.variableResolver = new EnhancedVariableResolver()
    this.pluginManager = new PluginManager()

    // 初始化热更新管理器
    if (this.options.enableHotReload) {
      this.hotReloadManager = new HotReloadManager({
        debounceDelay: this.options.hotReloadOptions.debounceMs,
        onChange: this.options.hotReloadOptions.onChange,
      })
    }
  }

  /**
   * 解析配置
   */
  async resolve(configPath: string): Promise<OptimizedResolveResult> {
    const startTime = performance.now()
    const warnings: string[] = []
    const errors: Error[] = []

    try {
      // 加载配置
      const configLoadStart = performance.now()
      const config = await (this.performanceManager as any).executeTask(
        'config-load' as TaskType,
        () => this.loadConfig(configPath)
      )
      const configLoadTime = performance.now() - configLoadStart

      // 创建上下文
      const context: ExtendedSafenvContext = {
        config,
        resolvedVariables: {} as any,
        mode:
          process.env.NODE_ENV === 'serve' || process.env.NODE_ENV === 'build'
            ? process.env.NODE_ENV
            : 'build',
        outputDir: this.options.outputDir,
        variables: {},
        dependencies: [],
        configPath,
      }

      // 执行 beforeLoad 钩子
      await this.pluginManager.executePhase('beforeLoad', context, configPath)

      // 执行 afterLoad 钩子
      await this.pluginManager.executePhase('afterLoad', context, config)

      // 解析依赖
      const depResolutionStart = performance.now()
      try {
        const dependencyResult = await this.resolveDependencies(context)
        context.variables = {
          ...context.variables,
          ...dependencyResult.variables,
        }
        context.dependencies = dependencyResult.dependencies
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
        warnings.push(
          `Dependency resolution failed: ${error instanceof Error ? error.message : String(error)}`
        )
      }
      const dependencyResolutionTime = performance.now() - depResolutionStart

      // 解析变量
      const varResolutionStart = performance.now()
      const variableResult = await this.resolveVariables(context)
      context.variables = { ...context.variables, ...variableResult.variables }
      const variableResolutionTime = performance.now() - varResolutionStart

      // 执行插件
      const pluginExecutionStart = performance.now()
      await this.pluginManager.executePhase('beforeResolve', context)
      await this.pluginManager.executePhase('afterResolve', context)
      const pluginExecutionTime = performance.now() - pluginExecutionStart

      // 启动热更新监听
      if (this.hotReloadManager && !this.isHotReloadActive()) {
        await this.startHotReload(configPath, context.dependencies || [])
      }

      return {
        variables: context.variables || {},
        context,
        metrics: {
          totalTime: performance.now() - startTime,
          configLoadTime,
          dependencyResolutionTime,
          variableResolutionTime,
          pluginExecutionTime,
          cacheHitRate: this.performanceManager.getCacheStats().hitRate || 0,
          parallelOperationsCount: (
            this.performanceManager as any
          ).getParallelOperationsCount?.(),
        },
        warnings,
        errors,
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      errors.push(err)

      // 触发错误钩子
      try {
        await this.pluginManager.executePhase('onError', {} as any, err)
      } catch (hookError) {
        console.warn('Error in onError hook:', hookError)
      }

      return {
        variables: {},
        context: {} as ExtendedSafenvContext,
        metrics: {
          totalTime: performance.now() - startTime,
          configLoadTime: 0,
          dependencyResolutionTime: 0,
          variableResolutionTime: 0,
          pluginExecutionTime: 0,
          cacheHitRate: 0,
          parallelOperationsCount: 0,
        },
        warnings,
        errors,
      }
    }
  }

  /**
   * 加载配置文件
   */
  private async loadConfig(configPath: string): Promise<SafenvConfig> {
    const content = await readFile(resolve(configPath), 'utf-8')
    return JSON.parse(content)
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.hotReloadManager) {
      await this.stopHotReload()
    }

    // 清理性能管理器
    this.performanceManager.clearCache()

    // 清理插件管理器（如果有 cleanup 方法）
    if (
      'cleanup' in this.pluginManager &&
      typeof this.pluginManager.cleanup === 'function'
    ) {
      await this.pluginManager.cleanup()
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return this.performanceManager.getMetrics()
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.performanceManager.clearCache()
    this.variableResolver.clearCache()
  }

  /**
   * 解析依赖
   */
  private async resolveDependencies(context: ExtendedSafenvContext): Promise<{
    variables: Record<string, any>
    dependencies: string[]
  }> {
    if (
      this.options.useEnhancedDependencyResolver &&
      'resolveVariables' in this.dependencyResolver
    ) {
      // 使用增强解析器
      const result = await (this.dependencyResolver as any).resolveVariables?.(
        context.config.variables || {},
        {
          configPath: context.configPath,
        }
      )
      return {
        variables: result.variables,
        dependencies: Object.keys(result.variables),
      }
    } else {
      // 使用标准解析器
      const result =
        (await (this.dependencyResolver as any).resolveDependencies?.(
          context.config
        )) || (await this.dependencyResolver.discoverDependencies())
      return {
        variables: result.variables,
        dependencies: result.dependencies,
      }
    }
  }

  /**
   * 解析变量
   */
  private async resolveVariables(context: ExtendedSafenvContext): Promise<{
    variables: Record<string, any>
  }> {
    const result = await this.variableResolver.resolveVariables(
      context.config.variables || {},
      {
        cache: this.options.performance?.enableCache,
        // existingVariables: context.variables
      }
    )

    return {
      variables: result.variables,
    }
  }

  /**
   * 解析单个变量（兼容方法）
   */
  private async resolveVariable(
    name: string,
    variable: SafenvVariable
  ): Promise<any> {
    // 从环境变量获取值
    let value: any = process.env[name]

    // 使用默认值
    if (value === undefined) {
      if ('value' in variable) {
        value = variable.value
      } else if ('default' in variable) {
        value = variable.default
      }
    }

    // 环境变量引用
    if ('env' in variable && variable.env) {
      value = process.env[variable.env] || value
    }

    return value !== undefined ? value : ''
  }

  /**
   * 处理热更新
   */
  private async handleHotReload(changes: ConfigChange[]): Promise<void> {
    try {
      console.log('Hot reload triggered:', changes.length, 'changes')

      // 这里可以实现热更新逻辑
      // 比如重新解析配置、更新变量等
    } catch (error) {
      console.error('Hot reload failed:', error)

      // 尝试回滚
      if (this.hotReloadManager && 'rollback' in this.hotReloadManager) {
        try {
          await (this.hotReloadManager as any).rollback()
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError)
        }
      }
    }
  }

  /**
   * 启动热更新
   */
  private async startHotReload(
    configPath: string,
    dependencies: string[]
  ): Promise<void> {
    if (!this.hotReloadManager) return

    // 如果 HotReloadManager 有 startWatching 方法
    if ('startWatching' in this.hotReloadManager) {
      await (this.hotReloadManager as any).startWatching(
        configPath,
        dependencies
      )
    }
  }

  /**
   * 停止热更新
   */
  private async stopHotReload(): Promise<void> {
    if (!this.hotReloadManager) return

    // 如果 HotReloadManager 有 stopWatching 方法
    if ('stopWatching' in this.hotReloadManager) {
      await this.hotReloadManager.stopWatching()
    }
  }

  /**
   * 检查热更新是否激活
   */
  private isHotReloadActive(): boolean {
    if (!this.hotReloadManager) return false

    // 如果 HotReloadManager 有 isActive 方法
    if ('isActive' in this.hotReloadManager) {
      return (this.hotReloadManager as any).isActive()
    }

    return false
  }
}

/**
 * 便捷函数：使用优化解析器解析配置
 */
export async function resolveOptimized(
  configPath: string,
  options?: OptimizedOptions
): Promise<OptimizedResolveResult> {
  const core = new OptimizedCore(options)
  try {
    return await core.resolve(configPath)
  } finally {
    await core.cleanup()
  }
}
