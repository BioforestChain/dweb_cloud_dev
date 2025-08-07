import chalk from 'chalk'
import ora from 'ora'
import { table } from 'table'
import { PerformanceManager } from '../performance-manager.ts'
import { NpmSafenvResolver } from '../npm-safenv-resolver.ts'
import { resolveOptimized } from '../optimized-core.ts'

/**
 * 分析配置性能
 */
export async function analyzePerformance(options: {
  config?: string
  format?: string
  threshold?: string
}): Promise<void> {
  const spinner = ora('Analyzing configuration performance...').start()

  try {
    const configPath = options.config || 'safenv.config.js'
    const threshold = parseInt(options.threshold || '100')

    // 创建性能管理器
    const performanceManager = new PerformanceManager({
      enableCache: true,
      enableProfiling: true,
    })

    // 解析配置并收集性能数据
    const startTime = Date.now()
    const result = await resolveOptimized(configPath)
    const totalTime = Date.now() - startTime

    // 获取性能指标
    const metrics = performanceManager.getMetrics()

    spinner.succeed('Performance analysis completed')

    // 输出结果
    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            totalTime,
            metrics,
            threshold,
            issues:
              totalTime > threshold ? ['Performance threshold exceeded'] : [],
          },
          null,
          2
        )
      )
    } else {
      // 表格格式输出
      console.log(chalk.bold('\n📊 Performance Analysis Results\n'))

      const performanceData = [
        ['Metric', 'Value', 'Status'],
        [
          'Total Time',
          `${totalTime}ms`,
          totalTime > threshold
            ? chalk.red('⚠️  Slow')
            : chalk.green('✅ Good'),
        ],
        [
          'Cache Hits',
          metrics.operationCounts.cacheHits.toString(),
          chalk.blue('ℹ️  Info'),
        ],
        [
          'Cache Misses',
          metrics.operationCounts.cacheMisses.toString(),
          chalk.blue('ℹ️  Info'),
        ],
        [
          'Variables Resolved',
          Object.keys(result.variables || {}).length.toString(),
          chalk.blue('ℹ️  Info'),
        ],
      ]

      console.log(
        table(performanceData, {
          border: {
            topBody: '─',
            topJoin: '┬',
            topLeft: '┌',
            topRight: '┐',
            bottomBody: '─',
            bottomJoin: '┴',
            bottomLeft: '└',
            bottomRight: '┘',
            bodyLeft: '│',
            bodyRight: '│',
            bodyJoin: '│',
            joinBody: '─',
            joinLeft: '├',
            joinRight: '┤',
            joinJoin: '┼',
          },
        })
      )

      if (totalTime > threshold) {
        console.log(chalk.yellow('\n⚠️  Performance recommendations:'))
        console.log('• Enable caching for better performance')
        console.log('• Consider reducing the number of variables')
        console.log('• Optimize validation functions')
      }
    }
  } catch (error: any) {
    spinner.fail('Performance analysis failed')
    console.error(chalk.red('Error:'), error.message)
    process.exit(1)
  }
}

/**
 * 分析环境变量依赖
 */
export async function analyzeDependencies(options: {
  config?: string
  format?: string
  filter?: string
}): Promise<void> {
  const spinner = ora('Analyzing environment variable dependencies...').start()

  try {
    const projectPath = process.cwd()
    const resolver = new NpmSafenvResolver(projectPath)

    // 获取所有依赖的环境变量
    const variables = await resolver.getAllDependencyVariables()
    const configs = await resolver.resolveDependencySafenvConfigs()

    // 应用过滤器
    let filteredVariables = variables
    if (options.filter && options.filter !== 'all') {
      if (options.filter === 'required') {
        filteredVariables = variables.filter(v => v.required)
      } else {
        filteredVariables = variables.filter(v => v.category === options.filter)
      }
    }

    spinner.succeed(
      `Found ${filteredVariables.length} environment variables from ${configs.length} dependencies`
    )

    // 输出结果
    if (options.format === 'json') {
      console.log(
        JSON.stringify(
          {
            summary: {
              totalVariables: variables.length,
              filteredVariables: filteredVariables.length,
              totalDependencies: configs.length,
              requiredVariables: variables.filter(v => v.required).length,
            },
            variables: filteredVariables,
            dependencies: configs.map(c => ({
              name: c.packageName,
              version: c.version,
              category: c.isMonorepoProject ? 'monorepo' : 'npm',
              variableCount: Object.keys(c.variables).length,
            })),
          },
          null,
          2
        )
      )
    } else {
      // 表格格式输出
      console.log(chalk.bold('\n🔗 Dependency Analysis Results\n'))

      // 统计信息
      const stats = [
        ['Metric', 'Count'],
        ['Total Variables', variables.length.toString()],
        ['Filtered Variables', filteredVariables.length.toString()],
        ['Total Dependencies', configs.length.toString()],
        [
          'Required Variables',
          variables.filter(v => v.required).length.toString(),
        ],
        [
          'NPM Packages',
          variables.filter(v => v.category === 'npm').length.toString(),
        ],
        [
          'Monorepo Projects',
          variables.filter(v => v.category === 'monorepo').length.toString(),
        ],
      ]

      console.log(
        table(stats, {
          border: {
            topBody: '─',
            topJoin: '┬',
            topLeft: '┌',
            topRight: '┐',
            bottomBody: '─',
            bottomJoin: '┴',
            bottomLeft: '└',
            bottomRight: '┘',
            bodyLeft: '│',
            bodyRight: '│',
            bodyJoin: '│',
            joinBody: '─',
            joinLeft: '├',
            joinRight: '┤',
            joinJoin: '┼',
          },
        })
      )

      // 变量详情
      if (filteredVariables.length > 0) {
        console.log(chalk.bold('\n📋 Environment Variables:\n'))

        const variableData = [
          ['Variable', 'Type', 'Required', 'Source', 'Category', 'Default'],
          ...filteredVariables.map(v => [
            v.variable,
            v.type,
            v.required ? chalk.red('Yes') : chalk.green('No'),
            v.source,
            v.category === 'npm'
              ? chalk.yellow('NPM')
              : v.category === 'monorepo'
                ? chalk.blue('Monorepo')
                : chalk.gray('Local'),
            v.defaultValue !== undefined
              ? String(v.defaultValue)
              : chalk.gray('None'),
          ]),
        ]

        console.log(
          table(variableData, {
            border: {
              topBody: '─',
              topJoin: '┬',
              topLeft: '┌',
              topRight: '┐',
              bottomBody: '─',
              bottomJoin: '┴',
              bottomLeft: '└',
              bottomRight: '┘',
              bodyLeft: '│',
              bodyRight: '│',
              bodyJoin: '│',
              joinBody: '─',
              joinLeft: '├',
              joinRight: '┤',
              joinJoin: '┼',
            },
          })
        )
      }

      // 建议
      const requiredCount = filteredVariables.filter(v => v.required).length
      if (requiredCount > 0) {
        console.log(
          chalk.yellow(
            `\n⚠️  You have ${requiredCount} required environment variables that need to be configured.`
          )
        )
        console.log(
          chalk.blue(
            '💡 Use `safenv visualize` to explore dependencies interactively.'
          )
        )
      }
    }
  } catch (error: any) {
    spinner.fail('Dependency analysis failed')
    console.error(chalk.red('Error:'), error.message)
    process.exit(1)
  }
}
