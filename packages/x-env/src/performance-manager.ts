import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import type { SafenvConfig } from './types.ts'

/**
 * 缓存条目
 */
interface CacheEntry<T = any> {
  value: T
  timestamp: number
  ttl: number
  hash?: string
  dependencies?: string[]
  hits?: number
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  configLoadTime: number
  dependencyResolutionTime: number
  variableResolutionTime: number
  pluginExecutionTime: number
  cacheHitRate: number
  totalExecutionTime: number
  memoryUsage: {
    heapUsed: number
    heapTotal: number
    external: number
  }
  operationCounts: {
    cacheHits: number
    cacheMisses: number
    parallelOperations: number
    incrementalUpdates: number
  }
}

/**
 * 性能优化选项
 */
export interface PerformanceOptions {
  /** 是否启用缓存 */
  enableCache?: boolean
  /** 缓存 TTL（毫秒） */
  cacheTTL?: number
  /** 最大缓存大小 */
  maxCacheSize?: number
  /** 是否启用并行处理 */
  enableParallel?: boolean
  /** 并行处理的最大并发数 */
  maxConcurrency?: number
  /** 是否启用增量更新 */
  enableIncremental?: boolean
  /** 是否启用性能监控 */
  enableProfiling?: boolean
  /** 内存使用警告阈值（MB） */
  memoryWarningThreshold?: number
}

/**
 * 任务类型
 */
export type TaskType =
  | 'config-load'
  | 'variable-resolution'
  | 'plugin-execution'
  | 'file-generation'
  | 'validation'

/**
 * 并行任务
 */
interface ParallelTask<T = any> {
  id: string
  type: TaskType
  fn: () => Promise<T>
  dependencies?: string[]
  priority?: number
}

/**
 * 性能优化管理器
 * 提供缓存、并行处理、增量更新等性能优化功能
 */
export class PerformanceManager {
  private cache = new Map<string, CacheEntry>()
  private metrics: PerformanceMetrics
  private options: Required<PerformanceOptions>
  private taskQueue: ParallelTask[] = []
  private runningTasks = new Map<string, Promise<any>>()
  private dependencyGraph = new Map<string, string[]>()

  constructor(options: PerformanceOptions = {}) {
    this.options = {
      enableCache: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 1000,
      enableParallel: true,
      maxConcurrency: 4,
      enableIncremental: true,
      enableProfiling: true,
      memoryWarningThreshold: 100, // 100MB
      ...options,
    }

    this.metrics = this.initializeMetrics()

    // 定期清理缓存
    if (this.options.enableCache) {
      setInterval(() => this.cleanupCache(), this.options.cacheTTL)
    }

    // 定期检查内存使用
    if (this.options.enableProfiling) {
      setInterval(() => this.checkMemoryUsage(), 30000) // 每30秒检查一次
    }
  }

  /**
   * 初始化性能指标
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      configLoadTime: 0,
      dependencyResolutionTime: 0,
      variableResolutionTime: 0,
      pluginExecutionTime: 0,
      cacheHitRate: 0,
      totalExecutionTime: 0,
      memoryUsage: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
      },
      operationCounts: {
        cacheHits: 0,
        cacheMisses: 0,
        parallelOperations: 0,
        incrementalUpdates: 0,
      },
    }
  }

  /**
   * 缓存操作
   */
  async cached<T>(
    key: string,
    fn: () => Promise<T>,
    options?: {
      ttl?: number
      dependencies?: string[]
      skipCache?: boolean
    }
  ): Promise<T> {
    const cacheKey = this.generateCacheKey(key)

    // 检查是否跳过缓存
    if (!this.options.enableCache || options?.skipCache) {
      return await fn()
    }

    // 检查缓存
    const cached = this.cache.get(cacheKey)
    if (cached && this.isCacheValid(cached)) {
      this.metrics.operationCounts.cacheHits++
      this.updateCacheHitRate() // 立即更新命中率
      return cached.value
    }

    // 执行函数并缓存结果
    this.metrics.operationCounts.cacheMisses++
    this.updateCacheHitRate() // 立即更新命中率
    const startTime = performance.now()

    const result = await fn()
    const _executionTime = performance.now() - startTime

    // 存储到缓存
    this.setCache(cacheKey, result, {
      ttl: options?.ttl || this.options.cacheTTL,
      dependencies: options?.dependencies,
    })

    return result
  }

