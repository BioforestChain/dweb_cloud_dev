#!/usr/bin/env node

import { Command } from 'commander'
import inquirer from 'inquirer'
import chalk from 'chalk'
import ora from 'ora'
import { table } from 'table'
import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { PerformanceManager } from '../performance-manager.ts'
import { HotReloadManager } from '../hot-reload-manager.ts'
import { startVisualizerCommand } from './visualizer-server.ts'
import { analyzePerformance, analyzeDependencies } from './cli-functions.ts'
import { resolveOptimized } from '../optimized-core.ts'
import type { SafenvConfig } from '../types.ts'

/**
 * CLI 配置选项
 */
interface CLIOptions {
  config?: string
  output?: string
  format?: 'json' | 'yaml' | 'env' | 'toml'
  watch?: boolean
  performance?: boolean
  verbose?: boolean
  debug?: boolean
}

/**
 * 增强的 CLI 工具
 * 提供配置初始化、验证、性能分析等功能
 */
class EnhancedCLI {
  private spinner = ora()

  /**
   * 初始化配置文件
   */
  async initConfig(options: {
    path?: string
    template?: 'basic' | 'advanced' | 'enterprise'
    interactive?: boolean
  }): Promise<void> {
    const configPath = options.path || 'safenv.config.json'

    if (existsSync(configPath)) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `Configuration file ${configPath} already exists. Overwrite?`,
          default: false,
        },
      ])

      if (!overwrite) {
        console.log(chalk.yellow('Configuration initialization cancelled.'))
        return
      }
    }

    let config: SafenvConfig

    if (options.interactive) {
      config = await this.interactiveConfigCreation()
    } else {
      config = this.getTemplateConfig(options.template || 'basic')
    }

    await mkdir(dirname(resolve(configPath)), { recursive: true })
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

    console.log(chalk.green(`✅ Configuration file created: ${configPath}`))
    console.log(
      chalk.blue('💡 Run `safenv validate` to check your configuration')
    )
  }

  /**
   * 交互式配置创建
   */
  private async interactiveConfigCreation(): Promise<SafenvConfig> {
    console.log(chalk.blue('🚀 Interactive Configuration Setup'))

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: 'my-project',
      },
      {
        type: 'list',
        name: 'environment',
        message: 'Primary environment:',
        choices: ['development', 'production', 'staging', 'test'],
        default: 'development',
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features to enable:',
        choices: [
          { name: 'Hot reload', value: 'hotReload' },
          { name: 'Performance monitoring', value: 'performance' },
          { name: 'Enhanced dependency resolution', value: 'enhancedDeps' },
          { name: 'Advanced variable validation', value: 'advancedValidation' },
        ],
      },
      {
        type: 'confirm',
        name: 'addSampleVars',
        message: 'Add sample environment variables?',
        default: true,
      },
    ])

    const config: SafenvConfig = {
      variables: {},
      plugins: [],
      dependencies: [],
    }

    if (answers.addSampleVars) {
      config.variables = {
        NODE_ENV: { value: answers.environment },
        PORT: { env: 'PORT', default: '3000', type: 'number' },
        DATABASE_URL: {
          env: 'DATABASE_URL',
          default: 'postgresql://localhost:5432/mydb',
          validate: (
            value:
              | string
              | number
              | boolean
              | Record<string, unknown>
              | unknown[]
          ) => {
            const pattern = /^postgresql:\/\/.+/
            return (
              (typeof value === 'string' && pattern.test(value)) ||
              'Must be a valid PostgreSQL connection string'
            )
          },
        },
        API_SECRET: {
          env: 'API_SECRET',
          required: true,
          sensitive: true,
        },
      }
    }

    return config
  }

  /**
   * 获取模板配置
   */
  private getTemplateConfig(template: string): SafenvConfig {
    const templates = {
      basic: {
        variables: {
          NODE_ENV: { value: 'development' },
          PORT: { env: 'PORT', default: '3000' },
        },
        plugins: [],
      },
      advanced: {
        variables: {
          NODE_ENV: { value: 'development' },
          PORT: { env: 'PORT', default: '3000', type: 'number' },
          DATABASE_URL: {
            env: 'DATABASE_URL',
            default: 'postgresql://localhost:5432/mydb',
            validate: {
              pattern: '^postgresql://.+',
            },
          },
          REDIS_URL: { env: 'REDIS_URL', default: 'redis://localhost:6379' },
          LOG_LEVEL: {
            env: 'LOG_LEVEL',
            default: 'info',
            validate: {
              enum: ['debug', 'info', 'warn', 'error'],
            },
          },
        },
        plugins: ['@safenv/dotenv-plugin'],
        dependencies: [{ path: './.env.local', prefix: 'LOCAL_' }],
      },
      enterprise: {
        variables: {
          NODE_ENV: { value: 'production' },
          PORT: { env: 'PORT', default: '8080', type: 'number' },
          DATABASE_URL: {
            env: 'DATABASE_URL',
            required: true,
            validate: {
              pattern: '^postgresql://.+',
            },
          },
          REDIS_CLUSTER: {
            env: 'REDIS_CLUSTER',
            type: 'string' as const,
            default: ['redis://localhost:6379'],
          },
          JWT_SECRET: {
            env: 'JWT_SECRET',
            required: true,
            sensitive: true,
            validate: {
              minLength: 32,
            },
          },
          RATE_LIMIT: {
            env: 'RATE_LIMIT',
            default: '1000',
            type: 'number' as const,
            validate: {
              min: 1,
              max: 10000,
            },
          },
        },
        plugins: [
          '@safenv/dotenv-plugin',
          '@safenv/vault-plugin',
          '@safenv/validation-plugin',
        ],
        dependencies: [
          { path: './.env.production', prefix: 'PROD_' },
          { path: './.env.secrets', prefix: 'SECRET_', encrypted: true },
        ],
        performance: {
          enableCache: true,
          enableParallel: true,
          enableProfiling: true,
        },
      },
    }

    return (templates as any)[template] || templates.basic
  }

  /**
   * 验证配置文件
   */
  async validateConfig(configPath: string, options: CLIOptions): Promise<void> {
    this.spinner.start('Validating configuration...')

    try {
      const config = await this.loadConfig(configPath)
      const errors: string[] = []
      const warnings: string[] = []

      // 基本结构验证
      if (!config.variables) {
        errors.push('Missing variables section')
      }

      // 变量验证
      if (config.variables) {
        for (const [name, variable] of Object.entries(config.variables)) {
          if (typeof variable === 'object' && variable !== null) {
            if (
              'required' in variable &&
              variable.required &&
              !('env' in variable) &&
              !('value' in variable)
            ) {
              errors.push(
                `Variable ${name} is required but has no value or env source`
              )
            }

            if ('validate' in variable && variable.validate) {
              const validation = variable.validate
              if ('pattern' in validation && validation.pattern) {
                try {
                  new RegExp((validation as any).pattern || '')
                } catch {
                  errors.push(
                    `Variable ${name} has invalid regex pattern: ${validation.pattern}`
                  )
                }
              }
            }
          }
        }
      }

      // 依赖验证
      if (config.dependencies) {
        const deps = Array.isArray(config.dependencies)
          ? config.dependencies
          : []
        for (const dep of deps) {
          if (typeof dep === 'object' && 'path' in dep) {
            const depPath = resolve(dirname(configPath), (dep as any).path)
            if (!existsSync(depPath)) {
              warnings.push(`Dependency file not found: ${(dep as any).path}`)
            }
          }
        }
      }

      this.spinner.stop()

      if (errors.length === 0 && warnings.length === 0) {
        console.log(chalk.green('✅ Configuration is valid!'))
      } else {
        if (errors.length > 0) {
          console.log(chalk.red('❌ Configuration has errors:'))
          errors.forEach(error => console.log(chalk.red(`  • ${error}`)))
        }

        if (warnings.length > 0) {
          console.log(chalk.yellow('⚠️  Configuration warnings:'))
          warnings.forEach(warning =>
            console.log(chalk.yellow(`  • ${warning}`))
          )
        }
      }

      if (options.verbose) {
        console.log('\n' + chalk.blue('📊 Configuration Summary:'))
        console.log(`Variables: ${Object.keys(config.variables || {}).length}`)
        console.log(`Plugins: ${(config.plugins || []).length}`)
        const depCount = Array.isArray(config.dependencies)
          ? config.dependencies.length
          : 0
        console.log(`Dependencies: ${depCount}`)
      }
    } catch (error) {
      this.spinner.fail('Configuration validation failed')
      console.error(chalk.red(`Error: ${error}`))
      process.exit(1)
    }
  }

  /**
   * 解析配置并生成输出
   */
  async resolveConfig(configPath: string, options: CLIOptions): Promise<void> {
    this.spinner.start('Resolving configuration...')

    try {
      const result = await resolveOptimized(configPath, {
        performance: {
          enableCache: true,
          enableParallel: true,
          enableProfiling: options.performance || options.verbose,
        },
        useEnhancedDependencyResolver: true,
        useEnhancedVariableResolver: true,
      })

      this.spinner.succeed('Configuration resolved successfully!')

      // 显示解析结果
      if (options.verbose) {
        console.log('\n' + chalk.blue('📊 Performance Metrics:'))
        const metricsTable = [
          ['Metric', 'Value'],
          ['Total Time', `${result.metrics.totalTime.toFixed(2)}ms`],
          ['Config Load Time', `${result.metrics.configLoadTime.toFixed(2)}ms`],
          [
            'Variable Resolution Time',
            `${result.metrics.variableResolutionTime.toFixed(2)}ms`,
          ],
          [
            'Plugin Execution Time',
            `${result.metrics.pluginExecutionTime.toFixed(2)}ms`,
          ],
          ['Cache Hit Rate', `${result.metrics.cacheHitRate.toFixed(1)}%`],
          [
            'Parallel Operations',
            result.metrics.parallelOperationsCount.toString(),
          ],
        ]
        console.log(table(metricsTable))
      }

      // 显示变量
      console.log('\n' + chalk.blue('🔧 Resolved Variables:'))
      const variableTable = [['Name', 'Value', 'Source']]

      for (const [name, value] of Object.entries(result.variables)) {
        const config = result.context.config.variables?.[name]
        let source = 'direct'

        if (typeof config === 'object' && config !== null) {
          if ('env' in config) source = `env:${config.env}`
          else if ('value' in config) source = 'config'
        }

        const displayValue =
          typeof value === 'string' && value.length > 50
            ? value.substring(0, 47) + '...'
            : String(value)

        variableTable.push([name, displayValue, source])
      }

      console.log(table(variableTable))

      // 显示警告和错误
      if (result.warnings.length > 0) {
        console.log('\n' + chalk.yellow('⚠️  Warnings:'))
        result.warnings.forEach((warning: any) =>
          console.log(chalk.yellow(`⚠️  ${warning}`))
        )
      }

      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((error: any) =>
          console.log(chalk.red(`❌ ${error}`))
        )
      }

      // 输出到文件
      if (options.output) {
        await this.outputVariables(
          result.variables,
          options.output,
          options.format || 'json'
        )
        console.log(
          chalk.green(`\n💾 Variables exported to: ${options.output}`)
        )
      }
    } catch (error) {
      this.spinner.fail('Configuration resolution failed')
      console.error(chalk.red(`Error: ${error}`))
      process.exit(1)
    }
  }

  /**
   * 性能分析
   */
  async analyzePerformance(
    configPath: string,
    _options: CLIOptions
  ): Promise<void> {
    console.log(chalk.blue('🔍 Performance Analysis'))

    const performanceManager = new PerformanceManager({
      enableCache: true,
      enableParallel: true,
      enableProfiling: true,
    })

    // 运行多次解析来收集性能数据
    const runs = 5
    const results = []

    this.spinner.start(`Running ${runs} performance tests...`)

    for (let i = 0; i < runs; i++) {
      const startTime = Date.now()
      await resolveOptimized(configPath, {
        performance: { enableProfiling: true },
      })
      const endTime = Date.now()
      results.push(endTime - startTime)
    }

    this.spinner.succeed('Performance analysis completed!')

    // 计算统计数据
    const avg = results.reduce((a, b) => a + b, 0) / results.length
    const min = Math.min(...results)
    const max = Math.max(...results)

    console.log('\n' + chalk.blue('📊 Performance Statistics:'))
    const statsTable = [
      ['Metric', 'Value'],
      ['Average Time', `${avg.toFixed(2)}ms`],
      ['Minimum Time', `${min.toFixed(2)}ms`],
      ['Maximum Time', `${max.toFixed(2)}ms`],
      [
        'Standard Deviation',
        `${Math.sqrt(results.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / results.length).toFixed(2)}ms`,
      ],
    ]
    console.log(table(statsTable))

    // 缓存统计
    const cacheStats = performanceManager.getCacheStats()
    console.log('\n' + chalk.blue('💾 Cache Statistics:'))
    const cacheTable = [
      ['Metric', 'Value'],
      ['Cache Size', cacheStats.size.toString()],
      ['Hit Rate', `${cacheStats.hitRate.toFixed(1)}%`],
      ['Memory Usage', `${(cacheStats.memoryUsage / 1024).toFixed(2)}KB`],
    ]
    console.log(table(cacheTable))

    // 性能建议
    console.log('\n' + chalk.blue('💡 Performance Recommendations:'))
    if (avg > 1000) {
      console.log(
        chalk.yellow('  • Consider enabling caching for better performance')
      )
    }
    if (cacheStats.hitRate < 50) {
      console.log(
        chalk.yellow('  • Low cache hit rate - consider adjusting cache TTL')
      )
    }
    if (results.some(r => r > avg * 2)) {
      console.log(
        chalk.yellow(
          '  • High variance detected - check for external dependencies'
        )
      )
    }
  }

  /**
   * 监听模式
   */
  async watchConfig(configPath: string, options: CLIOptions): Promise<void> {
    console.log(chalk.blue('👀 Watching configuration for changes...'))

    const hotReloadManager = new HotReloadManager({
      debounceMs: 500,
      onChange: async changes => {
        console.log(
          chalk.yellow(
            `\n🔄 Configuration changed: ${(changes as any).dependencies?.join(', ') || 'unknown'}`
          )
        )

        try {
          await this.resolveConfig(configPath, { ...options, verbose: false })
          console.log(chalk.green('✅ Configuration reloaded successfully'))
        } catch (error) {
          console.error(chalk.red(`❌ Reload failed: ${error}`))
        }
      },
    })

    await hotReloadManager.startWatching(configPath, {} as any)

    console.log(chalk.green('✅ Watching started. Press Ctrl+C to stop.'))

    // 保持进程运行
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Stopping watcher...'))
      await hotReloadManager.stopWatching()
      process.exit(0)
    })
  }

  /**
   * 加载配置文件
   */
  private async loadConfig(configPath: string): Promise<SafenvConfig> {
    const content = await readFile(resolve(configPath), 'utf-8')
    return JSON.parse(content)
  }

  /**
   * 输出变量到文件
   */
  private async outputVariables(
    variables: Record<string, any>,
    outputPath: string,
    format: string
  ): Promise<void> {
    let content: string

    switch (format) {
      case 'env':
        content = Object.entries(variables)
          .map(([key, value]) => `${key}=${String(value)}`)
          .join('\n')
        break
      case 'yaml':
        content = Object.entries(variables)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join('\n')
        break
      case 'toml':
        content = Object.entries(variables)
          .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
          .join('\n')
        break
      case 'json':
      default:
        content = JSON.stringify(variables, null, 2)
        break
    }

    await mkdir(dirname(resolve(outputPath)), { recursive: true })
    await writeFile(outputPath, content, 'utf-8')
  }
}

