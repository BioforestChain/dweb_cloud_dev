import type {
  SafenvContext,
  SafenvVariables,
  SafenvResolvedVariables,
} from '../types.ts'

/**
 * Plugin execution phases - inspired by Vite/Rollup lifecycle
 */
export type PluginPhase =
  | 'config' // Modify configuration before processing
  | 'configResolved' // Access final resolved configuration
  | 'buildStart' // Before variable resolution starts
  | 'resolveVariables' // During variable resolution (can modify variables)
  | 'validateVariables' // After resolution, before validation
  | 'transform' // Transform resolved variables
  | 'generateBundle' // Before file generation
  | 'writeBundle' // During file writing
  | 'buildEnd' // After all generation is complete
  | 'closeBundle' // Cleanup phase

/**
 * Plugin hook context - provides utilities and state
 */
export interface PluginHookContext {
  /** Add a warning message */
  warn(message: string, position?: { line?: number; column?: number }): void
  /** Add an error message */
  error(message: string, position?: { line?: number; column?: number }): void
  /** Get plugin by name */
  getPlugin(name: string): SafenvPluginWithLifecycle | undefined
  /** Emit a file to be written */
  emitFile(fileName: string, content: string): void
  /** Get list of emitted files */
  getEmittedFiles(): Array<{ fileName: string; content: string }>
  /** Plugin-specific cache */
  cache: Map<string, any>
  /** Global shared state between plugins */
  meta: Record<string, any>
}

/**
 * Plugin hook function types
 */
export interface PluginHooks<T extends SafenvVariables = SafenvVariables> {
  /** Modify configuration before processing */
  config?: (
    this: PluginHookContext,
    config: SafenvContext<T>['config']
  ) =>
    | SafenvContext<T>['config']
    | null
    | void
    | Promise<SafenvContext<T>['config'] | null | void>

  /** Access final resolved configuration (read-only) */
  configResolved?: (
    this: PluginHookContext,
    config: SafenvContext<T>['config']
  ) => void | Promise<void>

  /** Before variable resolution starts */
  buildStart?: (
    this: PluginHookContext,
    context: SafenvContext<T>
  ) => void | Promise<void>

  /** During variable resolution - can modify variables */
  resolveVariables?: (
    this: PluginHookContext,
    variables: Record<string, any>,
    context: SafenvContext<T>
  ) =>
    | Record<string, any>
    | null
    | void
    | Promise<Record<string, any> | null | void>

  /** After resolution, before validation */
  validateVariables?: (
    this: PluginHookContext,
    variables: SafenvResolvedVariables<T>,
    context: SafenvContext<T>
  ) => void | Promise<void>

  /** Transform resolved variables */
  transform?: (
    this: PluginHookContext,
    variables: SafenvResolvedVariables<T>,
    context: SafenvContext<T>
  ) =>
    | SafenvResolvedVariables<T>
    | null
    | void
    | Promise<SafenvResolvedVariables<T> | null | void>

  /** Before file generation */
  generateBundle?: (
    this: PluginHookContext,
    context: SafenvContext<T>
  ) => void | Promise<void>

  /** During file writing */
  writeBundle?: (
    this: PluginHookContext,
    context: SafenvContext<T>
  ) => void | Promise<void>

  /** After all generation is complete */
  buildEnd?: (
    this: PluginHookContext,
    context: SafenvContext<T>
  ) => void | Promise<void>

  /** Cleanup phase */
  closeBundle?: (this: PluginHookContext) => void | Promise<void>
}

/**
 * Enhanced plugin interface with lifecycle hooks
 */
export interface SafenvPluginWithLifecycle<
  T extends SafenvVariables = SafenvVariables,
> extends PluginHooks<T> {
  /** Plugin name */
  name: string

  /** Plugin execution order (lower numbers execute first) */
  order?: number

  /** Conditional execution */
  apply?: 'serve' | 'build' | ((context: SafenvContext<T>) => boolean)

  /** Plugin dependencies (must execute after these plugins) */
  dependencies?: string[]

  /** Plugin tags for grouping */
  tags?: string[]

  /** Plugin metadata */
  meta?: Record<string, any>

  /** Legacy apply method for backward compatibility */
  legacyApply?: (context: SafenvContext<T>) => Promise<void> | void

  /** Legacy cleanup method for backward compatibility */
  cleanup?: () => Promise<void> | void
}

/**
 * Plugin execution result
 */
export interface PluginExecutionResult {
  plugin: SafenvPluginWithLifecycle
  phase: PluginPhase
  duration: number
  error?: Error
  warnings: string[]
  emittedFiles: Array<{ fileName: string; content: string }>
}

/**
 * Plugin manager for orchestrating plugin execution
 */
export class PluginManager<T extends SafenvVariables = SafenvVariables> {
  private plugins: SafenvPluginWithLifecycle<T>[] = []
  private context: PluginHookContext
  private executionResults: PluginExecutionResult[] = []

  constructor() {
    this.context = this.createHookContext()
  }

