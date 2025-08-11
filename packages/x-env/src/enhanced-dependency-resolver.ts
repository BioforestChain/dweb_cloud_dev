import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import type {
  SafenvConfig,
  SafenvContext,
  DependencyConfiguration,
  ConflictResolutionStrategy,
  DependencyLoadOptions,
} from './types.ts'
import { DependencyResolver, DependencyConfig } from './dependency-resolver.ts'

/**
 * 依赖冲突信息
 */
export interface DependencyConflict {
  packageName: string
  conflictType: 'version' | 'variable' | 'configuration'
  details: {
    current: any
    conflicting: any
    source: string
  }
  severity: 'error' | 'warning' | 'info'
  suggestions: string[]
}

/**
 * 依赖解析结果
 */
export interface DependencyResolutionResult {
  resolved: DependencyConfig[]
  conflicts: DependencyConflict[]
  warnings: string[]
  performance: {
    totalTime: number
    loadTime: number
    resolutionTime: number
    cacheHits: number
    cacheMisses: number
  }
}

/**
 * 依赖缓存项
 */
interface CacheEntry {
  config: DependencyConfig
  timestamp: number
  version: string
}

/**
 * 增强的依赖解析器
 * 支持条件依赖、版本约束、冲突解决等高级功能
 */
export class EnhancedDependencyResolver extends DependencyResolver {
  private cache = new Map<string, CacheEntry>()
  private loadPromises = new Map<string, Promise<DependencyConfig | null>>()

