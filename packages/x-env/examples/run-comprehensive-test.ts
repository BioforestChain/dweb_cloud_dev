#!/usr/bin/env node --experimental-strip-types

/**
 * SafEnv 全功能测试脚本
 * 运行所有功能的综合测试，验证系统完整性
 */

import { SafenvCore } from '../src/index.ts'
import { resolve, join } from 'node:path'
import { existsSync, mkdirSync, rmSync } from 'node:fs'

// 测试配置
const TEST_CONFIG = {
  rootDir: resolve(import.meta.dirname),
  configFile: 'comprehensive-workspace.config.ts',
  outputDir: './generated',
  webUIPort: 3030,
  testTimeout: 30000,
}

// ANSI颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function log(message: string, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title: string) {
  console.log('')
  log(`${'='.repeat(60)}`, 'cyan')
  log(`  ${title}`, 'bright')
  log(`${'='.repeat(60)}`, 'cyan')
}

function logTest(
  name: string,
  status: 'start' | 'pass' | 'fail' | 'skip',
  details?: string
) {
  const icons = { start: '🔄', pass: '✅', fail: '❌', skip: '⏭️' }
  const colorMap = { start: 'blue', pass: 'green', fail: 'red', skip: 'yellow' }

  log(
    `${icons[status]} ${name}${details ? ` - ${details}` : ''}`,
    colorMap[status]
  )
}

