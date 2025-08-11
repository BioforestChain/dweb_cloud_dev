#!/usr/bin/env node --experimental-strip-types

/**
 * Standard Schema 系统测试
 * 测试各种验证库的集成支持
 */

import { SchemaAdapter, SchemaFactory } from '../src/schema-adapter.ts'
import type { StandardSchemaV1 } from '../src/types.ts'

console.log('🧪 开始 Standard Schema 系统测试...\n')

// 模拟不同验证库的 schema 对象
const mockSchemas = {
  // 模拟 Zod schema
  zodString: {
    _def: { typeName: 'ZodString' },
    parse: (value: any) => {
      if (typeof value !== 'string') throw new Error('Expected string')
      return value
    },
    safeParse: (value: any) => {
      if (typeof value === 'string') {
        return { success: true, data: value }
      }
      return {
        success: false,
        error: {
          issues: [{ message: 'Expected string', path: [] }],
        },
      }
    },
  },

  // 模拟 ArkType schema
  arkNumber: {
    infer: {},
    assert: (value: any) => {
      if (typeof value === 'number') return value
      throw { message: 'Expected number', path: [] }
    },
    // 修正：ArkType 实际上是作为函数调用的
    [Symbol.toPrimitive]: () => (value: any) => {
      if (typeof value === 'number') return value
      if (typeof value === 'string') {
        const num = Number(value)
        if (!isNaN(num)) return num
      }
      return new Error('Expected number')
    },
  },

  // 模拟 Yup schema
  yupEmail: {
    __isYupSchema__: true,
    validate: async (value: any) => {
      if (typeof value !== 'string') {
        throw { message: 'Expected string', path: 'email' }
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw { message: 'Invalid email format', path: 'email' }
      }
      return value
    },
  },

  // 已经是 Standard Schema 的对象
  standardBoolean: {
    '~standard': {
      version: 1,
      vendor: 'custom',
      validate: (value: unknown) => {
        if (typeof value === 'boolean') {
          return { value }
        }
        if (typeof value === 'string') {
          const lower = value.toLowerCase()
          if (['true', '1', 'yes'].includes(lower)) {
            return { value: true }
          }
          if (['false', '0', 'no'].includes(lower)) {
            return { value: false }
          }
        }
        return {
          issues: [{ message: 'Expected boolean or boolean-like string' }],
        }
      },
    },
  } as StandardSchemaV1,
}

interface TestCase {
  name: string
  schema: any
  testValues: Array<{
    value: any
    expected: 'success' | 'error'
    description: string
  }>
}

const testCases: TestCase[] = [
  {
    name: 'Zod String Schema',
    schema: mockSchemas.zodString,
    testValues: [
      { value: 'hello', expected: 'success', description: '有效字符串' },
      { value: 123, expected: 'error', description: '无效数字' },
      { value: '', expected: 'success', description: '空字符串' },
    ],
  },
  {
    name: 'ArkType Number Schema',
    schema: mockSchemas.arkNumber,
    testValues: [
      { value: 42, expected: 'success', description: '有效数字' },
      { value: '123', expected: 'success', description: '数字字符串' },
      { value: 'abc', expected: 'error', description: '无效字符串' },
    ],
  },
  {
    name: 'Yup Email Schema',
    schema: mockSchemas.yupEmail,
    testValues: [
      {
        value: 'test@example.com',
        expected: 'success',
        description: '有效邮箱',
      },
      { value: 'invalid-email', expected: 'error', description: '无效邮箱' },
      { value: 123, expected: 'error', description: '非字符串值' },
    ],
  },
  {
    name: 'Standard Schema Boolean',
    schema: mockSchemas.standardBoolean,
    testValues: [
      { value: true, expected: 'success', description: '布尔值 true' },
      { value: 'false', expected: 'success', description: '字符串 false' },
      { value: '1', expected: 'success', description: '字符串 1' },
      { value: 'maybe', expected: 'error', description: '无效字符串' },
    ],
  },
]

