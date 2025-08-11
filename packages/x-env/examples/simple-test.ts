#!/usr/bin/env node --experimental-strip-types

/**
 * SafEnv 简化测试脚本
 * 测试核心功能和插件生成
 */

import { SafenvCore } from '../src/core.ts'
import { resolve, join } from 'node:path'
import { existsSync, mkdirSync, rmSync } from 'node:fs'

// 测试配置
const TEST_CONFIG = {
  rootDir: resolve(import.meta.dirname),
  configFile: 'comprehensive-workspace.config.ts',
  outputDir: './generated',
}

console.log('🚀 SafEnv 简化测试开始')
console.log(`测试配置文件: ${TEST_CONFIG.configFile}`)
console.log(`输出目录: ${TEST_CONFIG.outputDir}`)

async function runTest() {
  try {
    // 清理之前的生成文件
    if (existsSync(TEST_CONFIG.outputDir)) {
      rmSync(TEST_CONFIG.outputDir, { recursive: true, force: true })
      console.log('✅ 清理旧的生成文件')
    }

    // 创建输出目录
    mkdirSync(TEST_CONFIG.outputDir, { recursive: true })
    console.log('✅ 创建输出目录')

    // 设置测试环境变量
    process.env.SAFENV_DEBUG = 'true'
    process.env.NODE_ENV = 'test'
    process.env.WORKSPACE_NAME = 'test-workspace'
    console.log('✅ 设置测试环境变量')

    // 创建SafenvCore实例
    console.log('🔄 创建SafenvCore实例')
    const safenvCore = new SafenvCore({
      configFile: TEST_CONFIG.configFile,
      root: TEST_CONFIG.rootDir,
    })
    console.log('✅ 创建SafenvCore实例')

    // 加载配置文件
    console.log('🔄 加载配置文件')
    const config = await safenvCore.loadConfig()
    if (!config) throw new Error('Failed to load config')
    console.log(
      `✅ 加载配置文件 - 加载了 ${Object.keys(config.variables).length} 个变量`
    )

    // 执行完整生命周期
    console.log('🔄 执行完整生命周期')
    await safenvCore.run()
    console.log('✅ 执行完整生命周期 - 所有生命周期钩子执行成功')

    // 检查生成的文件
    const expectedOutputs = [
      'main-config.ts',
      'static-exports.ts',
      'env-loader.ts',
      'json-loader.ts',
      'yaml-loader.ts',
      'toml-loader.ts',
      'types-only.ts',
    ]

    let generatedCount = 0
    for (const output of expectedOutputs) {
      const outputPath = join(TEST_CONFIG.outputDir, output)
      if (existsSync(outputPath)) {
        console.log(`✅ 生成文件: ${output}`)
        generatedCount++
      } else {
        console.log(`❌ 缺少文件: ${output}`)
      }
    }

    // 检查GenFilePlugin输出
    const expectedFormats = ['env', 'json', 'yaml', 'toml']
    let formatCount = 0
    for (const format of expectedFormats) {
      const fileName = `comprehensive_test_workspace.safenv.${format}`
      const filePath = join(TEST_CONFIG.outputDir, 'files', fileName)
      if (existsSync(filePath)) {
        console.log(`✅ 生成格式文件: ${format}`)
        formatCount++
      } else {
        console.log(`❌ 缺少格式文件: ${format}`)
      }
    }

    // 检查HTML工具文件
    const htmlToolsPath = join(TEST_CONFIG.outputDir, 'html-tools.html')
    const hasHtmlTools = existsSync(htmlToolsPath)
    if (hasHtmlTools) {
      console.log('✅ 生成HTML工具文件')
    } else {
      console.log('❌ 缺少HTML工具文件')
    }

    console.log('\n📊 测试结果汇总:')
    console.log(`TypeScript文件: ${generatedCount}/${expectedOutputs.length}`)
    console.log(`格式文件: ${formatCount}/${expectedFormats.length}`)
    console.log(`HTML工具: ${hasHtmlTools ? '1/1' : '0/1'}`)

    const totalExpected = expectedOutputs.length + expectedFormats.length + 1
    const totalGenerated = generatedCount + formatCount + (hasHtmlTools ? 1 : 0)
    const successRate = ((totalGenerated / totalExpected) * 100).toFixed(1)

    console.log(`总体成功率: ${successRate}%`)

    if (totalGenerated === totalExpected) {
      console.log('\n🎉 所有测试通过！SafEnv系统功能完整')
      process.exit(0)
    } else {
      console.log('\n💥 部分测试失败，请检查上述错误')
      process.exit(1)
    }
  } catch (error) {
    console.error('💥 测试执行失败:', error.message)
    if (process.env.SAFENV_DEBUG === 'true') {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// 运行测试
runTest()
