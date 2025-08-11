#!/usr/bin/env node --experimental-strip-types

/**
 * SafEnv 集成 Standard Schema 使用示例
 * 展示如何使用 Zod、ArkType、Yup 等验证库
 */

import { SchemaAdapter, SchemaFactory } from '../src/schema-adapter.ts'
import type { SafenvConfig, SafenvVariable } from '../src/types.ts'

console.log('🚀 SafEnv + Standard Schema 集成使用示例\n')

// 模拟不同验证库的使用
const examples = {
  // 使用内置 Schema 工厂
  builtinValidation: {
    // 字符串验证
    API_URL: {
      type: 'string' as const,
      required: true,
      default: 'https://api.example.com',
      schema: SchemaFactory.string({
        format: 'url',
        minLength: 10,
      }),
      description: '使用内置工厂验证URL格式',
    },

    // 数字验证
    PORT: {
      type: 'number' as const,
      required: true,
      default: 3000,
      schema: SchemaFactory.number({
        min: 1000,
        max: 65535,
        integer: true,
      }),
      description: '使用内置工厂验证端口范围',
    },

    // 布尔验证
    DEBUG: {
      type: 'boolean' as const,
      default: false,
      schema: SchemaFactory.boolean(),
      description: '使用内置工厂验证布尔值',
    },
  },

  // 模拟 Zod 验证
  zodValidation: {
    // 模拟 Zod string schema
    EMAIL: {
      type: 'string' as const,
      required: true,
      schema: {
        _def: { typeName: 'ZodString' },
        parse: (value: any) => {
          if (typeof value !== 'string') throw new Error('Expected string')
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
            throw new Error('Invalid email')
          return value
        },
        safeParse: (value: any) => {
          try {
            const result = {
              _def: { typeName: 'ZodString' },
              parse: (value: any) => {
                if (typeof value !== 'string')
                  throw new Error('Expected string')
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
                  throw new Error('Invalid email')
                return value
              },
              safeParse: (value: any) => ({}),
            }.parse(value)
            return { success: true, data: result }
          } catch (error: any) {
            return {
              success: false,
              error: {
                issues: [{ message: error.message, path: [] }],
              },
            }
          }
        },
      },
      description: '使用 Zod 验证邮箱格式',
    },

    // 模拟 Zod number schema
    MAX_CONNECTIONS: {
      type: 'number' as const,
      default: 10,
      schema: {
        _def: { typeName: 'ZodNumber' },
        parse: (value: any) => {
          if (typeof value === 'string') value = Number(value)
          if (typeof value !== 'number' || isNaN(value))
            throw new Error('Expected number')
          if (value < 1 || value > 100)
            throw new Error('Must be between 1 and 100')
          return value
        },
        safeParse: (value: any) => {
          try {
            if (typeof value === 'string') value = Number(value)
            if (typeof value !== 'number' || isNaN(value))
              throw new Error('Expected number')
            if (value < 1 || value > 100)
              throw new Error('Must be between 1 and 100')
            return { success: true, data: value }
          } catch (error: any) {
            return {
              success: false,
              error: {
                issues: [{ message: error.message, path: [] }],
              },
            }
          }
        },
      },
      description: '使用 Zod 验证数字范围',
    },
  },

  // 模拟 Yup 异步验证
  yupValidation: {
    DATABASE_URL: {
      type: 'string' as const,
      required: true,
      schema: {
        __isYupSchema__: true,
        validate: async (value: any) => {
          if (typeof value !== 'string') {
            throw { message: 'Expected string', path: 'DATABASE_URL' }
          }

          // 模拟异步验证（例如检查数据库连接）
          await new Promise(resolve => setTimeout(resolve, 10))

          if (
            !value.startsWith('postgresql://') &&
            !value.startsWith('mysql://')
          ) {
            throw {
              message: 'Must be a valid database URL',
              path: 'DATABASE_URL',
            }
          }

          return value
        },
      },
      description: '使用 Yup 异步验证数据库URL',
    },
  },

  // 原生 Standard Schema
  standardValidation: {
    JWT_SECRET: {
      type: 'string' as const,
      required: true,
      sensitive: true,
      schema: {
        '~standard': {
          version: 1,
          vendor: 'custom',
          validate: (value: unknown) => {
            if (typeof value !== 'string') {
              return { issues: [{ message: 'Expected string' }] }
            }
            if (value.length < 32) {
              return {
                issues: [
                  { message: 'JWT secret must be at least 32 characters' },
                ],
              }
            }
            return { value }
          },
        },
      },
      description: '使用原生 Standard Schema 验证JWT密钥',
    },
  },
}

// 创建完整的配置示例
function createExampleConfig(): SafenvConfig {
  const variables: Record<string, SafenvVariable> = {}

  // 合并所有示例
  Object.assign(variables, examples.builtinValidation)
  Object.assign(variables, examples.zodValidation)
  Object.assign(variables, examples.yupValidation)
  Object.assign(variables, examples.standardValidation)

  return {
    name: 'schema-integration-example',
    description: 'Standard Schema 集成示例',
    variables,
    schema: {
      vendor: 'safenv',
      strict: true,
      coercion: true,
    },
  }
}

