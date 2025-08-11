import type { SafenvContext } from '../types.ts'

/**
 * 完整的插件生命周期阶段 - 专门为环境变量管理设计
 */
export type PluginPhase =
  | 'beforeLoad' // 配置文件加载前，可以预处理配置路径
  | 'afterLoad' // 配置文件加载后，可以修改配置内容
  | 'beforeResolve' // 在解析环境变量之前，可以修改配置
  | 'afterResolve' // 解析完成后，可以验证和转换变量
  | 'beforeGenerate' // 在生成文件之前，最后的处理机会
  | 'afterGenerate' // 生成文件之后，可以做额外的文件操作
  | 'onError' // 错误处理阶段
  | 'onWarning' // 警告处理阶段
  | 'cleanup' // 清理阶段

/**
 * 插件执行上下文 - 提供实用工具
 */
export interface PluginContext {
  /** 发出警告信息 */
  warn(message: string): void
  /** 发出错误信息并停止执行 */
  error(message: string): never
  /** 生成额外的文件 */
  emitFile(fileName: string, content: string): void
  /** 获取已生成的文件列表 */
  getEmittedFiles(): Array<{ fileName: string; content: string }>
  /** 插件间共享的缓存 */
  cache: Map<string, any>
  /** 插件间共享的元数据 */
  meta: Record<string, any>

  // === 增强的调试和错误处理功能 ===

  /** 输出调试信息（仅在调试模式下显示） */
  debug(message: string, data?: any): void
  /** 创建执行追踪点 */
  trace(label: string): void
  /** 获取当前调用堆栈 */
  getStackTrace(): string
  /** 创建检查点，用于错误恢复 */
  createCheckpoint(): string
  /** 回滚到指定检查点 */
  rollbackToCheckpoint(checkpointId: string): void
  /** 获取当前执行的插件名称 */
  getCurrentPlugin(): string
  /** 获取当前执行阶段 */
  getCurrentPhase(): PluginPhase
}

/**
 * Safenv 插件接口 - 简洁而强大
 */
export interface SafenvPlugin {
  /** 插件名称，必须唯一 */
  name: string

  /** 插件运行模式限制 */
  mode?: 'serve' | 'build'

  /** 插件标签，用于分类和查找 */
  tags?: string[]

  // === 生命周期钩子 ===

  /**
   * 在配置文件加载之前执行
   * 可以预处理配置路径、设置环境变量等
   */
  beforeLoad?(this: PluginContext, configPath: string): void | Promise<void>

  /**
   * 在配置文件加载之后执行
   * 可以修改配置内容、添加默认配置等
   * 返回新的配置对象会替换原有配置
   */
  afterLoad?(
    this: PluginContext,
    config: SafenvContext['config']
  ): SafenvContext['config'] | void | Promise<SafenvContext['config'] | void>

  /**
   * 在解析环境变量之前执行
   * 可以修改配置、添加默认值等
   */
  beforeResolve?(
    this: PluginContext,
    context: SafenvContext
  ): void | Promise<void>

  /**
   * 在环境变量解析完成后执行
   * 可以验证、转换、添加计算属性
   * 返回新的变量对象会替换原有变量
   */
  afterResolve?(
    this: PluginContext,
    variables: Record<string, any>,
    context: SafenvContext
  ): Record<string, any> | void | Promise<Record<string, any> | void>

  /**
   * 在生成文件之前执行
   * 最后的处理机会，可以生成额外文件
   */
  beforeGenerate?(
    this: PluginContext,
    context: SafenvContext
  ): void | Promise<void>

  /**
   * 在文件生成完成后执行
   * 可以做后处理，如文档生成、通知等
   */
  afterGenerate?(
    this: PluginContext,
    context: SafenvContext
  ): void | Promise<void>

  /**
   * 错误处理钩子
   * 当插件执行过程中发生错误时调用
   * 可以进行错误恢复、日志记录等
   */
  onError?(
    this: PluginContext,
    error: SafenvError,
    phase: PluginPhase
  ): void | Promise<void>