  /**
   * 并行执行任务
   */
  async executeParallel<T>(tasks: ParallelTask<T>[]): Promise<T[]> {
    if (!this.options.enableParallel || tasks.length <= 1) {
      // 串行执行
      const results: T[] = []
      for (const task of tasks) {
        results.push(await task.fn())
      }
      return results
    }

    this.metrics.operationCounts.parallelOperations++

    // 构建依赖图
    const _dependencyGraph = this.buildTaskDependencyGraph(tasks)

    // 按依赖顺序执行
    const results = new Map<string, T>()
    const executing = new Set<string>()
    const completed = new Set<string>()

    const executeTask = async (task: ParallelTask<T>): Promise<T> => {
      // 检查是否已在执行
      if (executing.has(task.id)) {
        return await this.runningTasks.get(task.id)!
      }

      // 等待依赖任务完成
      if (task.dependencies) {
        for (const depId of task.dependencies) {
          if (!completed.has(depId)) {
            const depTask = tasks.find(t => t.id === depId)
            if (depTask) {
              await executeTask(depTask)
            }
          }
        }
      }

      executing.add(task.id)
      const promise = task.fn()
      this.runningTasks.set(task.id, promise)

      try {
        const result = await promise
        results.set(task.id, result)
        completed.add(task.id)
        executing.delete(task.id)
        this.runningTasks.delete(task.id)
        return result
      } catch (error) {
        executing.delete(task.id)
        this.runningTasks.delete(task.id)
        throw error
      }
    }

    // 并行执行所有任务（受并发限制）
    const semaphore = new Semaphore(this.options.maxConcurrency)
    const promises = tasks.map(async task => {
      await semaphore.acquire()
      try {
        return await executeTask(task)
      } finally {
        semaphore.release()
      }
    })

    return await Promise.all(promises)
  }

  /**
   * 增量更新检测
   */
  detectIncrementalChanges(
    oldConfig: SafenvConfig,
    newConfig: SafenvConfig
  ): {
    hasChanges: boolean
    changedVariables: string[]
    changedPlugins: string[]
    changeHash: string
  } {
    const oldHash = this.calculateConfigHash(oldConfig)
    const newHash = this.calculateConfigHash(newConfig)

    if (oldHash === newHash) {
      return {
        hasChanges: false,
        changedVariables: [],
        changedPlugins: [],
        changeHash: newHash,
      }
    }

    const changedVariables = this.detectVariableChanges(oldConfig, newConfig)
    const changedPlugins = this.detectPluginChanges(oldConfig, newConfig)

    return {
      hasChanges: true,
      changedVariables,
      changedPlugins,
      changeHash: newHash,
    }
  }

  /**
   * 性能监控装饰器
   */
  withProfiling<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    if (!this.options.enableProfiling) {
      return fn()
    }

    const startTime = performance.now()
    const startMemory = process.memoryUsage()