  /**
   * 解析增强的依赖配置
   */
  async resolveDependencies(
    config: SafenvConfig,
    context: SafenvContext
  ): Promise<DependencyResolutionResult> {
    const startTime = Date.now()
    let loadTime = 0
    let cacheHits = 0
    let cacheMisses = 0

    const result: DependencyResolutionResult = {
      resolved: [],
      conflicts: [],
      warnings: [],
      performance: {
        totalTime: 0,
        loadTime: 0,
        resolutionTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
      },
    }

    try {
      // 处理不同类型的依赖配置
      const dependencyNames = await this.extractDependencyNames(config, context)

      // 并行或串行加载依赖
      const loadStartTime = Date.now()
      const loadedDependencies = await this.loadDependencies(
        dependencyNames,
        this.getDependencyLoadOptions(config),
        hit => (hit ? cacheHits++ : cacheMisses++)
      )
      loadTime = Date.now() - loadStartTime

      // 解析条件依赖
      const conditionalDeps = await this.resolveConditionalDependencies(
        config,
        context
      )
      loadedDependencies.push(...conditionalDeps)

      // 应用版本约束
      const constrainedDeps = await this.applyVersionConstraints(
        loadedDependencies,
        config
      )

      // 检测和解决冲突
      const { resolved, conflicts } = await this.resolveConflicts(
        constrainedDeps,
        config
      )

      result.resolved = resolved
      result.conflicts = conflicts
      result.warnings = this.generateWarnings(conflicts, config)
    } catch (error) {
      result.warnings.push(
        `Dependency resolution failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    // 记录性能指标
    const totalTime = Date.now() - startTime
    result.performance = {
      totalTime,
      loadTime,
      resolutionTime: totalTime - loadTime,
      cacheHits,
      cacheMisses,
    }

    return result
  }

  /**
   * 提取依赖名称列表
   */
  private async extractDependencyNames(
    config: SafenvConfig,
    _context: SafenvContext
  ): Promise<string[]> {
    const names: string[] = []

    // 处理简单的字符串数组格式
    if (Array.isArray(config.dependencies)) {
      names.push(...config.dependencies)
    }

    // 处理增强的依赖配置
    else if (config.dependencies && typeof config.dependencies === 'object') {
      const depConfig = config.dependencies as DependencyConfiguration

      // 显式依赖
      if (depConfig.explicit) {
        names.push(...depConfig.explicit)
      }

      // 应用别名
      if (depConfig.aliases) {
        for (let i = 0; i < names.length; i++) {
          if (depConfig.aliases[names[i]]) {
            names[i] = depConfig.aliases[names[i]]
          }
        }
      }

      // 排除指定的依赖
      if (depConfig.exclude) {
        return names.filter(name => !depConfig.exclude!.includes(name))
      }
    }

    // 自动发现依赖
    if (config.autoDependencies !== false) {
      const discovered = await this.discoverDependencies()
      const discoveredNames = discovered.map(d => d.packageName)
      names.push(...discoveredNames.filter(name => !names.includes(name)))
    }

    return names
  }

  /**
   * 解析条件依赖
   */
  private async resolveConditionalDependencies(
    config: SafenvConfig,
    context: SafenvContext
  ): Promise<DependencyConfig[]> {
    const conditionalDeps: DependencyConfig[] = []

    if (!config.dependencies || Array.isArray(config.dependencies)) {
      return conditionalDeps
    }

    const depConfig = config.dependencies as DependencyConfiguration
    if (!depConfig.conditional) {
      return conditionalDeps
    }

    for (const [conditionName, conditionalDep] of Object.entries(
      depConfig.conditional
    )) {
      try {
        const shouldLoad = await this.evaluateCondition(
          conditionalDep.condition,
          context
        )

        if (shouldLoad) {
          for (const packageName of conditionalDep.packages) {
            const dep = await (this as any).loadDependencyConfig(packageName)
            if (dep) {
              conditionalDeps.push(dep)
            } else if (conditionalDep.required) {
              throw new Error(
                `Required conditional dependency not found: ${packageName}`
              )
            }
          }
        }
      } catch (error) {
        const message = `Failed to resolve conditional dependency '${conditionName}': ${error instanceof Error ? error.message : String(error)}`
        console.warn(message)
      }
    }

    return conditionalDeps
  }

  /**
   * 评估条件表达式
   */
  private async evaluateCondition(
    condition: string | ((context: SafenvContext) => boolean),
    context: SafenvContext
  ): Promise<boolean> {
    if (typeof condition === 'function') {
      return condition(context)
    }

    // 简单的条件表达式解析
    // 支持 NODE_ENV=production, mode=build 等格式
    const envMatch = condition.match(/^(\w+)=(.+)$/)
    if (envMatch) {
      const [, envVar, expectedValue] = envMatch
      return process.env[envVar] === expectedValue
    }

    // 支持 mode 条件
    if (condition.startsWith('mode=')) {
      const expectedMode = condition.substring(5)
      return true // 移除 mode 检查，简化逻辑
    }

    // 默认返回 false
    console.warn(`Unsupported condition format: ${condition}`)
    return false
  }

  /**
   * 并行或串行加载依赖
   */
  private async loadDependencies(
    names: string[],
    options: DependencyLoadOptions,
    onCacheEvent: (hit: boolean) => void
  ): Promise<DependencyConfig[]> {
    const loadTasks = names.map(name =>
      this.loadWithCache(name, options, onCacheEvent)
    )

    if (options.parallel !== false) {
      // 并行加载
      const results = await Promise.allSettled(loadTasks)
      return results
        .filter(
          (result): result is PromiseFulfilledResult<DependencyConfig | null> =>
            result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value!)
    } else {
      // 串行加载
      const results: DependencyConfig[] = []
      for (const task of loadTasks) {
        try {
          const result = await task
          if (result) {
            results.push(result)
          }
        } catch (error) {
          console.warn(
            `Failed to load dependency: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }
      return results
    }
  }

