#!/usr/bin/env tsx

import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import chalk from 'chalk'
import { OptimizedCore, resolveOptimized } from '../src/optimized-core.ts'
import { PerformanceManager } from '../src/performance-manager.ts'
import { EnhancedDependencyResolver } from '../src/enhanced-dependency-resolver.ts'
import { EnhancedVariableResolver } from '../src/enhanced-variable-resolver.ts'
import { HotReloadManager } from '../src/hot-reload-manager.ts'
import type { SafenvConfig } from '../src/types.ts'

/**
 * x-env 优化功能演示
 * 展示性能优化、缓存、并行处理、热更新等功能
 */
class OptimizationDemo {
  private demoDir = join(process.cwd(), 'demo-output')

  async run(): Promise<void> {
    console.log(chalk.blue.bold('🚀 x-env 优化功能演示'))
    console.log(chalk.gray('='.repeat(50)))

    await this.setupDemoEnvironment()
    await this.demonstratePerformanceOptimizations()
    await this.demonstrateCachingFeatures()
    await this.demonstrateParallelProcessing()
    await this.demonstrateIncrementalUpdates()
    await this.demonstrateHotReload()
    await this.demonstrateEnhancedResolvers()
    await this.showPerformanceComparison()

    console.log(chalk.green.bold('\n✅ 演示完成！'))
    console.log(chalk.blue(`📁 演示文件已保存到: ${this.demoDir}`))
  }

  /**
   * 设置演示环境
   */
  private async setupDemoEnvironment(): Promise<void> {
    console.log(chalk.yellow('\n📦 设置演示环境...'))

    await mkdir(this.demoDir, { recursive: true })

    // 创建基础配置文件
    const baseConfig: SafenvConfig = {
      variables: {
        NODE_ENV: { value: 'development' },
        PORT: { env: 'PORT', default: '3000', type: 'number' },
        DATABASE_URL: {
          env: 'DATABASE_URL',
          default: 'postgresql://localhost:5432/demo',
          validate: {
            pattern: '^postgresql://.+',
          },
        },
        REDIS_URL: { env: 'REDIS_URL', default: 'redis://localhost:6379' },
        API_SECRET: {
          env: 'API_SECRET',
          default: 'demo-secret-key',
          sensitive: true,
        },
        LOG_LEVEL: {
          env: 'LOG_LEVEL',
          default: 'info',
          validate: {
            enum: ['debug', 'info', 'warn', 'error'],
          },
        },
      },
      plugins: [],
      dependencies: [{ path: './demo.env', prefix: 'DEMO_' }],
    }

    // 创建依赖文件
    const envContent = `DEMO_FEATURE_FLAG=true
DEMO_MAX_CONNECTIONS=100
DEMO_TIMEOUT=30000
DEMO_DEBUG_MODE=false`

    await writeFile(
      join(this.demoDir, 'base.config.json'),
      JSON.stringify(baseConfig, null, 2)
    )
    await writeFile(join(this.demoDir, 'demo.env'), envContent)

    console.log(chalk.green('✅ 演示环境设置完成'))
  }

  /**
   * 演示性能优化功能
   */
  private async demonstratePerformanceOptimizations(): Promise<void> {
    console.log(chalk.yellow('\n⚡ 演示性能优化功能...'))

    const configPath = join(this.demoDir, 'base.config.json')

    // 创建优化的核心实例
    const optimizedCore = new OptimizedCore({
      performance: {
        enableCache: true,
        enableParallel: true,
        enableProfiling: true,
        cacheTTL: 5000,
        maxCacheSize: 100,
        maxConcurrency: 4,
      },
      useEnhancedDependencyResolver: true,
      useEnhancedVariableResolver: true,
    })

    try {
      // 第一次解析（冷启动）
      console.log(chalk.blue('  🔄 第一次解析（冷启动）...'))
      const startTime1 = Date.now()
      const result1 = await optimizedCore.resolve(configPath)
      const time1 = Date.now() - startTime1

      console.log(chalk.green(`  ✅ 解析完成: ${time1}ms`))
      console.log(
        chalk.gray(`     变量数量: ${Object.keys(result1.variables).length}`)
      )
      console.log(chalk.gray(`     警告数量: ${result1.warnings.length}`))

      // 第二次解析（使用缓存）
      console.log(chalk.blue('  🔄 第二次解析（使用缓存）...'))
      const startTime2 = Date.now()
      const result2 = await optimizedCore.resolve(configPath)
      const time2 = Date.now() - startTime2

      console.log(chalk.green(`  ✅ 解析完成: ${time2}ms`))
      console.log(
        chalk.green(
          `  🚀 性能提升: ${(((time1 - time2) / time1) * 100).toFixed(1)}%`
        )
      )

      // 显示性能指标
      const metrics = optimizedCore.getPerformanceMetrics()
      console.log(chalk.blue('  📊 性能指标:'))
      console.log(
        chalk.gray(`     缓存命中率: ${metrics.cacheHitRate.toFixed(1)}%`)
      )
      console.log(
        chalk.gray(
          `     并行操作数: ${metrics.operationCounts.parallelOperations}`
        )
      )
      console.log(
        chalk.gray(
          `     内存使用: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`
        )
      )

      await optimizedCore.cleanup()
    } catch (error) {
      console.error(chalk.red(`❌ 性能优化演示失败: ${error}`))
    }
  }