async function runTest(testCase: TestCase): Promise<boolean> {
  console.log(`\n🧪 测试: ${testCase.name}`)

  try {
    // 检测 schema 类型
    const vendor = SchemaAdapter.getVendor(testCase.schema)
    console.log(`📦 检测到的库: ${vendor}`)

    // 适配为 Standard Schema
    const standardSchema = SchemaAdapter.adaptToStandardSchema(
      testCase.schema,
      vendor
    )
    console.log(`✅ 成功适配为 Standard Schema`)

    let passed = 0
    let failed = 0

    // 运行测试用例
    for (const test of testCase.testValues) {
      try {
        const result = await standardSchema['~standard'].validate(test.value)
        const isSuccess = !('issues' in result)

        if (
          (isSuccess && test.expected === 'success') ||
          (!isSuccess && test.expected === 'error')
        ) {
          console.log(
            `  ✅ ${test.description}: ${JSON.stringify(test.value)} → ${isSuccess ? '有效' : '无效'}`
          )
          passed++
        } else {
          console.log(
            `  ❌ ${test.description}: 期望 ${test.expected}, 实际 ${isSuccess ? 'success' : 'error'}`
          )
          if ('issues' in result) {
            console.log(
              `     错误: ${result.issues.map(i => i.message).join(', ')}`
            )
          }
          failed++
        }
      } catch (error) {
        console.log(
          `  ❌ ${test.description}: 验证过程中出错 - ${error instanceof Error ? error.message : String(error)}`
        )
        failed++
      }
    }

    console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`)
    return failed === 0
  } catch (error) {
    console.error(
      `❌ 测试失败: ${error instanceof Error ? error.message : String(error)}`
    )
    return false
  }
}

async function testBuiltinSchemas() {
  console.log('\n🏭 测试内置 Schema 工厂...')

  const builtinTests = [
    {
      name: '字符串 Schema',
      schema: SchemaFactory.string({ minLength: 3, maxLength: 10 }),
      tests: [
        { value: 'hello', expected: 'success' },
        { value: 'hi', expected: 'error' }, // 太短
        { value: 'verylongstring', expected: 'error' }, // 太长
        { value: 123, expected: 'error' }, // 类型错误
      ],
    },
    {
      name: '数字 Schema',
      schema: SchemaFactory.number({ min: 0, max: 100, integer: true }),
      tests: [
        { value: 50, expected: 'success' },
        { value: '25', expected: 'success' }, // 字符串数字
        { value: -1, expected: 'error' }, // 小于最小值
        { value: 101, expected: 'error' }, // 大于最大值
        { value: 3.14, expected: 'error' }, // 非整数
      ],
    },
    {
      name: '布尔 Schema',
      schema: SchemaFactory.boolean(),
      tests: [
        { value: true, expected: 'success' },
        { value: false, expected: 'success' },
        { value: 'true', expected: 'success' },
        { value: '0', expected: 'success' },
        { value: 'maybe', expected: 'error' },
      ],
    },
  ]

  let allPassed = true

  for (const test of builtinTests) {
    console.log(`\n  🔧 ${test.name}:`)

    for (const testValue of test.tests) {
      try {
        const result = await test.schema['~standard'].validate(testValue.value)
        const isSuccess = !('issues' in result)
        const expectSuccess = testValue.expected === 'success'

        if (isSuccess === expectSuccess) {
          console.log(
            `    ✅ ${JSON.stringify(testValue.value)} → ${isSuccess ? '有效' : '无效'}`
          )
        } else {
          console.log(
            `    ❌ ${JSON.stringify(testValue.value)}: 期望 ${testValue.expected}, 实际 ${isSuccess ? 'success' : 'error'}`
          )
          if ('issues' in result) {
            console.log(
              `       错误: ${result.issues.map(i => i.message).join(', ')}`
            )
          }
          allPassed = false
        }
      } catch (error) {
        console.log(
          `    ❌ ${JSON.stringify(testValue.value)}: 验证出错 - ${error instanceof Error ? error.message : String(error)}`
        )
        allPassed = false
      }
    }
  }

  return allPassed
}

async function testSchemaDetection() {
  console.log('\n🔍 测试 Schema 类型检测...')

  const detectionTests = [
    { schema: mockSchemas.zodString, expected: 'zod', name: 'Zod Schema' },
    { schema: mockSchemas.yupEmail, expected: 'yup', name: 'Yup Schema' },
    {
      schema: mockSchemas.standardBoolean,
      expected: 'custom',
      name: 'Standard Schema',
    },
    { schema: { validate: () => true }, expected: 'unknown', name: '通用对象' },
  ]

  let allCorrect = true

  for (const test of detectionTests) {
    const detected = SchemaAdapter.getVendor(test.schema)
    if (detected === test.expected) {
      console.log(`  ✅ ${test.name}: 检测为 ${detected}`)
    } else {
      console.log(
        `  ❌ ${test.name}: 期望 ${test.expected}, 检测为 ${detected}`
      )
      allCorrect = false
    }
  }

  return allCorrect
}

// 运行所有测试
async function runAllTests() {
  let passed = 0
  let total = 0

  // 测试各种验证库适配
  for (const testCase of testCases) {
    total++
    if (await runTest(testCase)) {
      passed++
    }
  }

  // 测试内置 schemas
  total++
  if (await testBuiltinSchemas()) {
    passed++
    console.log('✅ 内置 Schema 工厂测试通过')
  } else {
    console.log('❌ 内置 Schema 工厂测试失败')
  }

  // 测试类型检测
  total++
  if (await testSchemaDetection()) {
    passed++
    console.log('✅ Schema 类型检测测试通过')
  } else {
    console.log('❌ Schema 类型检测测试失败')
  }

  console.log(`\n📊 总测试结果: ${passed}/${total} 通过`)

  if (passed === total) {
    console.log('\n🎉 Standard Schema 系统测试全部通过！')

    console.log('\n📋 支持的验证库:')
    console.log('  ✅ Zod - 完全支持')
    console.log('  ✅ ArkType - 基础支持')
    console.log('  ✅ Yup - 异步验证支持')
    console.log('  ✅ Valibot - 适配器就绪')
    console.log('  ✅ 标准 Schema - 原生支持')
    console.log('  ✅ 内置工厂 - 基础验证')

    console.log('\n💡 使用建议:')
    console.log('1. 优先使用支持 Standard Schema 接口的验证库')
    console.log('2. Zod 用户可以直接使用，会自动适配')
    console.log('3. 对于简单验证，可以使用内置的 SchemaFactory')
    console.log('4. 自定义验证库只需实现 Standard Schema 接口')

    return true
  } else {
    console.log('\n⚠️  部分测试失败，需要进一步调试')
    return false
  }
}

if (import.meta.main) {
  const success = await runAllTests()
  process.exit(success ? 0 : 1)
}
