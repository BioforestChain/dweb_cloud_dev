#!/usr/bin/env node --experimental-strip-types

/**
 * 测试智能prefix策略系统的综合测试用例
 */

import { SmartPrefixManager } from '../src/smart-prefix-manager.ts'
import type { PrefixConfiguration, SafenvVariable } from '../src/types.ts'

interface TestCase {
  name: string
  config: PrefixConfiguration
  variables: Record<string, SafenvVariable>
  packageName: string
  existingVariables: string[]
  expected: {
    variableCount: number
    prefixedCount: number
    conflicts: number
    strategies: Record<string, string>
  }
}

const testCases: TestCase[] = [
  {
    name: 'Auto策略测试',
    config: {
      defaultStrategy: 'auto',
      conflictWarning: true,
    },
    variables: {
      PORT: { type: 'number', default: 3000 },
      DATABASE_URL: { type: 'string', required: true },
      API_KEY: { type: 'string', required: true },
    },
    packageName: 'my-package',
    existingVariables: [],
    expected: {
      variableCount: 3,
      prefixedCount: 3,
      conflicts: 0,
      strategies: {
        MY_PACKAGE_PORT: 'auto',
        MY_PACKAGE_DATABASE_URL: 'auto',
        MY_PACKAGE_API_KEY: 'auto',
      },
    },
  },

  {
    name: 'Global-aware策略测试',
    config: {
      defaultStrategy: 'global-aware',
      globalVariables: ['NODE_ENV', 'PORT', 'DEBUG'],
      conflictWarning: true,
    },
    variables: {
      NODE_ENV: { type: 'string', default: 'development' },
      PORT: { type: 'number', default: 3000 },
      APP_NAME: { type: 'string', default: 'my-app' },
      DEBUG: { type: 'boolean', default: false },
    },
    packageName: 'express-app',
    existingVariables: [],
    expected: {
      variableCount: 4,
      prefixedCount: 1, // 只有APP_NAME会被加prefix
      conflicts: 0,
      strategies: {
        NODE_ENV: 'global-aware',
        PORT: 'global-aware',
        DEBUG: 'global-aware',
        EXPRESS_APP_APP_NAME: 'auto',
      },
    },
  },

  {
    name: 'Custom prefix策略测试',
    config: {
      defaultStrategy: 'auto',
      customPrefixes: {
        'redis-client': 'REDIS_',
        mongodb: 'MONGO_',
      },
      conflictWarning: true,
    },
    variables: {
      URL: { type: 'string', required: true },
      PASSWORD: { type: 'string', required: true },
      TIMEOUT: { type: 'number', default: 5000 },
    },
    packageName: 'redis-client',
    existingVariables: [],
    expected: {
      variableCount: 3,
      prefixedCount: 3,
      conflicts: 0,
      strategies: {
        REDIS_URL: 'custom',
        REDIS_PASSWORD: 'custom',
        REDIS_TIMEOUT: 'custom',
      },
    },
  },

  {
    name: 'None策略测试',
    config: {
      defaultStrategy: 'none',
      conflictWarning: true,
    },
    variables: {
      APP_PORT: { type: 'number', default: 8080 },
      SERVICE_URL: { type: 'string', required: true },
    },
    packageName: 'service-client',
    existingVariables: [],
    expected: {
      variableCount: 2,
      prefixedCount: 0,
      conflicts: 0,
      strategies: {
        APP_PORT: 'none',
        SERVICE_URL: 'none',
      },
    },
  },

  {
    name: '冲突检测测试',
    config: {
      defaultStrategy: 'none', // 使用none策略产生冲突
      conflictWarning: true,
    },
    variables: {
      NODE_ENV: { type: 'string', default: 'production' },
      PORT: { type: 'number', default: 3000 },
      CONFIG_PATH: { type: 'string', default: './config' },
    },
    packageName: 'web-server',
    existingVariables: ['PORT', 'CONFIG_PATH'], // 模拟已存在的变量
    expected: {
      variableCount: 3,
      prefixedCount: 0, // none策略不加prefix
      conflicts: 2, // PORT 和 CONFIG_PATH 会冲突
      strategies: {
        NODE_ENV: 'none',
        PORT: 'none',
        CONFIG_PATH: 'none',
      },
    },
  },

  {
    name: '复合策略测试',
    config: {
      defaultStrategy: 'global-aware',
      globalVariables: ['NODE_ENV', 'PORT'],
      customPrefixes: {
        'database-client': 'DB_',
      },
      autoPrefixed: ['cache-service'],
      noPrefixRisky: ['legacy-service'],
      conflictWarning: true,
    },
    variables: {
      NODE_ENV: { type: 'string', default: 'test' },
      CONNECTION_URL: { type: 'string', required: true },
      MAX_CONNECTIONS: { type: 'number', default: 10 },
    },
    packageName: 'database-client',
    existingVariables: [],
    expected: {
      variableCount: 3,
      prefixedCount: 3, // 所有变量都使用custom prefix策略
      conflicts: 0,
      strategies: {
        DB_NODE_ENV: 'custom', // custom prefix优先于global-aware
        DB_CONNECTION_URL: 'custom',
        DB_MAX_CONNECTIONS: 'custom',
      },
    },
  },
]