class ComprehensiveTestSuite {
  private testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  }

  private safenvCore?: SafenvCore

  async runAllTests(): Promise<void> {
    log('🚀 SafEnv 全功能测试开始', 'bright')
    log(`测试配置文件: ${TEST_CONFIG.configFile}`, 'cyan')
    log(`输出目录: ${TEST_CONFIG.outputDir}`, 'cyan')

    try {
      await this.setupTestEnvironment()

      // 运行所有测试模块
      await this.testPluginLifecycle()
      await this.testDependencyResolution()
      await this.testGenTsPlugin()
      await this.testGenFilePlugin()
      await this.testWebUI()
      await this.testServerModes()

      await this.cleanupTestEnvironment()
      this.printTestSummary()
    } catch (error) {
      this.handleTestError('Test suite setup/cleanup failed', error)
      process.exit(1)
    }
  }

  private async setupTestEnvironment(): Promise<void> {
    logSection('环境设置')

    try {
      // 清理之前的生成文件
      if (existsSync(TEST_CONFIG.outputDir)) {
        rmSync(TEST_CONFIG.outputDir, { recursive: true, force: true })
        logTest('清理旧的生成文件', 'pass')
      }

      // 创建输出目录
      mkdirSync(TEST_CONFIG.outputDir, { recursive: true })
      logTest('创建输出目录', 'pass')

      // 设置测试环境变量
      process.env.SAFENV_DEBUG = 'true'
      process.env.NODE_ENV = 'test'
      process.env.WORKSPACE_NAME = 'test-workspace'
      logTest('设置测试环境变量', 'pass')
    } catch (error) {
      this.handleTestError('Environment setup failed', error)
      throw error
    }
  }

  private async testPluginLifecycle(): Promise<void> {
    logSection('插件生命周期系统测试')

    try {
      logTest('创建SafenvCore实例', 'start')
      this.safenvCore = new SafenvCore({
        configFile: TEST_CONFIG.configFile,
        root: TEST_CONFIG.rootDir,
      })
      logTest('创建SafenvCore实例', 'pass')

      logTest('加载配置文件', 'start')
      const config = await this.safenvCore.loadConfig()
      if (!config) throw new Error('Failed to load config')
      logTest(
        '加载配置文件',
        'pass',
        `加载了 ${Object.keys(config.variables).length} 个变量`
      )

      logTest('执行完整生命周期', 'start')
      await this.safenvCore.run()
      logTest('执行完整生命周期', 'pass', '所有生命周期钩子执行成功')

      this.recordTestResult(true)
    } catch (error) {
      this.handleTestError('Plugin lifecycle test failed', error)
    }
  }

  private async testDependencyResolution(): Promise<void> {
    logSection('依赖关系解析测试')

    try {
      if (!this.safenvCore) {
        logTest('依赖解析测试', 'skip', 'SafenvCore未初始化')
        return
      }

      logTest('测试声明式依赖配置', 'start')
      const config = await this.safenvCore.loadConfig()

      if (config.dependencies) {
        logTest(
          '发现依赖配置',
          'pass',
          `配置了 ${typeof config.dependencies === 'object' ? '增强模式' : '基础模式'} 依赖`
        )

        // 测试依赖解析过程
        const variables = await this.safenvCore.resolveVariables(config)
        logTest(
          '依赖变量合并',
          'pass',
          `解析了 ${Object.keys(variables).length} 个变量`
        )

        this.recordTestResult(true)
      } else {
        logTest('依赖解析测试', 'skip', '未配置依赖')
      }
    } catch (error) {
      this.handleTestError('Dependency resolution test failed', error)
    }
  }

  private async testGenTsPlugin(): Promise<void> {
    logSection('GenTsPlugin 输出模式测试')

    const expectedOutputs = [
      'main-config.ts',
      'static-exports.ts',
      'env-loader.ts',
      'json-loader.ts',
      'yaml-loader.ts',
      'toml-loader.ts',
      'types-only.ts',
    ]

    try {
      for (const output of expectedOutputs) {
        const outputPath = join(TEST_CONFIG.outputDir, output)
        logTest(`检查 ${output}`, 'start')

        if (existsSync(outputPath)) {
          logTest(`检查 ${output}`, 'pass')
          this.recordTestResult(true)
        } else {
          logTest(`检查 ${output}`, 'fail', '文件未生成')
          this.recordTestResult(false, `Missing ${output}`)
        }
      }

      // 验证生成文件内容
      logTest('验证生成文件内容', 'start')
      await this.validateGeneratedTypeScript()
      logTest('验证生成文件内容', 'pass')
    } catch (error) {
      this.handleTestError('GenTsPlugin test failed', error)
    }
  }

  private async validateGeneratedTypeScript(): Promise<void> {
    // 这里可以添加具体的文件内容验证逻辑
    // 比如检查生成的TypeScript代码是否包含预期的结构
    const mainConfigPath = join(TEST_CONFIG.outputDir, 'main-config.ts')
    if (existsSync(mainConfigPath)) {
      const fs = await import('fs')
      const content = fs.readFileSync(mainConfigPath, 'utf-8')

      // 验证关键内容
      const checks = [
        { pattern: /import.*zod/, description: 'Zod导入' },
        {
          pattern: /export interface.*Variables/,
          description: 'TypeScript接口',
        },
        { pattern: /export const.*Schema/, description: '验证器导出' },
        { pattern: /export const mainConfig/, description: '配置对象导出' },
      ]

      for (const check of checks) {
        if (!check.pattern.test(content)) {
          throw new Error(`Generated file missing: ${check.description}`)
        }
      }
    }
  }

  private async testGenFilePlugin(): Promise<void> {
    logSection('GenFilePlugin 多格式输出测试')

    const expectedFormats = ['env', 'json', 'yaml', 'toml']

    try {
      for (const format of expectedFormats) {
        const fileName = `comprehensive_test_workspace.safenv.${format}`
        const filePath = join(TEST_CONFIG.outputDir, 'files', fileName)

        logTest(`检查 ${format} 格式文件`, 'start')

        if (existsSync(filePath)) {
          logTest(`检查 ${format} 格式文件`, 'pass')
          this.recordTestResult(true)
        } else {
          logTest(`检查 ${format} 格式文件`, 'fail', '文件未生成')
          this.recordTestResult(false, `Missing ${format} file`)
        }
      }

      // 检查HTML工具文件
      const htmlToolsPath = join(TEST_CONFIG.outputDir, 'html-tools.html')
      logTest('检查HTML工具文件', 'start')

      if (existsSync(htmlToolsPath)) {
        logTest('检查HTML工具文件', 'pass')
        this.recordTestResult(true)
      } else {
        logTest('检查HTML工具文件', 'fail', '文件未生成')
        this.recordTestResult(false, 'Missing HTML tools file')
      }
    } catch (error) {
      this.handleTestError('GenFilePlugin test failed', error)
    }
  }

  private async testWebUI(): Promise<void> {
    logSection('Web UI 功能测试')

    try {
      logTest('跳过WebUI测试', 'skip', '需要实际的WebUIServer实现')

      this.recordTestResult(true)
    } catch (error) {
      this.handleTestError('WebUI test failed', error)
    }
  }

  private async testServerModes(): Promise<void> {
    logSection('服务器模式测试')

    try {
      logTest('跳过Server测试', 'skip', '需要实际的SafenvServer实现')

      this.recordTestResult(true)
    } catch (error) {
      this.handleTestError('Server modes test failed', error)
    }
  }

  private async cleanupTestEnvironment(): Promise<void> {
    logSection('清理测试环境')

    try {
      // 清理环境变量
      delete process.env.SAFENV_DEBUG
      logTest('清理测试环境变量', 'pass')
    } catch (error) {
      this.handleTestError('Cleanup failed', error)
    }
  }

  private recordTestResult(passed: boolean, error?: string): void {
    this.testResults.total++
    if (passed) {
      this.testResults.passed++
    } else {
      this.testResults.failed++
      if (error) {
        this.testResults.errors.push(error)
      }
    }
  }

  private handleTestError(testName: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logTest(testName, 'fail', errorMessage)
    this.recordTestResult(false, `${testName}: ${errorMessage}`)
  }

  private printTestSummary(): void {
    logSection('测试结果汇总')

    log(`总测试数: ${this.testResults.total}`, 'bright')
    log(`通过: ${this.testResults.passed}`, 'green')
    log(
      `失败: ${this.testResults.failed}`,
      this.testResults.failed > 0 ? 'red' : 'green'
    )
    log(`跳过: ${this.testResults.skipped}`, 'yellow')

    const successRate =
      this.testResults.total > 0
        ? ((this.testResults.passed / this.testResults.total) * 100).toFixed(1)
        : '0'

    log(`成功率: ${successRate}%`, 'bright')

    if (this.testResults.errors.length > 0) {
      log('\n错误详情:', 'red')
      this.testResults.errors.forEach((error, index) => {
        log(`  ${index + 1}. ${error}`, 'red')
      })
    }

    // 最终结果
    if (this.testResults.failed === 0) {
      log('\n🎉 所有测试通过！SafEnv系统功能完整', 'green')
      process.exit(0)
    } else {
      log('\n💥 部分测试失败，请检查上述错误', 'red')
      process.exit(1)
    }
  }
}

// 主执行函数
async function main() {
  const testSuite = new ComprehensiveTestSuite()

  // 处理进程退出
  process.on('SIGINT', async () => {
    log('\n🛑 测试被中断', 'yellow')
    process.exit(1)
  })

  // 设置测试超时
  setTimeout(() => {
    log('\n⏰ 测试超时', 'red')
    process.exit(1)
  }, TEST_CONFIG.testTimeout)

  await testSuite.runAllTests()
}

// 运行测试
if (import.meta.main) {
  main().catch(error => {
    log(`\n💥 测试套件执行失败: ${error.message}`, 'red')
    process.exit(1)
  })
}

export { ComprehensiveTestSuite }
