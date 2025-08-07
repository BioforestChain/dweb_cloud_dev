import type {
  SafenvVariable,
  SafenvPrimitiveType,
  StandardSchemaV1,
} from './types.ts'

// 注意：异步验证器类型已移除，现在统一使用 SafenvValidator 类型
// SafenvValidator 现在支持同步和异步验证，通过运行时检测 Promise 来区分处理

/**
 * 变量间依赖关系
 */
export interface VariableDependency {
  /** 依赖的变量名列表 */
  dependsOn: string[]
  /** 依赖验证函数 */
  validator: (
    current: any,
    dependencies: Record<string, any>
  ) => boolean | string | Promise<boolean | string>
  /** 是否为强依赖（依赖变量必须先解析） */
  strict?: boolean
}

/**
 * 增强的变量定义
 */
export interface EnhancedSafenvVariable<
  T extends SafenvPrimitiveType = SafenvPrimitiveType,
> extends SafenvVariable<T> {
  /** 扩展验证器（支持同步和异步，已统一到基础 validate 字段） */
  // asyncValidate 字段已废弃，现在统一使用 validate 字段支持同步和异步验证
  /** 变量间依赖关系 */
  dependencies?: VariableDependency
  /** 变量转换器 */
  transform?: (value: any) => any | Promise<any>
  /** 变量计算函数（基于其他变量计算值） */
  computed?: (variables: Record<string, any>) => any | Promise<any>
  /** 环境特定的配置 */
  environments?: Record<string, Partial<EnhancedSafenvVariable<T>>>
  /** 变量标签，用于分组和过滤 */
  tags?: string[]
  /** 是否为敏感变量 */
  sensitive?: boolean
  /** 变量优先级 */
  priority?: number
}

/**
 * 变量解析选项
 */
export interface VariableResolutionOptions {
  /** 是否并行解析变量 */
  parallel?: boolean
  /** 解析超时时间（毫秒） */
  timeout?: number
  /** 是否启用缓存 */
  cache?: boolean
  /** 环境名称 */
  environment?: string
  /** 是否跳过验证 */
  skipValidation?: boolean
  /** 是否跳过转换 */
  skipTransform?: boolean
  /** 变量过滤器 */
  filter?: (name: string, variable: EnhancedSafenvVariable) => boolean
}

/**
 * 变量解析结果
 */
export interface VariableResolutionResult {
  /** 解析后的变量值 */
  variables: Record<string, any>
  /** 解析过程中的错误 */
  errors: Array<{ variable: string; error: string; recoverable: boolean }>
  /** 解析过程中的警告 */
  warnings: Array<{ variable: string; warning: string }>
  /** 跳过的变量（由于依赖或过滤器） */
  skipped: string[]
  /** 性能统计 */
  performance: {
    totalTime: number
    validationTime: number
    transformTime: number
    dependencyResolutionTime: number
    variableCount: number
    asyncValidationCount: number
  }
}

/**
 * 依赖图节点
 */
interface DependencyNode {
  name: string
  variable: EnhancedSafenvVariable
  dependencies: string[]
  dependents: string[]
  resolved: boolean
  resolving: boolean
}

/**
 * 增强的变量解析器
 * 支持异步验证、变量依赖、类型转换等高级功能
 */
export class EnhancedVariableResolver {
  private cache = new Map<string, any>()
  private resolving = new Set<string>()