/**
 * 主程序
 */
async function main() {
  const cli = new EnhancedCLI()

  const program = new Command()

  program
    .name('safenv')
    .description(
      'Enhanced SafeEnv CLI - Advanced environment variable management'
    )
    .version('1.0.0')

  // 初始化命令
  program
    .command('init')
    .description('Initialize a new SafeEnv configuration')
    .option(
      '-p, --path <path>',
      'Configuration file path',
      'safenv.config.json'
    )
    .option('-t, --template <template>', 'Configuration template', 'basic')
    .option('-i, --interactive', 'Interactive configuration setup', false)
    .action(async options => {
      await cli.initConfig(options)
    })

  // 验证命令
  program
    .command('validate')
    .description('Validate SafeEnv configuration')
    .option(
      '-c, --config <path>',
      'Configuration file path',
      'safenv.config.json'
    )
    .option('-v, --verbose', 'Verbose output', false)
    .action(async options => {
      await cli.validateConfig(options.config, options)
    })

  // 解析命令
  program
    .command('resolve')
    .description('Resolve configuration and display variables')
    .option(
      '-c, --config <path>',
      'Configuration file path',
      'safenv.config.json'
    )
    .option('-o, --output <path>', 'Output file path')
    .option(
      '-f, --format <format>',
      'Output format (json|yaml|env|toml)',
      'json'
    )
    .option('-v, --verbose', 'Verbose output', false)
    .option('-p, --performance', 'Show performance metrics', false)
    .action(async options => {
      await cli.resolveConfig(options.config, options)
    })

  // 性能分析命令
  program
    .command('analyze')
    .description('Analyze configuration performance')
    .option('-c, --config <path>', 'Configuration file path')
    .option(
      '-f, --format <format>',
      'Output format (json, table, detailed)',
      'table'
    )
    .option('--threshold <ms>', 'Performance threshold in milliseconds', '100')
    .action(async options => {
      await analyzePerformance(options)
    })

  // 依赖可视化命令
  program
    .command('visualize')
    .description('Start dependency visualization server')
    .option('-p, --port <port>', 'Server port', '3000')
    .option('--no-open', 'Do not open browser automatically')
    .option('--project <path>', 'Project path', process.cwd())
    .action(async options => {
      await startVisualizerCommand({
        port: parseInt(options.port),
        projectPath: options.project,
        open: options.open,
      })
    })

  // 依赖分析命令
  program
    .command('deps')
    .description('Analyze environment variable dependencies')
    .option('-c, --config <path>', 'Configuration file path')
    .option('-f, --format <format>', 'Output format (json, table)', 'table')
    .option(
      '--filter <category>',
      'Filter by category (npm, monorepo, all)',
      'all'
    )
    .action(async options => {
      await analyzeDependencies(options)
    })

  // 监听命令
  program
    .command('watch')
    .description('Watch configuration for changes')
    .option(
      '-c, --config <path>',
      'Configuration file path',
      'safenv.config.json'
    )
    .option('-v, --verbose', 'Verbose output', false)
    .action(async options => {
      await cli.watchConfig(options.config, options)
    })

  await program.parseAsync()
}

// 运行主程序
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error)
    process.exit(1)
  })
}

export { EnhancedCLI }