  private createHookContext(): PluginHookContext {
    const emittedFiles: Array<{ fileName: string; content: string }> = []
    const warnings: string[] = []
    const errors: string[] = []

    return {
      warn: (
        message: string,
        position?: { line?: number; column?: number }
      ) => {
        const warning = position
          ? `${message} at line ${position.line}, column ${position.column}`
          : message
        warnings.push(warning)
        console.warn(`⚠️ Plugin Warning: ${warning}`)
      },
      error: (
        message: string,
        position?: { line?: number; column?: number }
      ) => {
        const error = position
          ? `${message} at line ${position.line}, column ${position.column}`
          : message
        errors.push(error)
        console.error(`❌ Plugin Error: ${error}`)
      },
      getPlugin: (name: string) => {
        return this.plugins.find(p => p.name === name)
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
   * Add plugin to the manager
   */
  addPlugin(plugin: SafenvPluginWithLifecycle<T>): void {
    this.plugins.push(plugin)
    this.sortPlugins()
  }

  /**
   * Add multiple plugins
   */
  addPlugins(plugins: SafenvPluginWithLifecycle<T>[]): void {
    this.plugins.push(...plugins)
    this.sortPlugins()
  }

  /**
   * Sort plugins by order and dependencies
   */
  private sortPlugins(): void {
    // Sort by order first
    this.plugins.sort((a, b) => (a.order || 0) - (b.order || 0))

    // Then resolve dependencies
    const resolved = new Set<string>()
    const sorted: SafenvPluginWithLifecycle<T>[] = []

    const resolveDependencies = (plugin: SafenvPluginWithLifecycle<T>) => {
      if (resolved.has(plugin.name)) return

      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          const depPlugin = this.plugins.find(p => p.name === dep)
          if (depPlugin && !resolved.has(dep)) {
            resolveDependencies(depPlugin)
          }
        }
      }

      resolved.add(plugin.name)
      sorted.push(plugin)
    }

    for (const plugin of this.plugins) {
      resolveDependencies(plugin)
    }

    this.plugins = sorted
  }

  /**
   * Execute plugins for a specific phase
   */
  async executePhase(
    phase: PluginPhase,
    context: SafenvContext<T>,
    ...args: any[]
  ): Promise<any> {
    let result: any = args[0] // For transform hooks

    for (const plugin of this.plugins) {
      // Check if plugin should apply
      if (plugin.apply) {
        if (typeof plugin.apply === 'string' && plugin.apply !== context.mode) {
          continue
        }
        if (typeof plugin.apply === 'function' && !plugin.apply(context)) {
          continue
        }
      }

      const hook = plugin[phase]
      if (!hook) continue

      const startTime = Date.now()
      const warnings: string[] = []
      const emittedFiles: Array<{ fileName: string; content: string }> = []

      try {
        // Create plugin-specific context
        const pluginContext = {
          ...this.context,
          warn: (
            message: string,
            position?: { line?: number; column?: number }
          ) => {
            const warning = `[${plugin.name}] ${message}`
            warnings.push(warning)
            this.context.warn(warning, position)
          },
          error: (
            message: string,
            position?: { line?: number; column?: number }
          ) => {
            const error = `[${plugin.name}] ${message}`
            this.context.error(error, position)
            throw new Error(error)
          },
          emitFile: (fileName: string, content: string) => {
            emittedFiles.push({ fileName, content })
            this.context.emitFile(fileName, content)
          },
        }

        // Execute the hook
        const hookResult = await hook.call(
          pluginContext,
          result || context,
          ...args.slice(1)
        )

        // Update result for transform hooks
        if (hookResult !== null && hookResult !== undefined) {
          result = hookResult
        }

        // Record execution result
        this.executionResults.push({
          plugin,
          phase,
          duration: Date.now() - startTime,
          warnings,
          emittedFiles,
        })
      } catch (error) {
        this.executionResults.push({
          plugin,
          phase,
          duration: Date.now() - startTime,
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
   * Get execution results for debugging
   */
  getExecutionResults(): PluginExecutionResult[] {
    return [...this.executionResults]
  }

  /**
   * Clear execution results
   */
  clearExecutionResults(): void {
    this.executionResults = []
  }

  /**
   * Get all emitted files from all plugins
   */
  getAllEmittedFiles(): Array<{
    fileName: string
    content: string
    plugin: string
  }> {
    return this.executionResults.flatMap(result =>
      result.emittedFiles.map(file => ({
        ...file,
        plugin: result.plugin.name,
      }))
    )
  }
}

/**
 * Utility function to create a plugin
 */
export function definePlugin<T extends SafenvVariables = SafenvVariables>(
  plugin: SafenvPluginWithLifecycle<T>
): SafenvPluginWithLifecycle<T> {
  return plugin
}

/**
 * Utility function to create a plugin with legacy support
 */
export function defineLegacyPlugin<T extends SafenvVariables = SafenvVariables>(
  name: string,
  apply: (context: SafenvContext<T>) => Promise<void> | void,
  cleanup?: () => Promise<void> | void
): SafenvPluginWithLifecycle<T> {
  return {
    name,
    legacyApply: apply,
    cleanup,
    // Convert legacy apply to new lifecycle
    buildStart: apply,
    closeBundle: cleanup,
  }
}