  /**
   * 带缓存的依赖加载
   */
  private async loadWithCache(
    packageName: string,
    options: DependencyLoadOptions,
    onCacheEvent: (hit: boolean) => void
  ): Promise<DependencyConfig | null> {
    // 检查缓存
    if (options.cache !== false) {
      const cached = this.cache.get(packageName)
      if (cached) {
        const isExpired =
          options.cacheTimeout &&
          Date.now() - cached.timestamp > options.cacheTimeout

        if (!isExpired) {
          onCacheEvent(true)
          return cached.config
        }
      }
    }

    onCacheEvent(false)

    // 避免重复加载
    if (this.loadPromises.has(packageName)) {
      return this.loadPromises.get(packageName)!
    }

    const loadPromise = this.loadDependencyConfigWithRetry(packageName, options)
    this.loadPromises.set(packageName, loadPromise)

    try {
      const result = await loadPromise

      // 缓存结果
      if (result && options.cache !== false) {
        const version = await this.getPackageVersion(packageName)
        this.cache.set(packageName, {
          config: result,
          timestamp: Date.now(),
          version,
        })
      }

      return result
    } finally {
      this.loadPromises.delete(packageName)
    }
  }

  /**
   * 带重试的依赖加载
   */
  private async loadDependencyConfigWithRetry(
    packageName: string,
    options: DependencyLoadOptions
  ): Promise<DependencyConfig | null> {
    const maxRetries = options.retries || 0
    const timeout = options.timeout || 10000

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Load timeout')), timeout)
        })

        const loadPromise = (this as any).loadDependencyConfig(packageName)
        const result = await Promise.race([loadPromise, timeoutPromise])

        return result
      } catch (error) {
        if (attempt === maxRetries) {
          console.warn(
            `Failed to load ${packageName} after ${maxRetries + 1} attempts: ${error instanceof Error ? error.message : String(error)}`
          )
          return null
        }

        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    }

    return null
  }

  /**
   * 应用版本约束
   */
  private async applyVersionConstraints(
    dependencies: DependencyConfig[],
    config: SafenvConfig
  ): Promise<DependencyConfig[]> {
    if (!config.dependencies || Array.isArray(config.dependencies)) {
      return dependencies
    }

    const depConfig = config.dependencies as DependencyConfiguration
    if (!depConfig.versions) {
      return dependencies
    }

    // 实现版本约束检查
    const constrainedDeps: DependencyConfig[] = []

    for (const dep of dependencies) {
      const versionConstraint = depConfig.versions[dep.packageName]
      if (versionConstraint) {
        const actualVersion = await this.getPackageVersion(dep.packageName)
        if (this.satisfiesVersionConstraint(actualVersion, versionConstraint)) {
          constrainedDeps.push(dep)
        } else {
          console.warn(
            `Package ${dep.packageName} version ${actualVersion} does not satisfy constraint ${versionConstraint}`
          )
        }
      } else {
        constrainedDeps.push(dep)
      }
    }

    return constrainedDeps
  }

  /**
   * 解决依赖冲突
   */
  private async resolveConflicts(
    dependencies: DependencyConfig[],
    config: SafenvConfig
  ): Promise<{
    resolved: DependencyConfig[]
    conflicts: DependencyConflict[]
  }> {
    const conflicts: DependencyConflict[] = []
    const resolved: DependencyConfig[] = []
    const strategy = this.getConflictResolutionStrategy(config)

    // 检测变量名冲突
    const variableMap = new Map<string, DependencyConfig[]>()

    for (const dep of dependencies) {
      for (const varName of Object.keys(dep.config.variables)) {
        const prefixedName = dep.prefix + varName

        if (!variableMap.has(prefixedName)) {
          variableMap.set(prefixedName, [])
        }
        variableMap.get(prefixedName)!.push(dep)
      }
    }

    // 处理冲突
    for (const [varName, conflictingDeps] of variableMap) {
      if (conflictingDeps.length > 1) {
        const conflict: DependencyConflict = {
          packageName: conflictingDeps.map(d => d.packageName).join(', '),
          conflictType: 'variable',
          details: {
            current: conflictingDeps[0],
            conflicting: conflictingDeps.slice(1),
            source: varName,
          },
          severity: strategy === 'strict' ? 'error' : 'warning',
          suggestions: [
            '使用依赖别名来避免冲突',
            '在配置中排除冲突的依赖',
            '调整依赖优先级',
          ],
        }

        conflicts.push(conflict)

        // 根据策略处理冲突
        switch (strategy) {
          case 'strict':
            throw new Error(`Variable name conflict detected: ${varName}`)
          case 'priority':
            resolved.push(this.selectByPriority(conflictingDeps, config))
            break
          case 'latest':
            resolved.push(await this.selectLatestVersion(conflictingDeps))
            break
          case 'warn':
          case 'ignore':
          default:
            resolved.push(conflictingDeps[0])
            break
        }
      } else {
        resolved.push(conflictingDeps[0])
      }
    }

    return { resolved: this.deduplicateDependencies(resolved), conflicts }
  }

  /**
   * 根据优先级选择依赖
   */
  private selectByPriority(
    conflictingDeps: DependencyConfig[],
    config: SafenvConfig
  ): DependencyConfig {
    if (!config.dependencies || Array.isArray(config.dependencies)) {
      return conflictingDeps[0]
    }

    const depConfig = config.dependencies as DependencyConfiguration
    if (!depConfig.priority) {
      return conflictingDeps[0]
    }

    let highestPriority = -1
    let selectedDep = conflictingDeps[0]

    for (const dep of conflictingDeps) {
      const priority = depConfig.priority[dep.packageName] || 0
      if (priority > highestPriority) {
        highestPriority = priority
        selectedDep = dep
      }
    }

    return selectedDep
  }

  /**
   * 去重依赖
   */
  private deduplicateDependencies(
    dependencies: DependencyConfig[]
  ): DependencyConfig[] {
    const seen = new Set<string>()
    return dependencies.filter(dep => {
      if (seen.has(dep.packageName)) {
        return false
      }
      seen.add(dep.packageName)
      return true
    })
  }

  /**
   * 获取冲突解决策略
   */
  private getConflictResolutionStrategy(
    config: SafenvConfig
  ): ConflictResolutionStrategy {
    if (!config.dependencies || Array.isArray(config.dependencies)) {
      return 'warn'
    }

    const depConfig = config.dependencies as DependencyConfiguration
    return depConfig.conflictResolution || 'warn'
  }

  /**
   * 获取依赖加载选项
   */
  private getDependencyLoadOptions(
    config: SafenvConfig
  ): DependencyLoadOptions {
    const defaultOptions: DependencyLoadOptions = {
      parallel: true,
      timeout: 10000,
      retries: 2,
      cache: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
    }

    if (!config.dependencies || Array.isArray(config.dependencies)) {
      return defaultOptions
    }

    const depConfig = config.dependencies as DependencyConfiguration
    return { ...defaultOptions, ...depConfig.loadOptions }
  }

  /**
   * 生成警告信息
   */
  private generateWarnings(
    conflicts: DependencyConflict[],
    _config: SafenvConfig
  ): string[] {
    const warnings: string[] = []

    for (const conflict of conflicts) {
      if (conflict.severity === 'warning') {
        warnings.push(
          `${conflict.conflictType} conflict in ${conflict.packageName}: ${conflict.details.source}`
        )
      }
    }

    return warnings
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 获取包版本信息
   */
  private async getPackageVersion(packageName: string): Promise<string> {
    try {
      // 尝试从 node_modules 中读取 package.json
      const packageJsonPath = resolve(
        process.cwd(),
        'node_modules',
        packageName,
        'package.json'
      )
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        return packageJson.version || 'unknown'
      }

      // 尝试从项目根目录的 package.json 中获取依赖版本
      const rootPackageJsonPath = resolve(process.cwd(), 'package.json')
      if (existsSync(rootPackageJsonPath)) {
        const rootPackageJson = JSON.parse(
          readFileSync(rootPackageJsonPath, 'utf-8')
        )
        const deps = {
          ...rootPackageJson.dependencies,
          ...rootPackageJson.devDependencies,
          ...rootPackageJson.peerDependencies,
        }
        return deps[packageName] || 'unknown'
      }
    } catch (error) {
      console.warn(`Failed to get version for package ${packageName}:`, error)
    }
    return 'unknown'
  }

  /**
   * 检查版本是否满足约束
   */
  private satisfiesVersionConstraint(
    version: string,
    constraint: string
  ): boolean {
    if (version === 'unknown' || constraint === '*') {
      return true
    }

    // 简单的版本比较实现
    // 支持 ^1.0.0, ~1.0.0, >=1.0.0, >1.0.0, <=1.0.0, <1.0.0, 1.0.0
    try {
      if (constraint.startsWith('^')) {
        const targetVersion = constraint.slice(1)
        return this.isCompatibleVersion(version, targetVersion, 'caret')
      } else if (constraint.startsWith('~')) {
        const targetVersion = constraint.slice(1)
        return this.isCompatibleVersion(version, targetVersion, 'tilde')
      } else if (constraint.startsWith('>=')) {
        const targetVersion = constraint.slice(2)
        return this.compareVersions(version, targetVersion) >= 0
      } else if (constraint.startsWith('>')) {
        const targetVersion = constraint.slice(1)
        return this.compareVersions(version, targetVersion) > 0
      } else if (constraint.startsWith('<=')) {
        const targetVersion = constraint.slice(2)
        return this.compareVersions(version, targetVersion) <= 0
      } else if (constraint.startsWith('<')) {
        const targetVersion = constraint.slice(1)
        return this.compareVersions(version, targetVersion) < 0
      } else {
        // 精确匹配
        return version === constraint
      }
    } catch (error) {
      console.warn(
        `Failed to compare versions ${version} and ${constraint}:`,
        error
      )
      return true // 默认允许
    }
  }

  /**
   * 选择最新版本的依赖
   */
  private async selectLatestVersion(
    dependencies: DependencyConfig[]
  ): Promise<DependencyConfig> {
    if (dependencies.length <= 1) {
      return dependencies[0]
    }

    let latestDep = dependencies[0]
    let latestVersion = await this.getPackageVersion(latestDep.packageName)

    for (let i = 1; i < dependencies.length; i++) {
      const currentDep = dependencies[i]
      const currentVersion = await this.getPackageVersion(
        currentDep.packageName
      )

      if (this.compareVersions(currentVersion, latestVersion) > 0) {
        latestDep = currentDep
        latestVersion = currentVersion
      }
    }

    return latestDep
  }

  /**
   * 比较两个版本号
   * @returns 0 if equal, 1 if version1 > version2, -1 if version1 < version2
   */
  private compareVersions(version1: string, version2: string): number {
    if (version1 === version2) return 0
    if (version1 === 'unknown') return -1
    if (version2 === 'unknown') return 1

    const v1Parts = version1.split('.').map(Number)
    const v2Parts = version2.split('.').map(Number)
    const maxLength = Math.max(v1Parts.length, v2Parts.length)

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0
      const v2Part = v2Parts[i] || 0

      if (v1Part > v2Part) return 1
      if (v1Part < v2Part) return -1
    }

    return 0
  }

  /**
   * 检查版本兼容性
   */
  private isCompatibleVersion(
    version: string,
    target: string,
    type: 'caret' | 'tilde'
  ): boolean {
    const vParts = version.split('.').map(Number)
    const tParts = target.split('.').map(Number)

    if (type === 'caret') {
      // ^1.2.3 允许 >=1.2.3 但 <2.0.0
      return (
        vParts[0] === tParts[0] && this.compareVersions(version, target) >= 0
      )
    } else if (type === 'tilde') {
      // ~1.2.3 允许 >=1.2.3 但 <1.3.0
      return (
        vParts[0] === tParts[0] &&
        vParts[1] === tParts[1] &&
        this.compareVersions(version, target) >= 0
      )
    }

    return false
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number
    entries: Array<{ packageName: string; timestamp: number; version: string }>
  } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([packageName, entry]) => ({
        packageName,
        timestamp: entry.timestamp,
        version: entry.version,
      })),
    }
  }
}
