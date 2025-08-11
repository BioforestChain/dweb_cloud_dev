#!/usr/bin/env node

/**
 * 可运行的插件快照验证脚本
 *
 * 这个脚本避免了 TypeScript 语法限制，直接验证快照文件的正确性
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

console.log('🧪 开始验证插件快照文件\n')

const snapshotDir = './test-snapshots'
const results = []

function validateTest(test, passed, details) {
  results.push({ test, passed, details })
  console.log(`${passed ? '✅' : '❌'} ${test}`)
  if (details && typeof details === 'object') {
    console.log('   详情:', JSON.stringify(details, null, 2))
  }
}

// 1. 验证快照文件存在性
function validateSnapshotFiles() {
  console.log('🔍 验证快照文件存在性')

  const expectedFiles = [
    'genFile-plugin.snapshot.json',
    'genTs-plugin.snapshot.json',
    'workspace-plugin.snapshot.json',
    'api-usage.snapshot.json',
    'test-report.json',
  ]

  const existingFiles = expectedFiles.filter(file =>
    existsSync(join(snapshotDir, file))
  )

  validateTest(
    '快照文件存在性检查',
    existingFiles.length === expectedFiles.length,
    {
      expected: expectedFiles.length,
      found: existingFiles.length,
      missing: expectedFiles.filter(f => !existingFiles.includes(f)),
    }
  )

  return existingFiles
}

// 2. 验证 genFile 插件快照
function validateGenFileSnapshot() {
  console.log('\n🔍 验证 genFile 插件快照')

  try {
    const snapshotPath = join(snapshotDir, 'genFile-plugin.snapshot.json')
    if (!existsSync(snapshotPath)) {
      validateTest('genFile 快照文件', false, { error: '文件不存在' })
      return
    }

    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'))

    // 验证快照结构
    const hasRequiredFields = !!(
      snapshot.pluginName &&
      snapshot.expectedOutputs &&
      snapshot.validation &&
      snapshot.testCases
    )

    validateTest('genFile 快照结构', hasRequiredFields, {
      pluginName: snapshot.pluginName,
      hasOutputs: !!snapshot.expectedOutputs,
      hasValidation: !!snapshot.validation,
      testCaseCount: snapshot.testCases?.length || 0,
    })

    // 验证输出格式
    const expectedFormats = ['env', 'json', 'yaml']
    const hasAllFormats = expectedFormats.every(
      format => snapshot.expectedOutputs?.[format]
    )

    validateTest('genFile 输出格式完整性', hasAllFormats, {
      expectedFormats,
      availableFormats: Object.keys(snapshot.expectedOutputs || {}),
    })

    // 验证 JSON 格式有效性
    let jsonValid = false
    try {
      JSON.parse(snapshot.expectedOutputs.json)
      jsonValid = true
    } catch (e) {
      // JSON 无效
    }

    validateTest('genFile JSON 输出有效性', jsonValid, {
      jsonContent: snapshot.expectedOutputs?.json?.substring(0, 100) + '...',
    })
  } catch (error) {
    validateTest('genFile 快照验证', false, { error: error.message })
  }
}

// 3. 验证 genTs 插件快照
function validateGenTsSnapshot() {
  console.log('\n🔍 验证 genTs 插件快照')

  try {
    const snapshotPath = join(snapshotDir, 'genTs-plugin.snapshot.json')
    if (!existsSync(snapshotPath)) {
      validateTest('genTs 快照文件', false, { error: '文件不存在' })
      return
    }

    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'))

    // 验证快照结构
    const hasRequiredFields = !!(
      snapshot.pluginName &&
      snapshot.expectedOutput &&
      snapshot.validation &&
      snapshot.validatorStyles
    )

    validateTest('genTs 快照结构', hasRequiredFields, {
      pluginName: snapshot.pluginName,
      hasOutput: !!snapshot.expectedOutput,
      hasValidation: !!snapshot.validation,
      validatorStyleCount: Object.keys(snapshot.validatorStyles || {}).length,
    })

    // 验证 TypeScript 输出内容
    const tsOutput = snapshot.expectedOutput || ''
    const hasInterface = tsOutput.includes('interface ProcessEnv')
    const hasZodSchema = tsOutput.includes('envSchema')
    const hasValidationFunction = tsOutput.includes('validateEnv')

    validateTest(
      'genTs TypeScript 输出内容',
      hasInterface && hasZodSchema && hasValidationFunction,
      {
        hasInterface,
        hasZodSchema,
        hasValidationFunction,
        contentLength: tsOutput.length,
      }
    )

    // 验证验证器样式
    const expectedStyles = ['zod', 'pure', 'none']
    const availableStyles = Object.keys(snapshot.validatorStyles || {})
    const hasAllStyles = expectedStyles.every(style =>
      availableStyles.includes(style)
    )

    validateTest('genTs 验证器样式完整性', hasAllStyles, {
      expectedStyles,
      availableStyles,
    })
  } catch (error) {
    validateTest('genTs 快照验证', false, { error: error.message })
  }
}

// 4. 验证工作空间快照
function validateWorkspaceSnapshot() {
  console.log('\n🔍 验证工作空间快照')

  try {
    const snapshotPath = join(snapshotDir, 'workspace-plugin.snapshot.json')
    if (!existsSync(snapshotPath)) {
      validateTest('工作空间快照文件', false, { error: '文件不存在' })
      return
    }

    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'))

    // 验证快照结构
    const hasRequiredFields = !!(
      snapshot.name &&
      snapshot.expectedBehavior &&
      snapshot.testScenarios &&
      snapshot.variableInheritance
    )

    validateTest('工作空间快照结构', hasRequiredFields, {
      name: snapshot.name,
      hasBehavior: !!snapshot.expectedBehavior,
      scenarioCount: snapshot.testScenarios?.length || 0,
      hasInheritance: !!snapshot.variableInheritance,
    })

    // 验证测试场景
    const expectedScenarios = [
      'auto-discovery-workspace',
      'explicit-projects-workspace',
    ]
    const availableScenarios = snapshot.testScenarios?.map(s => s.name) || []
    const hasRequiredScenarios = expectedScenarios.every(scenario =>
      availableScenarios.includes(scenario)
    )

    validateTest('工作空间测试场景', hasRequiredScenarios, {
      expectedScenarios,
      availableScenarios,
    })
  } catch (error) {
    validateTest('工作空间快照验证', false, { error: error.message })
  }
}

// 5. 验证 API 使用快照
function validateApiUsageSnapshot() {
  console.log('\n🔍 验证 API 使用快照')

  try {
    const snapshotPath = join(snapshotDir, 'api-usage.snapshot.json')
    if (!existsSync(snapshotPath)) {
      validateTest('API 使用快照文件', false, { error: '文件不存在' })
      return
    }

    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'))

    // 验证快照结构
    const hasRequiredFields = !!(
      snapshot.examples &&
      snapshot.bestPractices &&
      snapshot.migrationGuide &&
      snapshot.commonPatterns
    )

    validateTest('API 使用快照结构', hasRequiredFields, {
      exampleCount: snapshot.examples?.length || 0,
      hasBestPractices: !!snapshot.bestPractices,
      hasMigrationGuide: !!snapshot.migrationGuide,
      patternCount: Object.keys(snapshot.commonPatterns || {}).length,
    })

    // 验证关键 API 示例
    const expectedExamples = [
      'defineConfig-basic',
      'createSafenv-core',
      'createSafenv-server',
      'createSafenv-workspace',
      'plugin-functions-direct',
    ]

    const availableExamples = snapshot.examples?.map(e => e.name) || []
    const hasRequiredExamples = expectedExamples.every(example =>
      availableExamples.includes(example)
    )

    validateTest('API 使用示例完整性', hasRequiredExamples, {
      expectedExamples,
      availableExamples,
    })
  } catch (error) {
    validateTest('API 使用快照验证', false, { error: error.message })
  }
}

// 6. 生成验证报告
function generateValidationReport() {
  console.log('\n📊 生成验证报告')

  const passedCount = results.filter(r => r.passed).length
  const totalCount = results.length
  const successRate = Math.round((passedCount / totalCount) * 100)

  const report = {
    title: '插件快照验证报告',
    timestamp: new Date().toISOString(),
    summary: {
      total: totalCount,
      passed: passedCount,
      failed: totalCount - passedCount,
      successRate: successRate,
    },
    results: results,
    recommendations:
      successRate === 100
        ? [
            '所有快照验证通过',
            '可以安全使用这些快照进行测试',
            '建议定期更新快照以反映 API 变化',
          ]
        : [
            '部分快照验证失败，需要检查和修复',
            '确保快照文件格式正确',
            '验证快照内容的完整性',
          ],
  }

  const reportPath = join(snapshotDir, 'validation-report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log('\n📋 验证结果摘要:')
  console.log('='.repeat(50))
  console.log(`总验证项: ${totalCount}`)
  console.log(`通过: ${passedCount}`)
  console.log(`失败: ${totalCount - passedCount}`)
  console.log(`成功率: ${successRate}%`)

  if (successRate === 100) {
    console.log('\n🎉 所有快照验证通过！')
  } else {
    console.log('\n⚠️  部分验证未通过，请检查详细信息')
  }

  console.log(`\n📄 详细报告已保存到: ${reportPath}`)

  return successRate === 100
}

// 主执行函数
async function main() {
  try {
    console.log('🚀 开始插件快照验证\n')

    // 执行所有验证
    validateSnapshotFiles()
    validateGenFileSnapshot()
    validateGenTsSnapshot()
    validateWorkspaceSnapshot()
    validateApiUsageSnapshot()

    // 生成报告
    const allPassed = generateValidationReport()

    console.log('\n' + '='.repeat(50))
    console.log(
      allPassed ? '🎯 验证完成！所有快照正确' : '❌ 验证失败，请检查错误'
    )

    return allPassed
  } catch (error) {
    console.error('❌ 验证过程失败:', error.message)
    return false
  }
}

// 运行验证
main()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('验证运行失败:', error)
    process.exit(1)
  })
