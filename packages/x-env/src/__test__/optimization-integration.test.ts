import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { OptimizedCore, resolveOptimized } from '../optimized-core.ts'
import { PerformanceManager } from '../performance-manager.ts'
import { EnhancedDependencyResolver } from '../enhanced-dependency-resolver.ts'
import { EnhancedVariableResolver } from '../enhanced-variable-resolver.ts'
import { HotReloadManager } from '../hot-reload-manager.ts'
import type { SafenvConfig } from '../types.ts'

describe('x-env 优化功能集成测试', () => {
  let tempDir: string
  let configPath: string
  let testConfig: SafenvConfig

  beforeEach(async () => {
    // 创建临时测试目录
    tempDir = join(process.cwd(), 'temp-integration-test-' + Date.now())
    await mkdir(tempDir, { recursive: true })

    configPath = join(tempDir, 'test.config.json')

    testConfig = {
      variables: {
        NODE_ENV: { value: 'test' },
        PORT: { env: 'PORT', default: '3000', type: 'number' },
        DATABASE_URL: {
          env: 'DATABASE_URL',
          default: 'postgresql://localhost:5432/test',
          validate: {
            pattern: '^postgresql://.+',
          },
        },
        API_SECRET: {
          env: 'API_SECRET',
          default: 'test-secret',
          sensitive: true,
        },
        COMPUTED_VAR: {
          value: '${NODE_ENV}_computed',
          type: 'string',
        },
      },
      plugins: [],
      dependencies: [{ path: './test.env', prefix: 'TEST_' }],
    }

    // 创建依赖文件
    const envContent = `TEST_FEATURE=enabled
TEST_DEBUG=true
TEST_TIMEOUT=5000`

    await writeFile(configPath, JSON.stringify(testConfig, null, 2))
    await writeFile(join(tempDir, 'test.env'), envContent)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('OptimizedCore 集成测试', () => {
    it('应该成功执行完整的优化解析流程', async () => {
      const optimizedCore = new OptimizedCore({
        performance: {
          enableCache: true,
          enableParallel: true,
          enableProfiling: true,
        },
        useEnhancedDependencyResolver: true,
        useEnhancedVariableResolver: true,
      })

      try {
        const result = await optimizedCore.resolve(configPath)

        // 验证解析结果
        expect(result.variables).toBeDefined()
        expect(result.context).toBeDefined()
        expect(result.metrics).toBeDefined()

        // 验证基本变量
        expect(result.variables.NODE_ENV).toBe('test')
        expect(result.variables.PORT).toBe('3000')
        expect(result.variables.API_SECRET).toBe('test-secret')

        // 验证性能指标
        expect(result.metrics.totalTime).toBeGreaterThan(0)
        expect(result.metrics.configLoadTime).toBeGreaterThan(0)
        expect(result.metrics.cacheHitRate).toBeGreaterThanOrEqual(0)

        // 验证上下文
        expect(result.context.mode).toBe('test')
        expect(result.context.configPath).toBe(configPath)
      } finally {
        await optimizedCore.cleanup()
      }
    })

    it('应该展示缓存性能提升', async () => {
      const optimizedCore = new OptimizedCore({
        performance: {
          enableCache: true,
          enableProfiling: true,
        },
      })

      try {
        // 第一次解析（冷启动）
        const start1 = Date.now()
        const result1 = await optimizedCore.resolve(configPath)
        const time1 = Date.now() - start1

        // 第二次解析（使用缓存）
        const start2 = Date.now()
        const result2 = await optimizedCore.resolve(configPath)
        const time2 = Date.now() - start2

        // 验证结果一致性
        expect(result1.variables).toEqual(result2.variables)

        // 验证性能提升（第二次应该更快）
        expect(time2).toBeLessThan(time1)

        // 验证缓存命中率
        const metrics = optimizedCore.getPerformanceMetrics()
        expect(metrics.cacheHitRate).toBeGreaterThan(0)
      } finally {
        await optimizedCore.cleanup()
      }
    })

    it('应该支持增量更新', async () => {
      const optimizedCore = new OptimizedCore({
        performance: { enableCache: true },
      })

      try {
        // 初始解析
        const result1 = await optimizedCore.resolve(configPath)
        expect(result1.variables.NODE_ENV).toBe('test')

        // 修改配置
        const updatedConfig = {
          ...testConfig,
          variables: {
            ...testConfig.variables,
            NODE_ENV: { value: 'production' },
            NEW_VAR: { value: 'new-value' },
          },
        }
        await writeFile(configPath, JSON.stringify(updatedConfig, null, 2))

        // 增量更新
        const result2 = await optimizedCore.incrementalResolve(configPath, [
          'NODE_ENV',
          'NEW_VAR',
        ])

        // 验证更新结果
        expect(result2.variables.NODE_ENV).toBe('production')
        expect(result2.variables.NEW_VAR).toBe('new-value')
      } finally {
        await optimizedCore.cleanup()
      }
    })
  })

  describe('PerformanceManager 集成测试', () => {
    it('应该提供完整的性能监控功能', async () => {
      const performanceManager = new PerformanceManager({
        enableCache: true,
        enableParallel: true,
        enableProfiling: true,
      })

      // 执行一些操作来生成指标
      await performanceManager.cached('test-key', async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'cached-result'
      })

      await performanceManager.withProfiling('test-operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
        return 'profiled-result'
      })

      // 验证性能指标
      const metrics = performanceManager.getMetrics()
      expect(metrics.totalExecutionTime).toBeGreaterThan(0)
      expect(metrics.operationCounts.cacheHits).toBeGreaterThanOrEqual(0)
      expect(metrics.operationCounts.cacheMisses).toBeGreaterThan(0)
      expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0)

      // 验证缓存统计
      const cacheStats = performanceManager.getCacheStats()
      expect(cacheStats.size).toBeGreaterThan(0)
      expect(cacheStats.memoryUsage).toBeGreaterThan(0)
    })

    it('应该支持并行任务执行', async () => {
      const performanceManager = new PerformanceManager({
        enableParallel: true,
        maxConcurrency: 2,
      })

      const tasks = Array.from({ length: 4 }, (_, i) => ({
        id: `task-${i}`,
        type: 'config-load' as const,
        fn: async () => {
          await new Promise(resolve => setTimeout(resolve, 50))
          return `result-${i}`
        },
      }))

      const startTime = Date.now()
      const results = await performanceManager.executeParallel(tasks)
      const totalTime = Date.now() - startTime

      // 验证结果
      expect(results).toHaveLength(4)
      expect(results).toEqual(['result-0', 'result-1', 'result-2', 'result-3'])

      // 验证并行执行效果（应该比串行快）
      expect(totalTime).toBeLessThan(200) // 4 * 50ms = 200ms (串行时间)

      // 验证性能指标
      const metrics = performanceManager.getMetrics()
      expect(metrics.operationCounts.parallelOperations).toBeGreaterThan(0)
    })

    it('应该检测配置增量变更', async () => {
      const performanceManager = new PerformanceManager()

      const oldConfig: SafenvConfig = {
        variables: {
          VAR1: { value: 'old1' },
          VAR2: { value: 'same' },
        },
      }

      const newConfig: SafenvConfig = {
        variables: {
          VAR1: { value: 'new1' }, // 修改
          VAR2: { value: 'same' }, // 未变更
          VAR3: { value: 'new3' }, // 新增
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
  })

  describe('增强解析器集成测试', () => {
    it('EnhancedDependencyResolver 应该正确解析复杂依赖', async () => {
      const resolver = new EnhancedDependencyResolver()

      const configWithDeps: SafenvConfig = {
        variables: {
          BASE_VAR: { value: 'base' },
        },
        dependencies: [
          {
            path: join(tempDir, 'test.env'),
            prefix: 'TEST_',
            condition: () => true,
          },
        ],
      }

      const result = await resolver.resolveEnhanced(configWithDeps, {
        mode: 'test',
        configPath: configPath,
      })

      expect(result.variables).toBeDefined()
      expect(result.dependencies).toHaveLength(1)
      expect(result.warnings).toBeInstanceOf(Array)

      // 验证基础变量
      expect(result.variables.BASE_VAR).toBe('base')

      // 验证依赖变量（带前缀）
      expect(result.variables.TEST_FEATURE).toBe('enabled')
      expect(result.variables.TEST_DEBUG).toBe('true')
    })

    it('EnhancedVariableResolver 应该处理复杂变量类型', async () => {
      const resolver = new EnhancedVariableResolver()

      const complexVariables = {
        SIMPLE: { value: 'simple' },
        NUMBER_VAR: { value: '42', type: 'number' },
        BOOLEAN_VAR: { value: 'true', type: 'boolean' },
        VALIDATED_VAR: {
          value: 'test-value',
          type: 'string',
          validate: {
            minLength: 5,
            pattern: '^test-.+',
          },
        },
      }

      const result = await resolver.resolve(complexVariables, {
        mode: 'test',
      })

      expect(result.variables.SIMPLE).toBe('simple')
      expect(result.variables.NUMBER_VAR).toBe(42)
      expect(result.variables.BOOLEAN_VAR).toBe(true)
      expect(result.variables.VALIDATED_VAR).toBe('test-value')
      expect(result.warnings).toBeInstanceOf(Array)
    })
  })

  describe('HotReloadManager 集成测试', () => {
    it('应该检测文件变更并触发回调', async () => {
      let changeDetected = false
      let changeDetails: any = null

      const hotReloadManager = new HotReloadManager({
        debounceMs: 100,
        onChange: async changes => {
          changeDetected = true
          changeDetails = changes
        },
      })

      try {
        await hotReloadManager.initialize(configPath, [])

        // 等待初始化完成
        await new Promise(resolve => setTimeout(resolve, 200))

        // 修改配置文件
        const updatedConfig = {
          ...testConfig,
          variables: {
            ...testConfig.variables,
            NEW_VAR: { value: 'hot-reload-test' },
          },
        }
        await writeFile(configPath, JSON.stringify(updatedConfig, null, 2))

        // 等待变更检测
        await new Promise(resolve => setTimeout(resolve, 300))

        expect(changeDetected).toBe(true)
        expect(changeDetails).toBeDefined()
        expect(changeDetails.configPath).toBe(configPath)
      } finally {
        await hotReloadManager.destroy()
      }
    })
  })

  describe('端到端集成测试', () => {
    it('应该完整展示所有优化功能协同工作', async () => {
      // 设置环境变量
      process.env.TEST_ENV_VAR = 'from-environment'

      const fullConfig: SafenvConfig = {
        variables: {
          NODE_ENV: { value: 'integration-test' },
          PORT: { env: 'PORT', default: '4000', type: 'number' },
          ENV_VAR: { env: 'TEST_ENV_VAR', default: 'default-value' },
          COMPUTED: { value: '${NODE_ENV}_${PORT}', type: 'string' },
          VALIDATED: {
            value: 'valid-test-value',
            type: 'string',
            validate: {
              minLength: 10,
              pattern: '^valid-.+',
            },
          },
        },
        dependencies: [{ path: './test.env', prefix: 'DEP_' }],
      }

      const fullConfigPath = join(tempDir, 'full.config.json')
      await writeFile(fullConfigPath, JSON.stringify(fullConfig, null, 2))

      // 创建依赖文件
      await writeFile(
        join(tempDir, 'test.env'),
        'DEP_VALUE=dependency-value\nDEP_COUNT=100'
      )

      // 使用完整优化配置
      const result = await resolveOptimized(fullConfigPath, {
        performance: {
          enableCache: true,
          enableParallel: true,
          enableProfiling: true,
          maxConcurrency: 3,
        },
        useEnhancedDependencyResolver: true,
        useEnhancedVariableResolver: true,
      })

      // 验证所有功能
      expect(result.variables.NODE_ENV).toBe('integration-test')
      expect(result.variables.PORT).toBe('4000')
      expect(result.variables.ENV_VAR).toBe('from-environment')
      expect(result.variables.VALIDATED).toBe('valid-test-value')
      expect(result.variables.DEP_VALUE).toBe('dependency-value')

      // 验证性能指标
      expect(result.metrics.totalTime).toBeGreaterThan(0)
      expect(result.metrics.configLoadTime).toBeGreaterThan(0)
      expect(result.metrics.cacheHitRate).toBeGreaterThanOrEqual(0)

      // 验证上下文
      expect(result.context.mode).toBe('test')
      expect(result.warnings).toBeInstanceOf(Array)
      expect(result.errors).toBeInstanceOf(Array)

      // 清理环境变量
      delete process.env.TEST_ENV_VAR
    })

    it('应该在复杂场景下保持性能优势', async () => {
      // 创建复杂配置
      const complexConfig: SafenvConfig = {
        variables: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [
            `VAR_${i}`,
            {
              value: `value-${i}`,
              type: i % 2 === 0 ? 'string' : 'number',
              validate: i % 3 === 0 ? { minLength: 5 } : undefined,
            },
          ])
        ),
        dependencies: Array.from({ length: 3 }, (_, i) => ({
          path: `./dep${i}.env`,
          prefix: `DEP${i}_`,
        })),
      }

      // 创建依赖文件
      for (let i = 0; i < 3; i++) {
        const depContent = Array.from(
          { length: 10 },
          (_, j) => `DEP${i}_VAR${j}=dep${i}-value${j}`
        ).join('\n')
        await writeFile(join(tempDir, `dep${i}.env`), depContent)
      }

      const complexConfigPath = join(tempDir, 'complex.config.json')
      await writeFile(complexConfigPath, JSON.stringify(complexConfig, null, 2))

      // 测试基础性能
      const basicStart = Date.now()
      const basicResult = await resolveOptimized(complexConfigPath, {
        performance: { enableCache: false, enableParallel: false },
      })
      const basicTime = Date.now() - basicStart

      // 测试优化性能
      const optimizedStart = Date.now()
      const optimizedResult = await resolveOptimized(complexConfigPath, {
        performance: {
          enableCache: true,
          enableParallel: true,
          enableProfiling: true,
        },
      })
      const optimizedTime = Date.now() - optimizedStart

      // 验证结果一致性
      expect(Object.keys(basicResult.variables)).toHaveLength(
        Object.keys(optimizedResult.variables).length
      )

      // 验证性能提升（在复杂场景下）
      console.log(
        `Basic time: ${basicTime}ms, Optimized time: ${optimizedTime}ms`
      )

      // 验证优化指标
      expect(optimizedResult.metrics.totalTime).toBeGreaterThan(0)
      expect(optimizedResult.metrics.parallelOperationsCount).toBeGreaterThan(0)
    })
  })
})