  /**
   * 演示缓存功能
   */
  private async demonstrateCachingFeatures(): Promise<void> {
    console.log(chalk.yellow('\n💾 演示缓存功能...'))

    const performanceManager = new PerformanceManager({
      enableCache: true,
      cacheTTL: 2000,
      maxCacheSize: 50,
    })

    // 模拟耗时操作
    const expensiveOperation = async (id: string) => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return `result-${id}-${Date.now()}`
    }

    console.log(chalk.blue('  🔄 执行缓存测试...'))

    // 第一次调用
    const start1 = Date.now()
    const result1 = await performanceManager.cached('test-key', () =>
      expensiveOperation('1')
    )
    const time1 = Date.now() - start1
    console.log(chalk.gray(`     第一次调用: ${time1}ms - ${result1}`))

    // 第二次调用（缓存命中）
    const start2 = Date.now()
    const result2 = await performanceManager.cached('test-key', () =>
      expensiveOperation('2')
    )
    const time2 = Date.now() - start2
    console.log(chalk.gray(`     第二次调用: ${time2}ms - ${result2}`))

    // 显示缓存统计
    const cacheStats = performanceManager.getCacheStats()
    console.log(chalk.blue('  📊 缓存统计:'))
    console.log(chalk.gray(`     缓存大小: ${cacheStats.size}`))
    console.log(chalk.gray(`     命中率: ${cacheStats.hitRate.toFixed(1)}%`))
    console.log(
      chalk.gray(
        `     内存使用: ${(cacheStats.memoryUsage / 1024).toFixed(2)}KB`
      )
    )