async function demonstrateValidation() {
  console.log('📋 配置示例变量:')

  const config = createExampleConfig()
  const testValues: Record<string, any> = {
    API_URL: 'https://api.example.com',
    PORT: '3000', // 字符串将被转换为数字
    DEBUG: 'true', // 字符串将被转换为布尔值
    EMAIL: 'user@example.com',
    MAX_CONNECTIONS: '25',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'this-is-a-very-long-secret-key-for-jwt-signing-32plus-chars',
  }

  console.log('\n🔧 验证处理过程:')

  for (const [name, variable] of Object.entries(config.variables)) {
    const testValue = testValues[name]
    console.log(`\n  📝 ${name}: ${JSON.stringify(testValue)}`)
    console.log(`     描述: ${variable.description}`)

    if (variable.schema) {
      try {
        // 检测和适配schema
        const vendor = SchemaAdapter.getVendor(variable.schema)
        console.log(`     验证库: ${vendor}`)

        const standardSchema = SchemaAdapter.adaptToStandardSchema(
          variable.schema
        )
        const result = await standardSchema['~standard'].validate(testValue)

        if ('issues' in result) {
          console.log(
            `     ❌ 验证失败: ${result.issues.map(i => i.message).join(', ')}`
          )
        } else {
          console.log(
            `     ✅ 验证成功: ${JSON.stringify(result.value)} (类型: ${typeof result.value})`
          )
        }
      } catch (error) {
        console.log(
          `     ❌ 验证出错: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    } else {
      console.log(`     📋 无schema验证`)
    }
  }
}

async function demonstrateErrorHandling() {
  console.log('\n\n🚨 错误处理示例:')

  const errorCases = [
    {
      name: 'INVALID_EMAIL',
      schema: examples.zodValidation.EMAIL.schema,
      value: 'not-an-email',
      expected: 'Zod email validation error',
    },
    {
      name: 'INVALID_PORT',
      schema: examples.builtinValidation.PORT.schema,
      value: '99999',
      expected: 'Port out of range error',
    },
    {
      name: 'INVALID_DB_URL',
      schema: examples.yupValidation.DATABASE_URL.schema,
      value: 'invalid://url',
      expected: 'Yup async validation error',
    },
    {
      name: 'SHORT_JWT_SECRET',
      schema: examples.standardValidation.JWT_SECRET.schema,
      value: 'too-short',
      expected: 'Standard Schema validation error',
    },
  ]

  for (const testCase of errorCases) {
    console.log(`\n  🧪 测试 ${testCase.name}:`)
    console.log(`     值: ${JSON.stringify(testCase.value)}`)
    console.log(`     期望: ${testCase.expected}`)

    try {
      const vendor = SchemaAdapter.getVendor(testCase.schema)
      const standardSchema = SchemaAdapter.adaptToStandardSchema(
        testCase.schema
      )
      const result = await standardSchema['~standard'].validate(testCase.value)

      if ('issues' in result) {
        console.log(
          `     ✅ 正确捕获错误: ${result.issues.map(i => i.message).join(', ')}`
        )
      } else {
        console.log(
          `     ❌ 预期错误但验证成功: ${JSON.stringify(result.value)}`
        )
      }
    } catch (error) {
      console.log(
        `     ✅ 正确抛出异常: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}

async function showUsageExamples() {
  console.log('\n\n💡 实际使用示例:\n')

  console.log('1️⃣ 使用 Zod (如果项目中已安装):')
  console.log(`
import { z } from 'zod'

const config = {
  variables: {
    API_URL: {
      type: 'string',
      required: true,
      schema: z.string().url(),
      description: '使用Zod验证URL'
    }
  }
}`)

  console.log('\n2️⃣ 使用内置 SchemaFactory:')
  console.log(`
import { SchemaFactory } from './src/schema-adapter.ts'

const config = {
  variables: {
    PORT: {
      type: 'number',
      schema: SchemaFactory.number({ min: 1000, max: 65535 }),
      description: '使用内置工厂验证端口'
    }
  }
}`)

  console.log('\n3️⃣ 使用原生 Standard Schema:')
  console.log(`
const config = {
  variables: {
    SECRET: {
      type: 'string',
      schema: {
        '~standard': {
          version: 1,
          vendor: 'custom',
          validate: (value) => {
            if (typeof value === 'string' && value.length >= 32) {
              return { value }
            }
            return { issues: [{ message: 'Invalid secret' }] }
          }
        }
      }
    }
  }
}`)

  console.log('\n4️⃣ 异步验证支持:')
  console.log(`
const config = {
  variables: {
    DB_URL: {
      type: 'string', 
      schema: yup.string().test('connection', 'Cannot connect', async (value) => {
        // 异步验证数据库连接
        return await testConnection(value)
      })
    }
  }
}`)
}

// 运行所有演示
if (import.meta.main) {
  await demonstrateValidation()
  await demonstrateErrorHandling()
  await showUsageExamples()

  console.log('\n🎯 总结:')
  console.log('✅ Standard Schema 系统已完全集成到 SafEnv')
  console.log('✅ 支持 Zod、ArkType、Yup、Valibot 等验证库')
  console.log('✅ 提供内置验证工厂用于简单场景')
  console.log('✅ 支持同步和异步验证')
  console.log('✅ 统一的错误处理和类型推断')
  console.log('✅ 向后兼容现有的 SafEnv 配置')

  console.log('\n🚀 用户现在可以自由选择任何支持 Standard Schema 的验证库！')
}
