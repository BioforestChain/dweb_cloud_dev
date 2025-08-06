import type { SafenvContext } from '../types.ts'

/**
 * 简化的插件生命周期阶段 - 专门为环境变量管理设计
 */
export type PluginPhase =
  | 'beforeResolve' // 在解析环境变量之前，可以修改配置
  | 'afterResolve' // 解析完成后，可以验证和转换变量
  | 'beforeGenerate' // 在生成文件之前，最后的处理机会
  | 'afterGenerate' // 生成文件之后，可以做额外的文件操作
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
   * 清理阶段
   * 释放资源、清理临时文件等
   */
  cleanup?(this: PluginContext): void | Promise<void>
}

/**
 * 插件执行结果
 */
export interface PluginExecutionResult {
  plugin: SafenvPlugin
  phase: PluginPhase
  duration: number
  success: boolean
  error?: Error
  warnings: string[]
  emittedFiles: Array<{ fileName: string; content: string }>
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

    return {
      warn: (message: string) => {
        warnings.push(message)
        console.warn(`⚠️ Plugin Warning: ${message}`)
      },
      error: (message: string): never => {
        console.error(`❌ Plugin Error: ${message}`)
        throw new Error(message)
      },
      emitFile: (fileName: string, content: string) => {
        emittedFiles.push({ fileName, content })
      },
      getEmittedFiles: () => [...emittedFiles],
      cache: new Map<string, any>(),
      meta: {},
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
      if (plugin.mode && plugin.mode !== context.mode) {
        continue
      }

      const hook = plugin[phase]
      if (!hook) continue

      const startTime = Date.now()
      const warnings: string[] = []
      const emittedFiles: Array<{ fileName: string; content: string }> = []

      try {
        // 创建插件专用的上下文
        const pluginContext: PluginContext = {
          ...this.context,
          warn: (message: string) => {
            const warning = `[${plugin.name}] ${message}`
            warnings.push(warning)
            console.warn(`⚠️ ${warning}`)
          },
          error: (message: string): never => {
            const error = `[${plugin.name}] ${message}`
            console.error(`❌ ${error}`)
            throw new Error(error)
          },
          emitFile: (fileName: string, content: string) => {
            emittedFiles.push({ fileName, content })
            this.context.emitFile(fileName, content)
          },
        }

        // 执行插件钩子
        let hookResult: any
        if (phase === 'afterResolve') {
          // afterResolve 钩子需要两个参数：variables 和 context
          const afterResolveHook = hook as NonNullable<
            SafenvPlugin['afterResolve']
          >
          hookResult = await afterResolveHook.call(
            pluginContext,
            result || context.resolvedVariables,
            context
          )
        } else {
          // 其他钩子只需要 context 参数
          const otherHook = hook as (
            this: PluginContext,
            context: SafenvContext
          ) => any
          hookResult = await otherHook.call(pluginContext, context)
        }

        // 如果是转换类型的钩子，更新结果
        if (hookResult !== null && hookResult !== undefined) {
          result = hookResult
        }

        // 记录执行结果
        this.results.push({
          plugin,
          phase,
          duration: Date.now() - startTime,
          success: true,
          warnings,
          emittedFiles,
        })
      } catch (error) {
        this.results.push({
          plugin,
          phase,
          duration: Date.now() - startTime,
          success: false,
          error: error as Error,
          warnings,
          emittedFiles,
        })
        throw error
      }
    }

    return result
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