  /**
   * 警告处理钩子
   * 当插件执行过程中发生警告时调用
   * 可以进行警告处理、统计等
   */
  onWarning?(
    this: PluginContext,
    warning: string,
    phase: PluginPhase
  ): void | Promise<void>

  /**
   * 清理阶段
   * 释放资源、清理临时文件等
   */
  cleanup?(this: PluginContext): void | Promise<void>
}

/**
 * 增强的错误接口
 */
export interface SafenvError extends Error {
  /** 发生错误的阶段 */
  phase: PluginPhase
  /** 发生错误的插件名称 */
  plugin?: string
  /** 错误发生时的上下文 */
  context?: SafenvContext
  /** 错误修复建议 */
  suggestions?: string[]
  /** 是否可恢复的错误 */
  recoverable: boolean
  /** 错误代码 */
  code?: string
  /** 原始错误对象 */
  originalError?: Error
}

/**
 * 插件执行结果
 */
export interface PluginExecutionResult {
  plugin: SafenvPlugin
  phase: PluginPhase
  duration: number
  success: boolean
  error?: SafenvError
  warnings: string[]
  emittedFiles: Array<{ fileName: string; content: string }>
  /** 执行时的检查点 */
  checkpoints: string[]
  /** 调试信息 */
  debugInfo: Array<{ timestamp: number; message: string; data?: any }>
}

/**
 * 插件管理器 - 负责插件的注册、排序和执行
 */
export class PluginManager {
  private plugins: SafenvPlugin[] = []
  private context: PluginContext
  private results: PluginExecutionResult[] = []

  constructor() {
    this.context = this.createPluginContext()
  }