async function runTest(testCase: TestCase): Promise<boolean> {
  console.log(`\n🧪 执行测试: ${testCase.name}`)
  console.log(`📦 测试包: ${testCase.packageName}`)
  console.log(`📋 变量数量: ${Object.keys(testCase.variables).length}`)
  console.log(`🔧 策略: ${testCase.config.defaultStrategy}`)

  try {
    const prefixManager = new SmartPrefixManager(testCase.config)
    const existingVariables = new Set(testCase.existingVariables)

    const result = prefixManager.applyPrefixStrategy(
      testCase.variables,
      testCase.packageName,
      existingVariables
    )

    // 打印处理结果（调试信息）
    console.log(`✅ 处理结果:`)
    result.results.forEach(r => {
      const prefix = r.prefix ? ` (prefix: ${r.prefix})` : ''
      console.log(
        `  ${r.originalName} → ${r.finalName} [${r.strategy}]${prefix}`
      )
    })

    if (result.conflicts.length > 0) {
      console.log(`⚠️  冲突详情:`)
      result.conflicts.forEach(c => {
        console.log(
          `  - ${c.variableName}: ${c.sources.join(' vs ')} (${c.severity})`
        )
        if (c.suggestion) {
          console.log(`    💡 ${c.suggestion}`)
        }
      })
    }

    // 验证变量数量
    const actualVariableCount = Object.keys(result.prefixedVariables).length
    if (actualVariableCount !== testCase.expected.variableCount) {
      console.error(
        `❌ 变量数量不匹配: 期望 ${testCase.expected.variableCount}, 实际 ${actualVariableCount}`
      )
      return false
    }

    // 验证有prefix的变量数量
    const actualPrefixedCount = result.results.filter(
      r => r.strategy !== 'none' && r.strategy !== 'global-aware'
    ).length
    if (actualPrefixedCount !== testCase.expected.prefixedCount) {
      console.error(
        `❌ Prefix变量数量不匹配: 期望 ${testCase.expected.prefixedCount}, 实际 ${actualPrefixedCount}`
      )
      console.error(
        `实际prefix结果:`,
        result.results.map(r => `${r.finalName} [${r.strategy}]`)
      )
      return false
    }

    // 验证冲突数量
    const actualConflicts = result.conflicts.length
    if (actualConflicts !== testCase.expected.conflicts) {
      console.error(
        `❌ 冲突数量不匹配: 期望 ${testCase.expected.conflicts}, 实际 ${actualConflicts}`
      )
      return false
    }

    // 验证策略应用
    for (const [expectedVar, expectedStrategy] of Object.entries(
      testCase.expected.strategies
    )) {
      const actualResult = result.results.find(r => r.finalName === expectedVar)
      if (!actualResult) {
        console.error(`❌ 未找到期望的变量: ${expectedVar}`)
        console.error(
          `实际结果:`,
          result.results.map(r => r.finalName)
        )
        return false
      }
      if (actualResult.strategy !== expectedStrategy) {
        console.error(
          `❌ 变量 ${expectedVar} 策略不匹配: 期望 ${expectedStrategy}, 实际 ${actualResult.strategy}`
        )
        return false
      }
    }

    console.log(`✅ 测试通过: ${testCase.name}`)
    return true
  } catch (error) {
    console.error(`❌ 测试失败: ${testCase.name}`)
    console.error(
      `错误信息: ${error instanceof Error ? error.message : String(error)}`
    )
    return false
  }
}

