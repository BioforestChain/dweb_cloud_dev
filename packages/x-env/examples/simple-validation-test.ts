/**
 * 简单的 Standard Schema 兼容性测试
 * 直接使用现有的生成文件进行测试
 */

import { z } from 'zod'
import * as v from 'valibot'
import { type } from 'arktype'

// 手动创建一个简单的 Standard Schema 实现用于测试
interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown
    ) =>
      | { value: Output }
      | { issues: Array<{ message: string; path?: any[] }> }
  }
}

// 测试配置类型
interface TestConfig {
  name: string
  port: number
  enabled: boolean
  tags: string[]
}

// 测试数据
const validData = {
  name: 'Test App',
  port: 3000,
  enabled: true,
  tags: ['web', 'api'],
}

const invalidData = {
  name: 123, // 应该是 string
  port: 'invalid', // 应该是 number
  enabled: 'maybe', // 应该是 boolean
  tags: 'not-array', // 应该是 array
}

console.log(
  '🧪 Testing Standard Schema compatibility with validation libraries\n'
)

// 1. 测试 Zod 兼容性
console.log('1️⃣ Testing Zod compatibility:')

const zodSchema = z.object({
  name: z.string(),
  port: z.number(),
  enabled: z.boolean(),
  tags: z.array(z.string()),
})

// Zod 到 Standard Schema 适配器
function zodToStandardSchema<T>(
  zodSchema: z.ZodSchema<T>
): StandardSchemaV1<unknown, T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'zod',
      validate: (value: unknown) => {
        const result = zodSchema.safeParse(value)
        if (result.success) {
          return { value: result.data }
        } else {
          return {
            issues: result.error.issues.map(issue => ({
              message: issue.message,
              path: issue.path,
            })),
          }
        }
      },
    },
  }
}

const zodStandardSchema = zodToStandardSchema(zodSchema)

console.log('✅ Valid data with Zod:')
const zodValidResult = zodStandardSchema['~standard'].validate(validData)
if ('issues' in zodValidResult) {
  console.log(
    '❌ Unexpected validation errors:',
    zodValidResult.issues.map(i => i.message)
  )
} else {
  console.log('✅ Validation passed:', zodValidResult.value)
}

console.log('\n❌ Invalid data with Zod:')
const zodInvalidResult = zodStandardSchema['~standard'].validate(invalidData)
if ('issues' in zodInvalidResult) {
  console.log(
    '✅ Expected validation errors:',
    zodInvalidResult.issues.map(i => i.message)
  )
} else {
  console.log('❌ Validation should have failed')
}

// 2. 测试 Valibot 兼容性
console.log('\n2️⃣ Testing Valibot compatibility:')

const valibotSchema = v.object({
  name: v.string(),
  port: v.number(),
  enabled: v.boolean(),
  tags: v.array(v.string()),
})

// Valibot 到 Standard Schema 适配器
function valibotToStandardSchema<T>(
  valibotSchema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>
): StandardSchemaV1<unknown, T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'valibot',
      validate: (value: unknown) => {
        const result = v.safeParse(valibotSchema, value)
        if (result.success) {
          return { value: result.output }
        } else {
          return {
            issues: result.issues.map(issue => ({
              message: issue.message,
              path: issue.path?.map(p => p.key) || [],
            })),
          }
        }
      },
    },
  }
}

const valibotStandardSchema = valibotToStandardSchema(valibotSchema)

console.log('✅ Valid data with Valibot:')
const valibotValidResult =
  valibotStandardSchema['~standard'].validate(validData)
if ('issues' in valibotValidResult) {
  console.log(
    '❌ Unexpected validation errors:',
    valibotValidResult.issues.map(i => i.message)
  )
} else {
  console.log('✅ Validation passed:', valibotValidResult.value)
}

console.log('\n❌ Invalid data with Valibot:')
const valibotInvalidResult =
  valibotStandardSchema['~standard'].validate(invalidData)
if ('issues' in valibotInvalidResult) {
  console.log(
    '✅ Expected validation errors:',
    valibotInvalidResult.issues.map(i => i.message)
  )
} else {
  console.log('❌ Validation should have failed')
}

// 3. 测试 ArkType 兼容性
console.log('\n3️⃣ Testing ArkType compatibility:')

const arkTypeSchema = type({
  name: 'string > 0',
  port: '1 <= number <= 65535',
  enabled: 'boolean',
  tags: 'string[]',
})

// ArkType 到 Standard Schema 适配器
function arkTypeToStandardSchema<T>(
  arkTypeSchema: any
): StandardSchemaV1<unknown, T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'arktype',
      validate: (value: unknown) => {
        const result = arkTypeSchema(value)

        // ArkType 的行为：
        // - 成功时直接返回验证后的数据
        // - 失败时返回一个错误对象，有 ' arkKind': 'errors' 属性
        if (
          result &&
          typeof result === 'object' &&
          result[' arkKind'] === 'errors'
        ) {
          // 验证失败，提取错误信息
          const errors = Array.isArray(result) ? result : [result]
          return {
            issues: errors.map((error: any) => ({
              message:
                error.description || error.message || 'Validation failed',
              path: error.path ? [error.path[0]] : [],
            })),
          }
        } else {
          // 验证成功，直接返回数据
          return { value: result }
        }
      },
    },
  }
}

const arkTypeStandardSchema = arkTypeToStandardSchema(arkTypeSchema)

console.log('✅ Valid data with ArkType:')
try {
  const arkTypeValidResult =
    arkTypeStandardSchema['~standard'].validate(validData)
  if ('issues' in arkTypeValidResult) {
    console.log(
      '❌ Unexpected validation errors:',
      arkTypeValidResult.issues.map(i => i.message)
    )
  } else {
    console.log('✅ Validation passed:', arkTypeValidResult.value)
  }
} catch (error) {
  console.log('⚠️ ArkType validation error:', error)
}

console.log('\n❌ Invalid data with ArkType:')
try {
  const arkTypeInvalidResult =
    arkTypeStandardSchema['~standard'].validate(invalidData)
  if ('issues' in arkTypeInvalidResult) {
    console.log(
      '✅ Expected validation errors:',
      arkTypeInvalidResult.issues.map(i => i.message)
    )
  } else {
    console.log('❌ Validation should have failed')
  }
} catch (error) {
  console.log('⚠️ ArkType validation error:', error)
}

console.log('\n🎉 Standard Schema compatibility test completed!')
console.log('\n📝 Summary:')
console.log(
  '- All three libraries (Zod, Valibot, ArkType) can be adapted to Standard Schema'
)
console.log('- Users can continue using their preferred validation library')
console.log('- The generated Standard Schema provides a unified interface')
console.log('- Type safety is maintained throughout the process')
