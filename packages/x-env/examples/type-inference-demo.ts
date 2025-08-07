/**
 * X-Env Type Inference Demo
 *
 * 这个文件演示了如何使用 x-env 的类型推导功能来获得更好的 TypeScript 支持
 */

import {
  defineConfig,
  defineVariable,
  stringVar,
  numberVar,
  booleanVar,
} from '../src/config-builder'

// ❌ 问题：直接在对象字面量中定义时，validate 函数的 value 参数类型推导不正确
const problematicConfig = defineConfig({
  variables: {
    NODE_ENV: {
      type: 'string',
      default: 'development',
      description: 'Application environment',
      // 这里 value 参数会被推导为 any 类型
      validate: value =>
        value === 'development' || value === 'production' || value === 'test',
    },
  },
})

// ✅ 解决方案 1：使用 defineVariable 辅助函数
const betterConfig = defineConfig({
  variables: {
    NODE_ENV: defineVariable('string', {
      default: 'development',
      description: 'Application environment',
      // 现在 value 参数正确推导为 string 类型
      validate: value =>
        value === 'development' || value === 'production' || value === 'test',
    }),

    PORT: defineVariable('number', {
      default: 3000,
      description: 'Server port',
      // value 参数正确推导为 number 类型
      validate: value => value > 1000 && value < 65536,
    }),

    DEBUG: defineVariable('boolean', {
      default: false,
      description: 'Enable debug mode',
      // value 参数正确推导为 boolean 类型
      validate: value => typeof value === 'boolean',
    }),
  },
})

// ✅ 解决方案 2：使用类型特定的辅助函数
const bestConfig = defineConfig({
  variables: {
    NODE_ENV: stringVar({
      default: 'development',
      description: 'Application environment',
      // value 参数正确推导为 string 类型
      validate: value => {
        const validEnvs = ['development', 'production', 'test'] as const
        return (
          validEnvs.includes(value as any) ||
          `Must be one of: ${validEnvs.join(', ')}`
        )
      },
    }),

    PORT: numberVar({
      default: 3000,
      description: 'Server port',
      // value 参数正确推导为 number 类型
      validate: value => {
        if (value < 1000) return 'Port must be greater than 1000'
        if (value > 65535) return 'Port must be less than 65536'
        return true
      },
    }),

    DEBUG: booleanVar({
      default: false,
      description: 'Enable debug mode',
      // value 参数正确推导为 boolean 类型
      validate: value =>
        typeof value === 'boolean' || 'Must be a boolean value',
    }),

    API_URL: stringVar({
      required: true,
      description: 'API base URL',
      // 复杂的字符串验证，value 参数类型安全
      validate: value => {
        try {
          const url = new URL(value)
          return url.protocol === 'https:' || 'API URL must use HTTPS'
        } catch {
          return 'Must be a valid URL'
        }
      },
    }),

    MAX_CONNECTIONS: numberVar({
      default: 100,
      description: 'Maximum database connections',
      constraints: {
        min: 1,
        max: 1000,
        integer: true,
      },
      // 数值验证，value 参数类型安全
      validate: value => {
        if (!Number.isInteger(value)) return 'Must be an integer'
        if (value < 1) return 'Must be at least 1'
        if (value > 1000) return 'Must be at most 1000'
        return true
      },
    }),
  },
})

// 类型推导验证（用于演示类型推导结果）
type ConfigVariables = typeof bestConfig.variables
type _NodeEnvType = ConfigVariables['NODE_ENV'] // SafenvVariable<'string'>
type _PortType = ConfigVariables['PORT'] // SafenvVariable<'number'>
type _DebugType = ConfigVariables['DEBUG'] // SafenvVariable<'boolean'>

// 导出配置以供使用
export { problematicConfig, betterConfig, bestConfig }

// 使用示例
console.log('✅ Type inference demo configurations created successfully!')
console.log(
  '📝 Check the validate functions - they now have proper type inference!'
)

// 演示不同方法的类型安全性
export const typeInferenceExamples = {
  // 方法 1：直接对象字面量（类型推导有问题）
  direct: {
    NODE_ENV: {
      type: 'string' as const,
      validate: (value: string) =>
        value === 'development' || value === 'production' || value === 'test',
    },
  },

  // 方法 2：使用 defineVariable（推荐）
  withDefineVariable: {
    NODE_ENV: defineVariable('string', {
      validate: value =>
        value === 'development' || value === 'production' || value === 'test',
    }),
  },

  // 方法 3：使用类型特定函数（最推荐）
  withTypedHelpers: {
    NODE_ENV: stringVar({
      validate: value =>
        value === 'development' || value === 'production' || value === 'test',
    }),
  },
}

export default bestConfig
