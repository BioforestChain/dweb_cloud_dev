import type {
  PrefixConfiguration,
  PrefixStrategy,
  SafenvVariable,
} from './types.ts'

/**
 * 变量冲突信息
 */
export interface VariableConflict {
  variableName: string
  sources: string[]
  severity: 'warning' | 'error'
  suggestion?: string
}

/**
 * Prefix处理结果
 */
export interface PrefixResult {
  originalName: string
  finalName: string
  prefix: string
  strategy: PrefixStrategy
  source: string
}

/**
 * 智能prefix策略管理器
 * 负责根据配置策略决定如何为依赖变量添加prefix
 */
export class SmartPrefixManager {
  private readonly globalVariables: Set<string>
  private readonly config: PrefixConfiguration
  private readonly conflicts: VariableConflict[] = []

  // 常见的全局环境变量
  private static readonly DEFAULT_GLOBAL_VARIABLES = [
    'NODE_ENV',
    'PORT',
    'HOST',
    'DEBUG',
    'LOG_LEVEL',
    'TZ',
    'LANG',
    'LC_ALL',
    'PATH',
    'HOME',
    'USER',
    'SHELL',
    'TERM',
    'PWD',
    'TMPDIR',
  ]

  constructor(config: PrefixConfiguration = {}) {
    this.config = {
      defaultStrategy: 'global-aware',
      globalVariables: SmartPrefixManager.DEFAULT_GLOBAL_VARIABLES,
      conflictWarning: true,
      separator: '_',
      ...config,
    }

    this.globalVariables = new Set([
      ...SmartPrefixManager.DEFAULT_GLOBAL_VARIABLES,
      ...(this.config.globalVariables || []),
    ])
  }

  /**
   * 为依赖变量应用prefix策略
   */
  applyPrefixStrategy(
    variables: Record<string, SafenvVariable>,
    packageName: string,
    existingVariables: Set<string> = new Set()
  ): {
    prefixedVariables: Record<string, SafenvVariable>
    results: PrefixResult[]
    conflicts: VariableConflict[]
  } {
    const results: PrefixResult[] = []
    const prefixedVariables: Record<string, SafenvVariable> = {}
    const currentConflicts: VariableConflict[] = []

    for (const [originalName, variable] of Object.entries(variables)) {
      const result = this.processVariable(
        originalName,
        packageName,
        existingVariables
      )

      results.push(result)

      // 检测冲突
      if (
        existingVariables.has(result.finalName) &&
        this.config.conflictWarning
      ) {
        const conflict: VariableConflict = {
          variableName: result.finalName,
          sources: [packageName, 'existing'],
          severity: result.strategy === 'none' ? 'error' : 'warning',
          suggestion: this.suggestConflictResolution(originalName, packageName),
        }
        currentConflicts.push(conflict)
        this.conflicts.push(conflict)
      }

      // 添加处理后的变量
      prefixedVariables[result.finalName] = {
        ...variable,
        description: this.enhanceDescription(
          variable.description,
          packageName,
          result
        ),
      }

      existingVariables.add(result.finalName)
    }

    return {
      prefixedVariables,
      results,
      conflicts: currentConflicts,
    }
  }

  /**
   * 处理单个变量的prefix
   */
  private processVariable(
    variableName: string,
    packageName: string,
    _existingVariables: Set<string>
  ): PrefixResult {
    // 1. 检查是否在noPrefixRisky列表中
    if (this.config.noPrefixRisky?.includes(packageName)) {
      return {
        originalName: variableName,
        finalName: variableName,
        prefix: '',
        strategy: 'none',
        source: packageName,
      }
    }

    // 2. 检查自定义prefix
    if (this.config.customPrefixes?.[packageName]) {
      const customPrefix = this.config.customPrefixes[packageName]
      return {
        originalName: variableName,
        finalName: `${customPrefix}${variableName}`,
        prefix: customPrefix,
        strategy: 'custom',
        source: packageName,
      }
    }

    // 3. 检查是否强制使用auto prefix (优先于global-aware)
    if (this.config.autoPrefixed?.includes(packageName)) {
      const autoPrefix = this.generateAutoPrefix(packageName)
      return {
        originalName: variableName,
        finalName: `${autoPrefix}${variableName}`,
        prefix: autoPrefix,
        strategy: 'auto',
        source: packageName,
      }
    }

    // 4. 检查是否是全局变量（global-aware策略）
    if (
      this.config.defaultStrategy === 'global-aware' &&
      this.globalVariables.has(variableName)
    ) {
      return {
        originalName: variableName,
        finalName: variableName,
        prefix: '',
        strategy: 'global-aware',
        source: packageName,
      }
    }

    // 5. 默认策略处理
    switch (this.config.defaultStrategy) {
      case 'auto':
        const autoPrefix = this.generateAutoPrefix(packageName)
        return {
          originalName: variableName,
          finalName: `${autoPrefix}${variableName}`,
          prefix: autoPrefix,
          strategy: 'auto',
          source: packageName,
        }

      case 'none':
        return {
          originalName: variableName,
          finalName: variableName,
          prefix: '',
          strategy: 'none',
          source: packageName,
        }

      case 'global-aware':
        // 对于non-global变量，在global-aware模式下使用auto prefix
        const globalAwarePrefix = this.generateAutoPrefix(packageName)
        return {
          originalName: variableName,
          finalName: `${globalAwarePrefix}${variableName}`,
          prefix: globalAwarePrefix,
          strategy: 'auto',
          source: packageName,
        }

      default:
        // 默认使用auto策略
        const defaultPrefix = this.generateAutoPrefix(packageName)
        return {
          originalName: variableName,
          finalName: `${defaultPrefix}${variableName}`,
          prefix: defaultPrefix,
          strategy: 'auto',
          source: packageName,
        }
    }
  }

  /**
   * 生成自动prefix
   */
  private generateAutoPrefix(packageName: string): string {
    const separator = this.config.separator || '_'

    return (
      packageName
        .replace(/^@/, '') // 移除@符号
        .replace(/[/\-.]/g, '_') // 替换分隔符
        .replace(/([a-z])([A-Z])/g, '$1_$2') // 添加下划线
        .toUpperCase() + separator
    )
  }

  /**
   * 增强变量描述信息
   */
  private enhanceDescription(
    originalDescription: string | undefined,
    source: string,
    result: PrefixResult
  ): string {
    const sourceInfo = `[From ${source}]`
    const strategyInfo =
      result.strategy !== 'none' ? ` [Strategy: ${result.strategy}]` : ''

    if (originalDescription) {
      return `${sourceInfo}${strategyInfo} ${originalDescription}`
    } else {
      return `${sourceInfo}${strategyInfo} Variable from dependency ${source}`
    }
  }

  /**
   * 建议冲突解决方案
   */
  private suggestConflictResolution(
    variableName: string,
    packageName: string
  ): string {
    return `Consider adding '${packageName}' to customPrefixes or autoPrefixed to avoid naming conflict for '${variableName}'`
  }

  /**
   * 获取所有冲突
   */
  getConflicts(): VariableConflict[] {
    return [...this.conflicts]
  }

  /**
   * 清除冲突记录
   */
  clearConflicts(): void {
    this.conflicts.length = 0
  }

  /**
   * 检查是否为全局变量
   */
  isGlobalVariable(variableName: string): boolean {
    return this.globalVariables.has(variableName)
  }

  /**
   * 添加全局变量
   */
  addGlobalVariable(variableName: string): void {
    this.globalVariables.add(variableName)
  }

  /**
   * 获取prefix策略配置
   */
  getConfig(): PrefixConfiguration {
    return { ...this.config }
  }
}