    return fn().then(
      result => {
        const endTime = performance.now()
        const endMemory = process.memoryUsage()

        this.recordPerformanceMetric(operation, {
          duration: endTime - startTime,
          memoryDelta: {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            external: endMemory.external - startMemory.external,
          },
        })

        return result
      },
      error => {
        const endTime = performance.now()
        this.recordPerformanceMetric(operation, {
          duration: endTime - startTime,
          error: true,
        })
        throw error
      }
    )
  }

  /**
   * 获取性能指标
   */
  getMetrics(): PerformanceMetrics {
    this.updateMemoryMetrics()
    this.updateCacheHitRate()
    return { ...this.metrics }
  }

  /**
   * 重置性能指标
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics()
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear()
    console.log('🧹 Performance cache cleared')
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number
    hitRate: number
    memoryUsage: number
    entries: Array<{
      key: string
      size: number
      age: number
      hits?: number
    }>
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: this.estimateObjectSize(entry.value),
      age: Date.now() - entry.timestamp,
      hits: (entry as any).hits || 0,
    }))

    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0)

    return {
      size: this.cache.size,
      hitRate: this.metrics.cacheHitRate,
      memoryUsage: totalSize,
      entries,
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(key: string): string {
    return createHash('md5').update(key).digest('hex')
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(entry: CacheEntry): boolean {
    const now = Date.now()
    const isValid = now - entry.timestamp < entry.ttl
    if (isValid) {
      // 增加命中计数
      ;(entry as any).hits = ((entry as any).hits || 0) + 1
    }
    return isValid
  }

  /**
   * 设置缓存
   */
  private setCache(
    key: string,
    value: any,
    options: {
      ttl: number
      dependencies?: string[]
    }
  ): void {
    // 检查缓存大小限制
    if (this.cache.size >= this.options.maxCacheSize) {
      this.evictOldestEntry()
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: options.ttl,
      dependencies: options.dependencies,
      hits: 0,
    })
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isCacheValid(entry)) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`)
    }
  }

  /**
   * 驱逐最旧的缓存条目
   */
  private evictOldestEntry(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  /**
   * 构建任务依赖图
   */
  private buildTaskDependencyGraph(
    tasks: ParallelTask[]
  ): Map<string, string[]> {
    const graph = new Map<string, string[]>()

    for (const task of tasks) {
      graph.set(task.id, task.dependencies || [])
    }

    return graph
  }

  /**
   * 计算配置哈希
   */
  private calculateConfigHash(config: SafenvConfig): string {
    const configStr = JSON.stringify(config, Object.keys(config).sort())
    return createHash('md5').update(configStr).digest('hex')
  }

  /**
   * 检测变量变更
   */
  private detectVariableChanges(
    oldConfig: SafenvConfig,
    newConfig: SafenvConfig
  ): string[] {
    const changes: string[] = []
    const oldVars = oldConfig.variables || {}
    const newVars = newConfig.variables || {}

    // 检查修改和新增
    for (const [name, newVar] of Object.entries(newVars)) {
      const oldVar = oldVars[name]
      if (
        !oldVar ||
        JSON.stringify(oldVar, Object.keys(oldVar).sort()) !==
          JSON.stringify(newVar, Object.keys(newVar).sort())
      ) {
        changes.push(name)
      }
    }

    // 检查删除
    for (const name of Object.keys(oldVars)) {
      if (!newVars[name]) {
        changes.push(name)
      }
    }

    return changes
  }

  /**
   * 检测插件变更
   */
  private detectPluginChanges(
    oldConfig: SafenvConfig,
    newConfig: SafenvConfig
  ): string[] {
    const oldPlugins = oldConfig.plugins || []
    const newPlugins = newConfig.plugins || []

    if (JSON.stringify(oldPlugins) !== JSON.stringify(newPlugins)) {
      return newPlugins.map(p => (typeof p === 'string' ? p : p.name))
    }

    return []
  }

  /**
   * 记录性能指标
   */
  private recordPerformanceMetric(
    operation: string,
    data: {
      duration: number
      memoryDelta?: any
      error?: boolean
    }
  ): void {
    switch (operation) {
      case 'config-load':
        this.metrics.configLoadTime += data.duration
        break
      case 'variable-resolution':
        this.metrics.variableResolutionTime += data.duration
        break
      case 'plugin-execution':
        this.metrics.pluginExecutionTime += data.duration
        break
    }

    this.metrics.totalExecutionTime += data.duration
  }

  /**
   * 更新内存指标
   */
  private updateMemoryMetrics(): void {
    const memUsage = process.memoryUsage()
    this.metrics.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
    }
  }

  /**
   * 更新缓存命中率
   */
  private updateCacheHitRate(): void {
    const { cacheHits, cacheMisses } = this.metrics.operationCounts
    const total = cacheHits + cacheMisses
    this.metrics.cacheHitRate = total > 0 ? (cacheHits / total) * 100 : 0
  }

  /**
   * 检查内存使用
   */
  private checkMemoryUsage(): void {
    const memUsage = process.memoryUsage()
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024

    if (heapUsedMB > this.options.memoryWarningThreshold) {
      console.warn(`⚠️ High memory usage detected: ${heapUsedMB.toFixed(2)}MB`)

      // 触发垃圾回收（如果可用）
      if (global.gc) {
        global.gc()
        console.log('🗑️ Garbage collection triggered')
      }
    }
  }

  /**
   * 估算对象大小
   */
  private estimateObjectSize(obj: any): number {
    const jsonStr = JSON.stringify(obj)
    return Buffer.byteLength(jsonStr, 'utf8')
  }
}

/**
 * 信号量实现（用于控制并发）
 */
class Semaphore {
  private permits: number
  private queue: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    return new Promise(resolve => {
      if (this.permits > 0) {
        this.permits--
        resolve()
      } else {
        this.queue.push(resolve)
      }
    })
  }

  release(): void {
    this.permits++
    if (this.queue.length > 0) {
      const next = this.queue.shift()!
      this.permits--
      next()
    }
  }
}