  private createPluginContext(): PluginContext {
    const emittedFiles: Array<{ fileName: string; content: string }> = []
    const warnings: string[] = []
    const debugInfo: Array<{ timestamp: number; message: string; data?: any }> =
      []
    const checkpoints: Map<string, any> = new Map()
    const traces: Array<{ label: string; timestamp: number }> = []

    let currentPlugin = ''
    let currentPhase: PluginPhase = 'beforeLoad'
    let debugMode = process.env.SAFENV_DEBUG === 'true'

    return {
      warn: (message: string) => {
        const warning = `[${currentPlugin}:${currentPhase}] ${message}`
        warnings.push(warning)
        console.warn(`⚠️ Plugin Warning: ${warning}`)
      },
      error: (message: string): never => {
        const error = `[${currentPlugin}:${currentPhase}] ${message}`
        console.error(`❌ Plugin Error: ${error}`)
        throw new Error(error)
      },
      emitFile: (fileName: string, content: string) => {
        emittedFiles.push({ fileName, content })
      },
      getEmittedFiles: () => [...emittedFiles],
      cache: new Map<string, any>(),
      meta: {},

      // 新增的调试和错误处理功能
      debug: (message: string, data?: any) => {
        const debugEntry = {
          timestamp: Date.now(),
          message: `[${currentPlugin}:${currentPhase}] ${message}`,
          data,
        }
        debugInfo.push(debugEntry)

        if (debugMode) {
          console.debug(`🐛 Debug: ${debugEntry.message}`, data || '')
        }
      },

      trace: (label: string) => {
        const trace = {
          label: `[${currentPlugin}:${currentPhase}] ${label}`,
          timestamp: Date.now(),
        }
        traces.push(trace)

        if (debugMode) {
          console.trace(`📍 Trace: ${trace.label}`)
        }
      },

      getStackTrace: () => {
        const stack = new Error().stack || ''
        return stack
      },

      createCheckpoint: () => {
        const checkpointId = `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        checkpoints.set(checkpointId, {
          plugin: currentPlugin,
          phase: currentPhase,
          timestamp: Date.now(),
          cache: new Map(this.context.cache),
          meta: { ...this.context.meta },
        })
        return checkpointId
      },

      rollbackToCheckpoint: (checkpointId: string) => {
        const checkpoint = checkpoints.get(checkpointId)
        if (!checkpoint) {
          throw new Error(`Checkpoint ${checkpointId} not found`)
        }

        // 恢复状态
        this.context.cache.clear()
        checkpoint.cache.forEach((value: any, key: string) => {
          this.context.cache.set(key, value)
        })
        this.context.meta = { ...checkpoint.meta }

        if (debugMode) {
          console.log(`🔄 Rolled back to checkpoint: ${checkpointId}`)
        }
      },

      getCurrentPlugin: () => currentPlugin,
      getCurrentPhase: () => currentPhase,

      // 内部方法，用于设置当前执行状态
      _setCurrentExecution: (plugin: string, phase: PluginPhase) => {
        currentPlugin = plugin
        currentPhase = phase
      },

      // 获取调试信息
      _getDebugInfo: () => [...debugInfo],
      _getTraces: () => [...traces],
      _getCheckpoints: () => Array.from(checkpoints.keys()),
    } as PluginContext & {
      _setCurrentExecution: (plugin: string, phase: PluginPhase) => void
      _getDebugInfo: () => Array<{
        timestamp: number
        message: string
        data?: any
      }>
      _getTraces: () => Array<{ label: string; timestamp: number }>
      _getCheckpoints: () => string[]
    }
  }

  /**
   * 注册插件
   */
  register(plugin: SafenvPlugin): void {
    // 检查插件名称唯一性
    if (this.plugins.some(p => p.name === plugin.name)) {
      throw new Error(`Plugin with name "${plugin.name}" already registered`)
    }

    this.plugins.push(plugin)
  }

  /**
   * 批量注册插件
   */
  registerAll(plugins: SafenvPlugin[]): void {
    for (const plugin of plugins) {
      this.register(plugin)
    }
  }

  /**
   * 执行指定阶段的所有插件
   */
  async executePhase(
    phase: PluginPhase,
    context: SafenvContext,
    data?: any
  ): Promise<any> {
    let result = data

    for (const plugin of this.plugins) {
      // 检查插件是否应该在当前模式下运行
      if (plugin.mode) {
        // 简化 mode 检查，移除 context.mode 依赖
        continue
      }

      const hook = plugin[phase]
      if (!hook) continue

      const startTime = Date.now()
      const warnings: string[] = []
      const emittedFiles: Array<{ fileName: string; content: string }> = []
      const debugInfo: Array<{
        timestamp: number
        message: string
        data?: any
      }> = []
      const checkpoints: string[] = []

      try {
        // 设置当前执行状态
        const extendedContext = this.context as any
        if (extendedContext._setCurrentExecution) {
          extendedContext._setCurrentExecution(plugin.name, phase)
        }

        // 创建插件专用的上下文
        const pluginContext: PluginContext = {
          ...this.context,
          warn: (message: string) => {
            const warning = `[${plugin.name}] ${message}`
            warnings.push(warning)
            console.warn(`⚠️ ${warning}`)

            // 触发 onWarning 钩子
            this.triggerWarningHooks(warning, phase, plugin)
          },
          error: (message: string): never => {
            const error = this.createSafenvError(
              message,
              phase,
              plugin.name,
              context
            )
            console.error(`❌ ${error.message}`)
            throw error
          },
          emitFile: (fileName: string, content: string) => {
            emittedFiles.push({ fileName, content })
            this.context.emitFile(fileName, content)
          },
        }

        // 执行插件钩子
        let hookResult: any

        // 根据不同的钩子类型执行不同的逻辑
        switch (phase) {
          case 'beforeLoad':
            const beforeLoadHook = hook as NonNullable<
              SafenvPlugin['beforeLoad']
            >
            hookResult = await beforeLoadHook.call(
              pluginContext,
              data as string
            )
            break

          case 'afterLoad':
            const afterLoadHook = hook as NonNullable<SafenvPlugin['afterLoad']>
            hookResult = await afterLoadHook.call(
              pluginContext,
              data || context.config
            )
            break

          case 'afterResolve':
            const afterResolveHook = hook as NonNullable<
              SafenvPlugin['afterResolve']
            >
            hookResult = await afterResolveHook.call(
              pluginContext,
              result || context.resolvedVariables,
              context
            )
            break

          case 'onError':
            const onErrorHook = hook as NonNullable<SafenvPlugin['onError']>
            hookResult = await onErrorHook.call(
              pluginContext,
              data as SafenvError,
              phase
            )
            break

          case 'onWarning':
            const onWarningHook = hook as NonNullable<SafenvPlugin['onWarning']>
            hookResult = await onWarningHook.call(
              pluginContext,
              data as string,
              phase
            )
            break

          default:
            // 其他钩子只需要 context 参数
            const otherHook = hook as (
              this: PluginContext,
              context: SafenvContext
            ) => any
            hookResult = await otherHook.call(pluginContext, context)
            break
        }

        // 如果是转换类型的钩子，更新结果
        if (hookResult !== null && hookResult !== undefined) {
          result = hookResult
        }

        // 收集调试信息
        if (extendedContext._getDebugInfo) {
          debugInfo.push(...extendedContext._getDebugInfo())
        }
        if (extendedContext._getCheckpoints) {
          checkpoints.push(...extendedContext._getCheckpoints())
        }

        // 记录执行结果
        this.results.push({
          plugin,
          phase,
          duration: Date.now() - startTime,
          success: true,
          warnings,
          emittedFiles,
          checkpoints,
          debugInfo,
        })
      } catch (error) {
        const safenvError =
          error instanceof Error && 'phase' in error
            ? (error as SafenvError)
            : this.createSafenvError(
                error instanceof Error ? error.message : String(error),
                phase,
                plugin.name,
                context,
                error as Error
              )

        this.results.push({
          plugin,
          phase,
          duration: Date.now() - startTime,
          success: false,
          error: safenvError,
          warnings,
          emittedFiles,
          checkpoints,
          debugInfo,
        })

        // 触发错误处理钩子
        await this.triggerErrorHooks(safenvError, phase)

        throw safenvError
      }
    }

    return result
  }

  /**
   * 创建增强的错误对象
   */
  private createSafenvError(
    message: string,
    phase: PluginPhase,
    pluginName: string,
    context: SafenvContext,
    originalError?: Error
  ): SafenvError {
    const error = new Error(message) as SafenvError
    error.phase = phase
    error.plugin = pluginName
    error.context = context
    error.originalError = originalError
    error.recoverable = this.isRecoverableError(phase, message)
    error.suggestions = this.generateErrorSuggestions(phase, message)
    error.code = this.generateErrorCode(phase, pluginName)

    return error
  }

  /**
   * 判断错误是否可恢复
   */
  private isRecoverableError(phase: PluginPhase, message: string): boolean {
    // 配置加载阶段的错误通常不可恢复
    if (phase === 'beforeLoad' || phase === 'afterLoad') {
      return false
    }

    // 包含特定关键词的错误可能可恢复
    const recoverableKeywords = ['validation', 'format', 'transform', 'warning']
    return recoverableKeywords.some(keyword =>
      message.toLowerCase().includes(keyword)
    )
  }

  /**
   * 生成错误修复建议
   */
  private generateErrorSuggestions(
    phase: PluginPhase,
    message: string
  ): string[] {
    const suggestions: string[] = []

    switch (phase) {
      case 'beforeLoad':
        suggestions.push('检查配置文件路径是否正确')
        suggestions.push('确保配置文件具有读取权限')
        break
      case 'afterLoad':
        suggestions.push('检查配置文件格式是否正确')
        suggestions.push('验证必需的配置项是否存在')
        break
      case 'beforeResolve':
      case 'afterResolve':
        suggestions.push('检查环境变量定义是否正确')
        suggestions.push('验证变量类型和约束条件')
        break
      case 'beforeGenerate':
      case 'afterGenerate':
        suggestions.push('检查输出目录是否存在且可写')
        suggestions.push('验证文件模板是否正确')
        break
    }

    // 基于错误消息添加特定建议
    if (message.includes('permission')) {
      suggestions.push('检查文件权限设置')
    }
    if (message.includes('not found')) {
      suggestions.push('确认文件或目录是否存在')
    }

    return suggestions
  }

  /**
   * 生成错误代码
   */
  private generateErrorCode(phase: PluginPhase, pluginName: string): string {
    const phaseCode = phase
      .toUpperCase()
      .replace(/([A-Z])/g, '_$1')
      .substring(1)
    return `SAFENV_${phaseCode}_${pluginName.toUpperCase()}_ERROR`
  }

  /**
   * 触发错误处理钩子
   */
  private async triggerErrorHooks(
    error: SafenvError,
    currentPhase: PluginPhase
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onError && plugin.name !== error.plugin) {
        try {
          const extendedContext = this.context as any
          if (extendedContext._setCurrentExecution) {
            extendedContext._setCurrentExecution(plugin.name, 'onError')
          }

          await plugin.onError.call(this.context, error, currentPhase)
        } catch (hookError) {
          console.error(
            `Error in onError hook for plugin ${plugin.name}:`,
            hookError
          )
        }
      }
    }
  }

  /**
   * 触发警告处理钩子
   */
  private async triggerWarningHooks(
    warning: string,
    currentPhase: PluginPhase,
    sourcePlugin: SafenvPlugin
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onWarning && plugin.name !== sourcePlugin.name) {
        try {
          const extendedContext = this.context as any
          if (extendedContext._setCurrentExecution) {
            extendedContext._setCurrentExecution(plugin.name, 'onWarning')
          }

          await plugin.onWarning.call(this.context, warning, currentPhase)
        } catch (hookError) {
          console.error(
            `Error in onWarning hook for plugin ${plugin.name}:`,
            hookError
          )
        }
      }
    }
  }

  /**
   * 获取所有插件执行结果
   */
  getResults(): PluginExecutionResult[] {
    return [...this.results]
  }

  /**
   * 清空执行结果
   */
  clearResults(): void {
    this.results = []
  }

  /**
   * 获取所有插件生成的文件
   */
  getAllEmittedFiles(): Array<{
    fileName: string
    content: string
    plugin: string
  }> {
    return this.results.flatMap(result =>
      result.emittedFiles.map(file => ({
        ...file,
        plugin: result.plugin.name,
      }))
    )
  }

  /**
   * 按标签查找插件
   */
  getPluginsByTag(tag: string): SafenvPlugin[] {
    return this.plugins.filter(plugin => plugin.tags?.includes(tag))
  }

  /**
   * 按名称查找插件
   */
  getPlugin(name: string): SafenvPlugin | undefined {
    return this.plugins.find(plugin => plugin.name === name)
  }
}

/**
 * 创建插件的工具函数
 */
export function definePlugin(plugin: SafenvPlugin): SafenvPlugin {
  return plugin
}

/**
 * 创建简单的文件生成插件
 */
export function createFilePlugin(
  name: string,
  fileName: string,
  generator: (context: SafenvContext) => string,
  options: { mode?: 'serve' | 'build' } = {}
): SafenvPlugin {
  return definePlugin({
    name,
    mode: options.mode,
    tags: ['file-generator'],
    beforeGenerate(context) {
      const content = generator(context)
      this.emitFile(fileName, content)
    },
  })
}

/**
 * 创建变量转换插件
 */
export function createTransformPlugin(
  name: string,
  transformer: (
    variables: Record<string, any>,
    context: SafenvContext
  ) => Record<string, any>,
  options: { mode?: 'serve' | 'build' } = {}
): SafenvPlugin {
  return definePlugin({
    name,
    mode: options.mode,
    tags: ['transformer'],
    afterResolve(variables, context) {
      return transformer(variables, context)
    },
  })
}

/**
 * 创建验证插件
 */
export function createValidationPlugin(
  name: string,
  validator: (variables: Record<string, any>, context: SafenvContext) => void,
  options: { mode?: 'serve' | 'build' } = {}
): SafenvPlugin {
  return definePlugin({
    name,
    mode: options.mode,
    tags: ['validator'],
    afterResolve(variables, context) {
      validator(variables, context)
    },
  })
}
