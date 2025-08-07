import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  OptimizedCore,
  createOptimizedCore,
  resolveOptimized,
} from '../optimized-core.ts'
import type { SafenvConfig } from '../types.ts'
import { stringVar } from '../config-builder.ts'

describe('OptimizedCore', () => {
  let tempDir: string
  let configPath: string
  let optimizedCore: OptimizedCore
  let mockConfig: SafenvConfig

  beforeEach(async () => {
    // 创建临时目录和配置文件
    tempDir = join(process.cwd(), 'temp-test-' + Date.now())
    await mkdir(tempDir, { recursive: true })

    configPath = join(tempDir, 'safenv.config.json')

    mockConfig = {
      variables: {
        NODE_ENV: { value: 'test' },
        PORT: { value: '3000' },
        DB_URL: { env: 'DATABASE_URL', default: 'localhost:5432' },
        API_KEY: { value: 'secret-key' },
      },
      plugins: [],
      dependencies: [],
    }

    await writeFile(configPath, JSON.stringify(mockConfig, null, 2))

    optimizedCore = new OptimizedCore({
      performance: {
        enableCache: true,
        enableParallel: true,
        enableProfiling: true,
        cacheTTL: 1000,
        maxCacheSize: 100,
      },
      useEnhancedDependencyResolver: true,
      useEnhancedVariableResolver: true,
      enableHotReload: false,
    })
  })

  afterEach(async () => {
    await optimizedCore.cleanup()
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('基本解析功能', () => {
    it('应该成功解析配置文件', async () => {
      const result = await optimizedCore.resolve(configPath)

      expect(result.variables).toBeDefined()
      expect(result.context).toBeDefined()
      expect(result.metrics).toBeDefined()
      expect(result.warnings).toBeInstanceOf(Array)
      expect(result.errors).toBeInstanceOf(Array)

      // 检查解析的变量
      expect(result.variables.NODE_ENV).toBe('test')
      expect(result.variables.PORT).toBe('3000')
      expect(result.variables.API_KEY).toBe('secret-key')
    })

    it('应该处理环境变量', async () => {
      // 设置环境变量
      process.env.DATABASE_URL = 'postgres://localhost:5432/testdb'

      const result = await optimizedCore.resolve(configPath)

      expect(result.variables.DB_URL).toBe('postgres://localhost:5432/testdb')

      // 清理环境变量
      delete process.env.DATABASE_URL
    })

    it('应该使用默认值当环境变量不存在时', async () => {
      // 确保环境变量不存在
      delete process.env.DATABASE_URL

      const result = await optimizedCore.resolve(configPath)

      expect(result.variables.DB_URL).toBe('localhost:5432')
    })

    it('应该处理复杂的配置结构', async () => {
      const complexConfig: SafenvConfig = {
        variables: {
          SIMPLE: { value: 'simple-value' },
          FROM_ENV: { env: 'TEST_ENV_VAR', default: 'default-value' },
          COMPUTED: {
            value: '${NODE_ENV}-${PORT}',
            type: 'string',
          },
        },
        plugins: [],
        dependencies: [],
      }

      const complexConfigPath = join(tempDir, 'complex.config.json')
      await writeFile(complexConfigPath, JSON.stringify(complexConfig, null, 2))

      const result = await optimizedCore.resolve(complexConfigPath)

      expect(result.variables.SIMPLE).toBe('simple-value')
      expect(result.variables.FROM_ENV).toBe('default-value')
      expect(result.variables).toHaveProperty('COMPUTED')
    })
  })

  describe('性能优化功能', () => {
    it('应该使用缓存提高性能', async () => {
      // 第一次解析
      const start1 = Date.now()
      const result1 = await optimizedCore.resolve(configPath)
      const time1 = Date.now() - start1

      // 第二次解析（应该使用缓存）
      const start2 = Date.now()
      const result2 = await optimizedCore.resolve(configPath)
      const time2 = Date.now() - start2

      expect(result1.variables).toEqual(result2.variables)
      expect(time2).toBeLessThan(time1) // 第二次应该更快

      const metrics = optimizedCore.getPerformanceMetrics()
      expect(metrics.cacheHitRate).toBeGreaterThan(0)
    })

    it('应该提供详细的性能指标', async () => {
      await optimizedCore.resolve(configPath)

      const metrics = optimizedCore.getPerformanceMetrics()

      expect(metrics.totalExecutionTime).toBeGreaterThan(0)
      expect(metrics.configLoadTime).toBeGreaterThan(0)
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(metrics.operationCounts.parallelOperations).toBeGreaterThanOrEqual(
        0
      )

      expect(metrics).toHaveProperty('dependencyResolutionTime')
      expect(metrics).toHaveProperty('variableResolutionTime')
      expect(metrics).toHaveProperty('pluginExecutionTime')
    })

    it('应该提供缓存统计信息', async () => {
      await optimizedCore.resolve(configPath)
      await optimizedCore.resolve(configPath) // 第二次调用使用缓存

      const cacheStats = optimizedCore.getCacheStats()

      expect(cacheStats.size).toBeGreaterThan(0)
      expect(cacheStats.hitRate).toBeGreaterThanOrEqual(0)
      expect(cacheStats.memoryUsage).toBeGreaterThan(0)
      expect(cacheStats.entries).toBeInstanceOf(Array)
    })

    it('应该支持并行处理', async () => {
      // 创建多个配置文件来测试并行处理
      const configs: string[] = []
      for (let i = 0; i < 3; i++) {
        const configFile = join(tempDir, `config${i}.json`)
        const config = {
          variables: {
            [`VAR${i}`]: { value: `value${i}` },
          },
        }
        await writeFile(configFile, JSON.stringify(config, null, 2))
        configs.push(configFile)
      }

      // 并行解析多个配置
      const promises = configs.map(config => optimizedCore.resolve(config))
      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      results.forEach((result, i) => {
        expect(result.variables[`VAR${i}`]).toBe(`value${i}`)
      })

      const metrics = optimizedCore.getPerformanceMetrics()
      expect(metrics.operationCounts.parallelOperations).toBeGreaterThan(0)
    })
  })

  describe('增量更新功能', () => {
    it('应该检测配置变更', async () => {
      // 初始解析
      await optimizedCore.resolve(configPath)

      // 修改配置
      const updatedConfig = {
        ...mockConfig,
        variables: {
          ...mockConfig.variables,
          NEW_VAR: { value: 'new-value' },
        },
      }
      await writeFile(configPath, JSON.stringify(updatedConfig, null, 2))

      // 增量更新
      const result = await optimizedCore.incrementalResolve(configPath, [
        'NEW_VAR',
      ])

      expect(result.variables.NEW_VAR).toBe('new-value')
      expect(result.variables.NODE_ENV).toBe('test') // 原有变量保持不变
    })

    it('应该处理结构性变更', async () => {
      // 初始解析
      await optimizedCore.resolve(configPath)

      // 添加插件（结构性变更）
      const updatedConfig = {
        ...mockConfig,
        plugins: ['new-plugin'],
      }
      await writeFile(configPath, JSON.stringify(updatedConfig, null, 2))

      // 增量更新应该回退到完整解析
      const result = await optimizedCore.incrementalResolve(configPath, [
        'plugins',
      ])

      expect(result.context.config.plugins).toContain('new-plugin')
    })
  })

  describe('错误处理', () => {
    it('应该处理配置文件不存在的情况', async () => {
      const nonExistentPath = join(tempDir, 'non-existent.json')

      await expect(optimizedCore.resolve(nonExistentPath)).rejects.toThrow()
    })

    it('应该处理无效的JSON配置', async () => {
      const invalidConfigPath = join(tempDir, 'invalid.json')
      await writeFile(invalidConfigPath, '{ invalid json }')

      await expect(optimizedCore.resolve(invalidConfigPath)).rejects.toThrow()
    })

    it('应该收集并报告错误', async () => {
      const configWithError: SafenvConfig = {
        variables: {
          VALID_VAR: { value: 'valid' },
          INVALID_VAR: { env: 'NON_EXISTENT_ENV' }, // 可能导致警告
        },
      }

      const errorConfigPath = join(tempDir, 'error.config.json')
      await writeFile(errorConfigPath, JSON.stringify(configWithError, null, 2))

      const result = await optimizedCore.resolve(errorConfigPath)

      expect(result.errors).toBeInstanceOf(Array)
      expect(result.warnings).toBeInstanceOf(Array)
    })
  })

  describe('热更新功能', () => {
    it('应该支持启用热更新', async () => {
      const hotReloadCore = new OptimizedCore({
        enableHotReload: true,
        hotReloadOptions: {
          debounceMs: 100,
          maxSnapshots: 5,
          autoRollback: true,
        },
      })

      try {
        const result = await hotReloadCore.resolve(configPath)
        expect(result.variables).toBeDefined()
      } finally {
        await hotReloadCore.cleanup()
      }
    })
  })

  describe('便捷函数', () => {
    it('createOptimizedCore 应该创建实例', () => {
      const core = createOptimizedCore({
        performance: { enableCache: false },
      })

      expect(core).toBeInstanceOf(OptimizedCore)
    })

    it('resolveOptimized 应该执行完整的解析流程', async () => {
      const result = await resolveOptimized(configPath, {
        performance: {
          enableCache: true,
          enableProfiling: true,
        },
      })

      expect(result.variables).toBeDefined()
      expect(result.context).toBeDefined()
      expect(result.metrics).toBeDefined()
      expect(result.metrics.totalTime).toBeGreaterThan(0)
    })

    it('resolveOptimized 应该自动清理资源', async () => {
      // 这个测试主要确保函数能正常完成而不抛出错误
      await expect(resolveOptimized(configPath)).resolves.toBeDefined()
    })
  })

  describe('集成测试', () => {
    it('应该与所有增强组件协同工作', async () => {
      const envDir = join(tempDir, 'env')
      const fullFeaturedConfig: SafenvConfig = {
        variables: {
          NODE_ENV: { value: 'production' },
          PORT: { env: 'PORT', default: '8080' },
          DB_URL: {
            env: 'DATABASE_URL',
            default: 'postgresql://localhost:5432/app',
            type: 'string',
          },
          REDIS_URL: stringVar({
            default: 'redis://localhost:6379',
            validate: value => {
              return value.startsWith('redis://')
            },
          }),
        },
        dependencies: [join(envDir, '.env.local')],
        plugins: [],
      }

      // 创建依赖文件
      await mkdir(envDir, { recursive: true })
      await writeFile(
        join(envDir, '.env.local'),
        'LOCAL_SECRET=local-secret\nLOCAL_DEBUG=true'
      )

      const fullConfigPath = join(tempDir, 'full.config.json')
      await writeFile(
        fullConfigPath,
        JSON.stringify(fullFeaturedConfig, null, 2)
      )

      const result = await optimizedCore.resolve(fullConfigPath)

      expect(result.variables.NODE_ENV).toBe('production')
      expect(result.variables.PORT).toBe('8080')
      expect(result.variables.DB_URL).toBe('postgresql://localhost:5432/app')
      expect(result.variables.REDIS_URL).toBe('redis://localhost:6379')

      // 检查性能指标
      expect(result.metrics.totalTime).toBeGreaterThan(0)
      expect(result.metrics.configLoadTime).toBeGreaterThan(0)

      // 检查上下文
      expect(result.context.mode).toBe('test') // 测试环境
      expect(result.context.configPath).toBe(fullConfigPath)
    })

    it('应该处理复杂的依赖关系', async () => {
      // 创建多层依赖的配置
      const baseConfig = {
        variables: {
          BASE_VAR: { value: 'base' },
        },
      }

      const extendedConfig = {
        variables: {
          EXTENDED_VAR: { value: 'extended' },
        },
        dependencies: ['./base.config.json'],
      }

      const baseConfigPath = join(tempDir, 'base.config.json')
      const extendedConfigPath = join(tempDir, 'extended.config.json')

      await writeFile(baseConfigPath, JSON.stringify(baseConfig, null, 2))
      await writeFile(
        extendedConfigPath,
        JSON.stringify(extendedConfig, null, 2)
      )

      const result = await optimizedCore.resolve(extendedConfigPath)

      expect(result.variables.BASE_VAR).toBe('base')
      expect(result.variables.EXTENDED_VAR).toBe('extended')
    })
  })

  describe('内存和资源管理', () => {
    it('应该正确清理资源', async () => {
      await optimizedCore.resolve(configPath)

      // 清理不应该抛出错误
      await expect(optimizedCore.cleanup()).resolves.toBeUndefined()
    })

    it('应该监控内存使用', async () => {
      await optimizedCore.resolve(configPath)

      const metrics = optimizedCore.getPerformanceMetrics()
      expect(metrics).toHaveProperty('memoryUsage')
      expect(metrics.memoryUsage.heapUsed).toBeGreaterThan(0)
      expect(metrics.memoryUsage.heapTotal).toBeGreaterThan(0)
    })
  })
})