    console.log(
      chalk.green(
        `  🚀 缓存加速: ${(((time1 - time2) / time1) * 100).toFixed(1)}%`
      )
    )
  }

  /**
   * 演示并行处理
   */
  private async demonstrateParallelProcessing(): Promise<void> {
    console.log(chalk.yellow('\n⚡ 演示并行处理...'))

    const performanceManager = new PerformanceManager({
      enableParallel: true,
      maxConcurrency: 3,
    })

    // 创建模拟任务
    const tasks = Array.from({ length: 5 }, (_, i) => ({
      id: `task-${i}`,
      type: 'config-load' as const,
      fn: async () => {
        const delay = 100 + Math.random() * 200
        await new Promise(resolve => setTimeout(resolve, delay))
        return `Task ${i} completed in ${delay.toFixed(0)}ms`
      },
    }))

    console.log(chalk.blue('  🔄 串行执行测试...'))
    const serialStart = Date.now()
    const serialResults = []
    for (const task of tasks) {
      serialResults.push(await task.fn())
    }
    const serialTime = Date.now() - serialStart
    console.log(chalk.gray(`     串行执行时间: ${serialTime}ms`))

    console.log(chalk.blue('  🔄 并行执行测试...'))
    const parallelStart = Date.now()
    const parallelResults = await performanceManager.executeParallel(tasks)
    const parallelTime = Date.now() - parallelStart
    console.log(chalk.gray(`     并行执行时间: ${parallelTime}ms`))

    console.log(
      chalk.green(
        `  🚀 并行加速: ${(((serialTime - parallelTime) / serialTime) * 100).toFixed(1)}%`
      )
    )
    console.log(chalk.gray(`     任务结果数量: ${parallelResults.length}`))
  }

  /**
   * 演示增量更新
   */
  private async demonstrateIncrementalUpdates(): Promise<void> {
    console.log(chalk.yellow('\n🔄 演示增量更新...'))

    const performanceManager = new PerformanceManager()

    // 创建两个配置版本
    const oldConfig: SafenvConfig = {
      variables: {
        VAR1: { value: 'old-value-1' },
        VAR2: { value: 'same-value' },
        VAR3: { value: 'old-value-3' },
      },
    }

    const newConfig: SafenvConfig = {
      variables: {
        VAR1: { value: 'new-value-1' }, // 修改
        VAR2: { value: 'same-value' }, // 未变更
        VAR4: { value: 'new-value-4' }, // 新增
        // VAR3 被删除
      },
    }

    console.log(chalk.blue('  🔍 检测配置变更...'))
    const changes = performanceManager.detectIncrementalChanges(
      oldConfig,
      newConfig
    )

    console.log(chalk.blue('  📊 变更检测结果:'))
    console.log(chalk.gray(`     有变更: ${changes.hasChanges ? '是' : '否'}`))
    console.log(
      chalk.gray(`     变更的变量: ${changes.changedVariables.join(', ')}`)
    )
    console.log(
      chalk.gray(`     变更哈希: ${changes.changeHash.substring(0, 8)}...`)
    )

    if (changes.hasChanges) {
      console.log(chalk.green('  ✅ 可以执行增量更新'))
    } else {
      console.log(chalk.blue('  ℹ️  无需更新'))
    }
  }

  /**
   * 演示热更新功能
   */
  private async demonstrateHotReload(): Promise<void> {
    console.log(chalk.yellow('\n🔥 演示热更新功能...'))

    const configPath = join(this.demoDir, 'hot-reload-test.json')
    const testConfig: SafenvConfig = {
      variables: {
        TEST_VAR: { value: 'initial-value' },
        COUNTER: { value: '0' },
      },
    }

    await writeFile(configPath, JSON.stringify(testConfig, null, 2))

    let changeCount = 0
    const hotReloadManager = new HotReloadManager({
      debounceMs: 200,
      onChange: async changes => {
        changeCount++
        console.log(
          chalk.green(
            `  🔄 检测到变更 #${changeCount}: ${changes.dependencies.join(', ')}`
          )
        )

        // 模拟重新加载配置
        console.log(chalk.blue('    📦 重新加载配置...'))
        await new Promise(resolve => setTimeout(resolve, 100))
        console.log(chalk.green('    ✅ 配置重新加载完成'))
      },
    })

    try {
      console.log(chalk.blue('  🔄 启动热更新监听...'))
      await hotReloadManager.initialize(configPath, [])

      // 模拟配置变更
      console.log(chalk.blue('  ✏️  模拟配置变更...'))

      await new Promise(resolve => setTimeout(resolve, 500))

      // 第一次变更
      const updatedConfig1 = {
        ...testConfig,
        variables: {
          ...testConfig.variables,
          TEST_VAR: { value: 'updated-value-1' },
        },
      }
      await writeFile(configPath, JSON.stringify(updatedConfig1, null, 2))

      await new Promise(resolve => setTimeout(resolve, 500))

      // 第二次变更
      const updatedConfig2 = {
        ...updatedConfig1,
        variables: {
          ...updatedConfig1.variables,
          COUNTER: { value: '1' },
          NEW_VAR: { value: 'newly-added' },
        },
      }
      await writeFile(configPath, JSON.stringify(updatedConfig2, null, 2))

      await new Promise(resolve => setTimeout(resolve, 500))

      console.log(
        chalk.green(`  ✅ 热更新演示完成，共检测到 ${changeCount} 次变更`)
      )
    } finally {
      await hotReloadManager.destroy()
    }
  }

  /**
   * 演示增强解析器
   */
  private async demonstrateEnhancedResolvers(): Promise<void> {
    console.log(chalk.yellow('\n🔧 演示增强解析器...'))

    // 演示增强依赖解析器
    console.log(chalk.blue('  📦 增强依赖解析器演示...'))
    const dependencyResolver = new EnhancedDependencyResolver()

    const configWithDeps: SafenvConfig = {
      variables: {
        BASE_VAR: { value: 'base' },
      },
      dependencies: [
        {
          path: join(this.demoDir, 'demo.env'),
          prefix: 'DEMO_',
          condition: () => process.env.NODE_ENV !== 'production',
        },
      ],
    }

    try {
      const depResult = await dependencyResolver.resolveEnhanced(
        configWithDeps,
        {
          mode: 'development',
          configPath: join(this.demoDir, 'test.json'),
        }
      )

      console.log(
        chalk.gray(
          `     解析的变量数量: ${Object.keys(depResult.variables).length}`
        )
      )
      console.log(
        chalk.gray(`     依赖文件数量: ${depResult.dependencies.length}`)
      )
      console.log(chalk.gray(`     警告数量: ${depResult.warnings.length}`))
    } catch (error) {
      console.log(chalk.red(`     依赖解析失败: ${error}`))
    }

    // 演示增强变量解析器
    console.log(chalk.blue('  🔧 增强变量解析器演示...'))
    const variableResolver = new EnhancedVariableResolver()

    const complexVariables = {
      SIMPLE_VAR: { value: 'simple' },
      COMPUTED_VAR: {
        value: '${SIMPLE_VAR}_computed',
        type: 'string',
      },
      VALIDATED_NUMBER: {
        value: '42',
        type: 'number',
        validate: {
          min: 1,
          max: 100,
        },
      },
      ASYNC_VAR: {
        value: 'async-test',
        type: 'string',
        validate: async (value: string) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return value.length > 5
        },
      },
    }

    try {
      const varResult = await variableResolver.resolve(complexVariables, {
        mode: 'development',
      })

      console.log(
        chalk.gray(
          `     解析的变量数量: ${Object.keys(varResult.variables).length}`
        )
      )
      console.log(chalk.gray(`     警告数量: ${varResult.warnings.length}`))

      // 显示一些解析结果
      for (const [name, value] of Object.entries(varResult.variables).slice(
        0,
        3
      )) {
        console.log(chalk.gray(`     ${name}: ${value}`))
      }
    } catch (error) {
      console.log(chalk.red(`     变量解析失败: ${error}`))
    }
  }

  /**
   * 显示性能对比
   */
  private async showPerformanceComparison(): Promise<void> {
    console.log(chalk.yellow('\n📊 性能对比测试...'))

    const configPath = join(this.demoDir, 'base.config.json')
    const iterations = 5

    // 基础解析性能
    console.log(chalk.blue('  🔄 基础解析性能测试...'))
    const basicTimes = []
    for (let i = 0; i < iterations; i++) {
      const start = Date.now()
      await resolveOptimized(configPath, {
        performance: { enableCache: false, enableParallel: false },
      })
      basicTimes.push(Date.now() - start)
    }

    // 优化解析性能
    console.log(chalk.blue('  ⚡ 优化解析性能测试...'))
    const optimizedTimes = []
    for (let i = 0; i < iterations; i++) {
      const start = Date.now()
      await resolveOptimized(configPath, {
        performance: {
          enableCache: true,
          enableParallel: true,
          enableProfiling: true,
        },
      })
      optimizedTimes.push(Date.now() - start)
    }

    // 计算统计数据
    const basicAvg = basicTimes.reduce((a, b) => a + b, 0) / basicTimes.length
    const optimizedAvg =
      optimizedTimes.reduce((a, b) => a + b, 0) / optimizedTimes.length
    const improvement = ((basicAvg - optimizedAvg) / basicAvg) * 100

    console.log(chalk.blue('  📊 性能对比结果:'))
    console.log(chalk.gray(`     基础解析平均时间: ${basicAvg.toFixed(2)}ms`))
    console.log(
      chalk.gray(`     优化解析平均时间: ${optimizedAvg.toFixed(2)}ms`)
    )

    if (improvement > 0) {
      console.log(chalk.green(`     性能提升: ${improvement.toFixed(1)}%`))
    } else {
      console.log(chalk.yellow(`     性能变化: ${improvement.toFixed(1)}%`))
    }

    // 保存性能报告
    const report = {
      timestamp: new Date().toISOString(),
      iterations,
      basicPerformance: {
        times: basicTimes,
        average: basicAvg,
        min: Math.min(...basicTimes),
        max: Math.max(...basicTimes),
      },
      optimizedPerformance: {
        times: optimizedTimes,
        average: optimizedAvg,
        min: Math.min(...optimizedTimes),
        max: Math.max(...optimizedTimes),
      },
      improvement: improvement,
    }

    await writeFile(
      join(this.demoDir, 'performance-report.json'),
      JSON.stringify(report, null, 2)
    )

    console.log(chalk.green('  ✅ 性能报告已保存'))
  }
}

/**
 * 运行演示
 */
async function runDemo() {
  const demo = new OptimizationDemo()

  try {
    await demo.run()
  } catch (error) {
    console.error(chalk.red('演示运行失败:'), error)
    process.exit(1)
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo()
}

export { OptimizationDemo }