  /**
   * 解析变量
   */
  async resolveVariables(
    variables: Record<string, EnhancedSafenvVariable>,
    options: VariableResolutionOptions = {}
  ): Promise<VariableResolutionResult> {
    const startTime = Date.now()
    let validationTime = 0
    let transformTime = 0
    let dependencyResolutionTime = 0
    let asyncValidationCount = 0

    const result: VariableResolutionResult = {
      variables: {},
      errors: [],
      warnings: [],
      skipped: [],
      performance: {
        totalTime: 0,
        validationTime: 0,
        transformTime: 0,
        dependencyResolutionTime: 0,
        variableCount: 0,
        asyncValidationCount: 0,
      },
    }

    try {
      // 应用环境特定配置
      const environmentVariables = this.applyEnvironmentConfig(
        variables,
        options.environment
      )

      // 应用过滤器
      const filteredVariables = this.applyFilter(
        environmentVariables,
        options.filter
      )

      // 构建依赖图
      const depStartTime = Date.now()
      const dependencyGraph = this.buildDependencyGraph(filteredVariables)
      dependencyResolutionTime = Date.now() - depStartTime

      // 检测循环依赖
      this.detectCircularDependencies(dependencyGraph)

      // 按依赖顺序解析变量
      const resolutionOrder = this.topologicalSort(dependencyGraph)

      if (options.parallel && this.canResolveInParallel(dependencyGraph)) {
        // 并行解析（仅当没有依赖关系时）
        await this.resolveInParallel(filteredVariables, result, options)
      } else {
        // 按依赖顺序串行解析
        for (const variableName of resolutionOrder) {
          if (this.resolving.has(variableName)) {
            continue // 避免重复解析
          }

          try {
            const variable = filteredVariables[variableName]
            const resolvedValue = await this.resolveVariable(
              variableName,
              variable,
              result.variables,
              options
            )

            // 验证
            if (!options.skipValidation) {
              const valStartTime = Date.now()
              await this.validateVariable(variableName, variable, resolvedValue)
              // 检查是否为异步验证（通过检测 validate 函数返回 Promise）
              if (
                variable.validate &&
                typeof variable.validate === 'function'
              ) {
                try {
                  const result = variable.validate(resolvedValue)
                  if (result instanceof Promise) {
                    asyncValidationCount++
                  }
                } catch {
                  // 忽略验证错误，这里只是统计异步验证数量
                }
              }
              validationTime += Date.now() - valStartTime
            }

            // 转换
            if (!options.skipTransform && variable.transform) {
              const transStartTime = Date.now()
              result.variables[variableName] =
                await variable.transform(resolvedValue)
              transformTime += Date.now() - transStartTime
            } else {
              result.variables[variableName] = resolvedValue
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            result.errors.push({
              variable: variableName,
              error: errorMessage,
              recoverable: this.isRecoverableError(error),
            })

            // 如果是必需变量，停止解析
            if (filteredVariables[variableName].required) {
              break
            }
          }
        }
      }

      // 解析计算变量
      await this.resolveComputedVariables(filteredVariables, result, options)
    } catch (error) {
      result.errors.push({
        variable: 'global',
        error: error instanceof Error ? error.message : String(error),
        recoverable: false,
      })
    }

    // 记录性能统计
    result.performance = {
      totalTime: Date.now() - startTime,
      validationTime,
      transformTime,
      dependencyResolutionTime,
      variableCount: Object.keys(variables).length,
      asyncValidationCount,
    }

    return result
  }

  /**
   * 应用环境特定配置
   */
  private applyEnvironmentConfig(
    variables: Record<string, EnhancedSafenvVariable>,
    environment?: string
  ): Record<string, EnhancedSafenvVariable> {
    if (!environment) {
      return variables
    }

    const result: Record<string, EnhancedSafenvVariable> = {}

    for (const [name, variable] of Object.entries(variables)) {
      let mergedVariable = { ...variable }

      if (variable.environments && variable.environments[environment]) {
        mergedVariable = {
          ...mergedVariable,
          ...variable.environments[environment],
        }
      }

      result[name] = mergedVariable
    }

    return result
  }

  /**
   * 应用变量过滤器
   */
  private applyFilter(
    variables: Record<string, EnhancedSafenvVariable>,
    filter?: (name: string, variable: EnhancedSafenvVariable) => boolean
  ): Record<string, EnhancedSafenvVariable> {
    if (!filter) {
      return variables
    }

    const result: Record<string, EnhancedSafenvVariable> = {}

    for (const [name, variable] of Object.entries(variables)) {
      if (filter(name, variable)) {
        result[name] = variable
      }
    }

    return result
  }

  /**
   * 构建依赖图
   */
  private buildDependencyGraph(
    variables: Record<string, EnhancedSafenvVariable>
  ): Map<string, DependencyNode> {
    const graph = new Map<string, DependencyNode>()

    // 初始化节点
    for (const [name, variable] of Object.entries(variables)) {
      graph.set(name, {
        name,
        variable,
        dependencies: variable.dependencies?.dependsOn || [],
        dependents: [],
        resolved: false,
        resolving: false,
      })
    }

    // 建立依赖关系
    for (const node of graph.values()) {
      for (const depName of node.dependencies) {
        const depNode = graph.get(depName)
        if (depNode) {
          depNode.dependents.push(node.name)
        }
      }
    }

    return graph
  }

  /**
   * 检测循环依赖
   */
  private detectCircularDependencies(graph: Map<string, DependencyNode>): void {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const dfs = (nodeName: string): boolean => {
      if (recursionStack.has(nodeName)) {
        throw new Error(
          `Circular dependency detected involving variable: ${nodeName}`
        )
      }

      if (visited.has(nodeName)) {
        return false
      }

      visited.add(nodeName)
      recursionStack.add(nodeName)

      const node = graph.get(nodeName)
      if (node) {
        for (const depName of node.dependencies) {
          if (dfs(depName)) {
            return true
          }
        }
      }

      recursionStack.delete(nodeName)
      return false
    }

    for (const nodeName of graph.keys()) {
      if (!visited.has(nodeName)) {
        dfs(nodeName)
      }
    }
  }

  /**
   * 拓扑排序
   */
  private topologicalSort(graph: Map<string, DependencyNode>): string[] {
    const result: string[] = []
    const visited = new Set<string>()
    const temp = new Set<string>()

    const visit = (nodeName: string) => {
      if (temp.has(nodeName)) {
        throw new Error(`Circular dependency detected: ${nodeName}`)
      }

      if (!visited.has(nodeName)) {
        temp.add(nodeName)

        const node = graph.get(nodeName)
        if (node) {
          for (const depName of node.dependencies) {
            visit(depName)
          }
        }

        temp.delete(nodeName)
        visited.add(nodeName)
        result.unshift(nodeName) // 前插，确保依赖在前
      }
    }

    for (const nodeName of graph.keys()) {
      if (!visited.has(nodeName)) {
        visit(nodeName)
      }
    }

    return result
  }

  /**
   * 检查是否可以并行解析
   */
  private canResolveInParallel(graph: Map<string, DependencyNode>): boolean {
    for (const node of graph.values()) {
      if (node.dependencies.length > 0) {
        return false
      }
    }
    return true
  }

  /**
   * 并行解析变量
   */
  private async resolveInParallel(
    variables: Record<string, EnhancedSafenvVariable>,
    result: VariableResolutionResult,
    options: VariableResolutionOptions
  ): Promise<void> {
    const promises = Object.entries(variables).map(async ([name, variable]) => {
      try {
        const resolvedValue = await this.resolveVariable(
          name,
          variable,
          {},
          options
        )

        if (!options.skipValidation) {
          await this.validateVariable(name, variable, resolvedValue)
        }

        if (!options.skipTransform && variable.transform) {
          result.variables[name] = await variable.transform(resolvedValue)
        } else {
          result.variables[name] = resolvedValue
        }
      } catch (error) {
        result.errors.push({
          variable: name,
          error: error instanceof Error ? error.message : String(error),
          recoverable: this.isRecoverableError(error),
        })
      }
    })

    await Promise.allSettled(promises)
  }

  /**
   * 解析单个变量
   */
  private async resolveVariable(
    name: string,
    variable: EnhancedSafenvVariable,
    resolvedVariables: Record<string, any>,
    options: VariableResolutionOptions
  ): Promise<any> {
    // 检查缓存
    if (options.cache && this.cache.has(name)) {
      return this.cache.get(name)
    }

    this.resolving.add(name)

    try {
      let value: any

      // 如果是计算变量，跳过环境变量获取
      if (variable.computed) {
        value = undefined
      } else {
        // 从环境变量获取值
        value = process.env[name] ?? variable.default
      }

      // 检查必需变量
      if (variable.required && value === undefined && !variable.computed) {
        throw new Error(`Required variable ${name} is not set`)
      }

      // 解析依赖变量
      if (variable.dependencies && variable.dependencies.dependsOn.length > 0) {
        const dependencies: Record<string, any> = {}
        for (const depName of variable.dependencies.dependsOn) {
          if (resolvedVariables[depName] === undefined) {
            if (variable.dependencies.strict) {
              throw new Error(
                `Strict dependency ${depName} not resolved for variable ${name}`
              )
            }
            dependencies[depName] = process.env[depName]
          } else {
            dependencies[depName] = resolvedVariables[depName]
          }
        }

        // 验证依赖关系
        const depValidationResult = await variable.dependencies.validator(
          value,
          dependencies
        )
        if (depValidationResult !== true) {
          throw new Error(
            `Dependency validation failed for ${name}: ${depValidationResult}`
          )
        }
      }

      // 类型转换
      if (value !== undefined && variable.type) {
        value = this.parseValue(value, variable.type)
      }

      // 缓存结果
      if (options.cache) {
        this.cache.set(name, value)
      }

      return value
    } finally {
      this.resolving.delete(name)
    }
  }

  /**
   * 验证变量
   */
  private async validateVariable(
    name: string,
    variable: EnhancedSafenvVariable,
    value: any
  ): Promise<void> {
    // 同步验证
    if (variable.validate && value !== undefined) {
      const syncResult = variable.validate(value)
      if (syncResult !== true) {
        throw new Error(`Validation failed for ${name}: ${syncResult}`)
      }
    }

    // 统一验证（支持同步和异步）
    if (variable.validate && value !== undefined) {
      const result = variable.validate(value)
      if (result instanceof Promise) {
        const asyncResult = await result
        if (asyncResult !== true) {
          throw new Error(`Async validation failed for ${name}: ${asyncResult}`)
        }
      } else if (result !== true) {
        throw new Error(`Validation failed for ${name}: ${result}`)
      }
    }

    // 约束验证
    if (variable.constraints && value !== undefined) {
      this.validateConstraints(name, variable, value)
    }

    // Standard Schema 验证
    if (variable.schema && value !== undefined) {
      await this.validateWithStandardSchema(name, variable.schema, value)
    }
  }

  /**
   * 验证约束条件
   */
  private validateConstraints(
    name: string,
    variable: EnhancedSafenvVariable,
    value: any
  ): void {
    const constraints = variable.constraints
    if (!constraints) return

    switch (variable.type) {
      case 'string':
        const strConstraints = constraints as any
        if (
          strConstraints.minLength &&
          value.length < strConstraints.minLength
        ) {
          throw new Error(
            `${name} must be at least ${strConstraints.minLength} characters long`
          )
        }
        if (
          strConstraints.maxLength &&
          value.length > strConstraints.maxLength
        ) {
          throw new Error(
            `${name} must be at most ${strConstraints.maxLength} characters long`
          )
        }
        if (strConstraints.pattern) {
          const regex =
            typeof strConstraints.pattern === 'string'
              ? new RegExp(strConstraints.pattern)
              : strConstraints.pattern
          if (!regex.test(value)) {
            throw new Error(`${name} does not match required pattern`)
          }
        }
        break

      case 'number':
        const numConstraints = constraints as any
        if (numConstraints.min !== undefined && value < numConstraints.min) {
          throw new Error(`${name} must be at least ${numConstraints.min}`)
        }
        if (numConstraints.max !== undefined && value > numConstraints.max) {
          throw new Error(`${name} must be at most ${numConstraints.max}`)
        }
        if (numConstraints.integer && !Number.isInteger(value)) {
          throw new Error(`${name} must be an integer`)
        }
        break

      case 'array':
        const arrConstraints = constraints as any
        if (arrConstraints.minItems && value.length < arrConstraints.minItems) {
          throw new Error(
            `${name} must have at least ${arrConstraints.minItems} items`
          )
        }
        if (arrConstraints.maxItems && value.length > arrConstraints.maxItems) {
          throw new Error(
            `${name} must have at most ${arrConstraints.maxItems} items`
          )
        }
        break
    }
  }

  /**
   * 使用 Standard Schema 验证
   */
  private async validateWithStandardSchema(
    name: string,
    schema: StandardSchemaV1,
    value: any
  ): Promise<void> {
    const result = await schema['~standard'].validate(value)

    if ('issues' in result && result.issues) {
      const issues = result.issues.map(issue => issue.message).join(', ')
      throw new Error(`Schema validation failed for ${name}: ${issues}`)
    }
  }

  /**
   * 解析计算变量
   */
  private async resolveComputedVariables(
    variables: Record<string, EnhancedSafenvVariable>,
    result: VariableResolutionResult,
    _options: VariableResolutionOptions
  ): Promise<void> {
    for (const [name, variable] of Object.entries(variables)) {
      if (variable.computed) {
        try {
          const computedValue = await variable.computed(result.variables)
          result.variables[name] = computedValue
        } catch (error) {
          result.errors.push({
            variable: name,
            error: `Computed variable error: ${error instanceof Error ? error.message : String(error)}`,
            recoverable: false,
          })
        }
      }
    }
  }

  /**
   * 解析值类型
   */
  private parseValue(value: any, type: SafenvPrimitiveType): any {
    if (typeof value === 'string') {
      switch (type) {
        case 'number':
          const num = Number(value)
          if (isNaN(num)) {
            throw new Error(`Cannot convert "${value}" to number`)
          }
          return num
        case 'boolean':
          return value.toLowerCase() === 'true' || value === '1'
        case 'array':
          return value
            .split(',')
            .map(v => v.trim())
            .filter(v => v.length > 0)
        case 'object':
          try {
            return JSON.parse(value)
          } catch {
            throw new Error(`Cannot parse "${value}" as JSON object`)
          }
        default:
          return value
      }
    }
    return value
  }

  /**
   * 判断错误是否可恢复
   */
  private isRecoverableError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return (
        message.includes('validation') ||
        message.includes('format') ||
        message.includes('constraint')
      )
    }
    return false
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}