async function runAllTests() {
  console.log('🚀 开始执行智能prefix策略测试...\n')

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    const success = await runTest(testCase)
    if (success) {
      passed++
    } else {
      failed++
    }
  }

  console.log(`\n📊 测试总结:`)
  console.log(`✅ 通过: ${passed}`)
  console.log(`❌ 失败: ${failed}`)
  console.log(`📋 总计: ${testCases.length}`)

  if (failed === 0) {
    console.log(`\n🎉 所有测试都通过了！智能prefix策略系统工作正常。`)
  } else {
    console.log(`\n⚠️  有 ${failed} 个测试失败，需要检查实现。`)
    process.exit(1)
  }
}

// 额外的集成测试
async function integrationTest() {
  console.log(`\n🔗 执行集成测试...`)

  // 创建一个复杂的场景，模拟多个依赖项目的prefix处理
  const prefixManager = new SmartPrefixManager({
    defaultStrategy: 'global-aware',
    globalVariables: ['NODE_ENV', 'PORT', 'DEBUG'],
    customPrefixes: {
      express: 'WEB_',
      mongoose: 'DB_',
    },
    autoPrefixed: ['redis'],
    conflictWarning: true,
  })

  const scenarios = [
    {
      packageName: 'express',
      variables: {
        PORT: { type: 'number', default: 3000 },
        HOST: { type: 'string', default: 'localhost' },
        NODE_ENV: { type: 'string', default: 'development' },
      },
    },
    {
      packageName: 'mongoose',
      variables: {
        CONNECTION_URL: { type: 'string', required: true },
        MAX_POOL_SIZE: { type: 'number', default: 10 },
      },
    },
    {
      packageName: 'redis',
      variables: {
        URL: { type: 'string', required: true },
        PASSWORD: { type: 'string' },
      },
    },
  ]

  const allVariables = new Set<string>()
  let totalConflicts = 0

  console.log(`📦 处理 ${scenarios.length} 个依赖包...`)

  for (const scenario of scenarios) {
    const result = prefixManager.applyPrefixStrategy(
      scenario.variables,
      scenario.packageName,
      allVariables
    )

    console.log(`\n${scenario.packageName}:`)
    result.results.forEach(r => {
      console.log(`  ${r.originalName} → ${r.finalName} [${r.strategy}]`)
      allVariables.add(r.finalName)
    })

    totalConflicts += result.conflicts.length
    if (result.conflicts.length > 0) {
      result.conflicts.forEach(c => {
        console.log(`  ⚠️  ${c.variableName}: ${c.suggestion}`)
      })
    }
  }

  console.log(`\n✅ 集成测试完成`)
  console.log(`📊 最终变量数量: ${allVariables.size}`)
  console.log(`⚠️  总冲突数量: ${totalConflicts}`)
  console.log(`🏷️  最终变量列表:`)
  Array.from(allVariables)
    .sort()
    .forEach(v => {
      console.log(`  - ${v}`)
    })
}

// 运行所有测试
if (import.meta.main) {
  await runAllTests()
  await integrationTest()
}
