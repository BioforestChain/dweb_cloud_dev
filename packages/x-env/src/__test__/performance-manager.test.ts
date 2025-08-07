import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PerformanceManager } from '../performance-manager.ts'
import type { SafenvConfig } from '../types.ts'

describe('PerformanceManager', () => {
  let performanceManager: PerformanceManager

  beforeEach(() => {
    performanceManager = new PerformanceManager({
      enableCache: true,
      cacheTTL: 1000,
      maxCacheSize: 10,
      enableParallel: true,
      maxConcurrency: 2,
      enableProfiling: true,
    })
  })

  afterEach(() => {
    performanceManager.clearCache()
  })

  describe('缓存功能', () => {
    it('应该缓存函数结果', async () => {
      let callCount = 0
      const testFn = async () => {
        callCount++
        return 'result'
      }

      // 第一次调用
      const result1 = await performanceManager.cached('test-key', testFn)
      expect(result1).toBe('result')
      expect(callCount).toBe(1)

      // 第二次调用应该使用缓存
      const result2 = await performanceManager.cached('test-key', testFn)
      expect(result2).toBe('result')
      expect(callCount).toBe(1) // 没有增加

      const metrics = performanceManager.getMetrics()
      expect(metrics.operationCounts.cacheHits).toBe(1)
      expect(metrics.operationCounts.cacheMisses).toBe(1)
    })

    it('应该处理缓存过期', async () => {
      const shortTTLManager = new PerformanceManager({
        enableCache: true,
        cacheTTL: 50, // 50ms
      })

      let callCount = 0
      const testFn = async () => {
        callCount++
        return 'result'
      }

      // 第一次调用
      await shortTTLManager.cached('test-key', testFn)
      expect(callCount).toBe(1)

      // 等待缓存过期
      await new Promise(resolve => setTimeout(resolve, 100))

      // 第二次调用应该重新执行
      await shortTTLManager.cached('test-key', testFn)
      expect(callCount).toBe(2)
    })

    it('应该支持跳过缓存', async () => {
      let callCount = 0
      const testFn = async () => {
        callCount++
        return 'result'
      }

      // 第一次调用
      await performanceManager.cached('test-key', testFn)
      expect(callCount).toBe(1)

      // 跳过缓存的调用
      await performanceManager.cached('test-key', testFn, { skipCache: true })
      expect(callCount).toBe(2)
    })

    it('应该处理缓存大小限制', async () => {
      const smallCacheManager = new PerformanceManager({
        enableCache: true,
        maxCacheSize: 2,
      })

      // 添加超过限制的缓存条目
      await smallCacheManager.cached('key1', async () => 'value1')
      await smallCacheManager.cached('key2', async () => 'value2')
      await smallCacheManager.cached('key3', async () => 'value3')

      const stats = smallCacheManager.getCacheStats()
      expect(stats.size).toBeLessThanOrEqual(2)
    })

    it('应该提供缓存统计信息', async () => {
      await performanceManager.cached('test1', async () => 'result1')
      await performanceManager.cached('test2', async () => 'result2')
      await performanceManager.cached('test1', async () => 'result1') // 缓存命中

      const stats = performanceManager.getCacheStats()
      expect(stats.size).toBe(2)
      expect(stats.hitRate).toBeGreaterThan(0)
      expect(stats.entries).toHaveLength(2)
      expect(stats.memoryUsage).toBeGreaterThan(0)
    })
  })

  describe('并行处理', () => {
    it('应该并行执行独立任务', async () => {
      const startTime = Date.now()
      const tasks = [
        {
          id: 'task1',
          type: 'config-load' as const,
          fn: async () => {
            await new Promise(resolve => setTimeout(resolve, 100))
            return 'result1'
          },
        },
        {
          id: 'task2',
          type: 'variable-resolution' as const,
          fn: async () => {
            await new Promise(resolve => setTimeout(resolve, 100))
            return 'result2'
          },
        },
      ]

      const results = await performanceManager.executeParallel(tasks)
      const duration = Date.now() - startTime

      expect(results).toEqual(['result1', 'result2'])
      expect(duration).toBeLessThan(200) // 应该并行执行，总时间小于串行时间
    })

    it('应该处理任务依赖', async () => {
      const executionOrder: string[] = []

      const tasks = [
        {
          id: 'task1',
          type: 'config-load' as const,
          fn: async () => {
            executionOrder.push('task1')
            return 'result1'
          },
        },
        {
          id: 'task2',
          type: 'variable-resolution' as const,
          dependencies: ['task1'],
          fn: async () => {
            executionOrder.push('task2')
            return 'result2'
          },
        },
        {
          id: 'task3',
          type: 'plugin-execution' as const,
          dependencies: ['task1'],
          fn: async () => {
            executionOrder.push('task3')
            return 'result3'
          },
        },
      ]

      const results = await performanceManager.executeParallel(tasks)

      expect(results).toEqual(['result1', 'result2', 'result3'])
      expect(executionOrder[0]).toBe('task1') // task1 应该最先执行
      expect(executionOrder.indexOf('task2')).toBeGreaterThan(
        executionOrder.indexOf('task1')
      )
      expect(executionOrder.indexOf('task3')).toBeGreaterThan(
        executionOrder.indexOf('task1')
      )
    })

    it('应该处理并发限制', async () => {
      const concurrentTasks = new Set<string>()
      let maxConcurrent = 0

      const tasks = Array.from({ length: 5 }, (_, i) => ({
        id: `task${i}`,
        type: 'config-load' as const,
        fn: async () => {
          concurrentTasks.add(`task${i}`)
          maxConcurrent = Math.max(maxConcurrent, concurrentTasks.size)

          await new Promise(resolve => setTimeout(resolve, 50))

          concurrentTasks.delete(`task${i}`)
          return `result${i}`
        },
      }))

      await performanceManager.executeParallel(tasks)

      // 最大并发数应该不超过设置的限制
      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })

    it('应该处理任务错误', async () => {
      const tasks = [
        {
          id: 'task1',
          type: 'config-load' as const,
          fn: async () => 'success',
        },
        {
          id: 'task2',
          type: 'variable-resolution' as const,
          fn: async () => {
            throw new Error('Task failed')
          },
        },
      ]

      await expect(performanceManager.executeParallel(tasks)).rejects.toThrow(
        'Task failed'
      )
    })
  })

  describe('增量更新检测', () => {
    it('应该检测配置变更', () => {
      const oldConfig: SafenvConfig = {
        variables: {
          VAR1: { value: 'old' },
          VAR2: { value: 'same' },
        },
      }

      const newConfig: SafenvConfig = {
        variables: {
          VAR1: { value: 'new' }, // 修改
          VAR2: { value: 'same' }, // 未变更
          VAR3: { value: 'added' }, // 新增
        },
      }

      const changes = performanceManager.detectIncrementalChanges(
        oldConfig,
        newConfig
      )

      expect(changes.hasChanges).toBe(true)
      expect(changes.changedVariables).toContain('VAR1')
      expect(changes.changedVariables).toContain('VAR3')
      expect(changes.changedVariables).not.toContain('VAR2')
      expect(changes.changeHash).toBeDefined()
    })

    it('应该检测插件变更', () => {
      const oldConfig: SafenvConfig = {
        variables: {},
        plugins: ['plugin1', 'plugin2'],
      }

      const newConfig: SafenvConfig = {
        variables: {},
        plugins: ['plugin1', 'plugin3'],
      }

      const changes = performanceManager.detectIncrementalChanges(
        oldConfig,
        newConfig
      )

      expect(changes.hasChanges).toBe(true)
      expect(changes.changedPlugins).toEqual(['plugin1', 'plugin3'])
    })

    it('应该检测无变更情况', () => {
      const config: SafenvConfig = {
        variables: {
          VAR1: { value: 'test' },
        },
        plugins: ['plugin1'],
      }

      const changes = performanceManager.detectIncrementalChanges(
        config,
        config
      )

      expect(changes.hasChanges).toBe(false)
      expect(changes.changedVariables).toHaveLength(0)
      expect(changes.changedPlugins).toHaveLength(0)
    })
  })

  describe('性能监控', () => {
    it('应该记录操作性能', async () => {
      const testOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return 'result'
      }

      await performanceManager.withProfiling('config-load', testOperation)

      const metrics = performanceManager.getMetrics()
      expect(metrics.configLoadTime).toBeGreaterThan(0)
      expect(metrics.totalExecutionTime).toBeGreaterThan(0)
    })

    it('应该处理操作错误', async () => {
      const failingOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        throw new Error('Operation failed')
      }

      await expect(
        performanceManager.withProfiling(
          'variable-resolution',
          failingOperation
        )
      ).rejects.toThrow('Operation failed')

      // 即使操作失败，也应该记录性能数据
      const metrics = performanceManager.getMetrics()
      expect(metrics.totalExecutionTime).toBeGreaterThan(0)
    })

    it('应该提供完整的性能指标', async () => {
      // 执行一些操作来生成指标
      await performanceManager.cached('test', async () => 'result')
      await performanceManager.withProfiling(
        'plugin-execution',
        async () => 'result'
      )

      const metrics = performanceManager.getMetrics()

      expect(metrics).toHaveProperty('configLoadTime')
      expect(metrics).toHaveProperty('variableResolutionTime')
      expect(metrics).toHaveProperty('pluginExecutionTime')
      expect(metrics).toHaveProperty('cacheHitRate')
      expect(metrics).toHaveProperty('totalExecutionTime')
      expect(metrics).toHaveProperty('memoryUsage')
      expect(metrics).toHaveProperty('operationCounts')

      expect(metrics.memoryUsage).toHaveProperty('heapUsed')
      expect(metrics.memoryUsage).toHaveProperty('heapTotal')
      expect(metrics.memoryUsage).toHaveProperty('external')

      expect(metrics.operationCounts).toHaveProperty('cacheHits')
      expect(metrics.operationCounts).toHaveProperty('cacheMisses')
      expect(metrics.operationCounts).toHaveProperty('parallelOperations')
      expect(metrics.operationCounts).toHaveProperty('incrementalUpdates')
    })

    it('应该重置性能指标', async () => {
      // 生成一些指标
      await performanceManager.withProfiling(
        'config-load',
        async () => 'result'
      )

      let metrics = performanceManager.getMetrics()
      expect(metrics.totalExecutionTime).toBeGreaterThan(0)

      // 重置指标
      performanceManager.resetMetrics()

      metrics = performanceManager.getMetrics()
      expect(metrics.totalExecutionTime).toBe(0)
      expect(metrics.configLoadTime).toBe(0)
      expect(metrics.operationCounts.cacheHits).toBe(0)
    })
  })

  describe('内存管理', () => {
    it('应该监控内存使用', () => {
      const metrics = performanceManager.getMetrics()

      expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0)
      expect(metrics.memoryUsage.heapTotal).toBeGreaterThan(0)
    })

    it('应该清理缓存', async () => {
      // 添加一些缓存条目
      await performanceManager.cached('key1', async () => 'value1')
      await performanceManager.cached('key2', async () => 'value2')

      let stats = performanceManager.getCacheStats()
      expect(stats.size).toBe(2)

      // 清理缓存
      performanceManager.clearCache()

      stats = performanceManager.getCacheStats()
      expect(stats.size).toBe(0)
    })
  })

  describe('配置选项', () => {
    it('应该支持禁用缓存', async () => {
      const noCacheManager = new PerformanceManager({
        enableCache: false,
      })

      let callCount = 0
      const testFn = async () => {
        callCount++
        return 'result'
      }

      // 多次调用应该每次都执行
      await noCacheManager.cached('test-key', testFn)
      await noCacheManager.cached('test-key', testFn)

      expect(callCount).toBe(2)
    })

    it('应该支持禁用并行处理', async () => {
      const serialManager = new PerformanceManager({
        enableParallel: false,
      })

      const startTime = Date.now()
      const tasks = [
        {
          id: 'task1',
          type: 'config-load' as const,
          fn: async () => {
            await new Promise(resolve => setTimeout(resolve, 50))
            return 'result1'
          },
        },
        {
          id: 'task2',
          type: 'variable-resolution' as const,
          fn: async () => {
            await new Promise(resolve => setTimeout(resolve, 50))
            return 'result2'
          },
        },
      ]

      const results = await serialManager.executeParallel(tasks)
      const duration = Date.now() - startTime

      expect(results).toEqual(['result1', 'result2'])
      expect(duration).toBeGreaterThanOrEqual(100) // 应该串行执行
    })

    it('应该支持禁用性能监控', async () => {
      const noProfilingManager = new PerformanceManager({
        enableProfiling: false,
      })

      const testOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'result'
      }

      const result = await noProfilingManager.withProfiling(
        'config-load',
        testOperation
      )
      expect(result).toBe('result')

      // 性能指标应该保持初始状态
      const metrics = noProfilingManager.getMetrics()
      expect(metrics.configLoadTime).toBe(0)
    })
  })
})
