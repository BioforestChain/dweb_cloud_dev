import type { StandardSchemaV1 } from '../types.ts'

/**
 * Standard Schema 适配器，用于支持各种验证库
 * 支持 Zod、ArkType、Valibot、Yup 等实现了 Standard Schema 接口的库
 */

/**
 * 验证库检测和适配工具
 */
export class SchemaAdapter {
  /**
   * 检测对象是否为 Standard Schema
   */
  static isStandardSchema(obj: any): obj is StandardSchemaV1 {
    return (
      obj &&
      typeof obj === 'object' &&
      '~standard' in obj &&
      obj['~standard'] &&
      typeof obj['~standard'] === 'object' &&
      obj['~standard'].version === 1 &&
      typeof obj['~standard'].validate === 'function'
    )
  }

  /**
   * 检测对象是否为 Zod schema
   */
  static isZodSchema(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      '_def' in obj &&
      'parse' in obj &&
      'safeParse' in obj &&
      typeof obj.parse === 'function' &&
      typeof obj.safeParse === 'function'
    )
  }

  /**
   * 检测对象是否为 ArkType schema
   */
  static isArkTypeSchema(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      'infer' in obj &&
      'assert' in obj &&
      typeof obj.assert === 'function'
    )
  }

  /**
   * 检测对象是否为 Valibot schema
   */
  static isValibotSchema(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      '_types' in obj &&
      'entries' in obj &&
      typeof obj.entries === 'object'
    )
  }

  /**
   * 检测对象是否为 Yup schema
   */
  static isYupSchema(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      '__isYupSchema__' in obj &&
      obj.__isYupSchema__ === true &&
      'validate' in obj &&
      typeof obj.validate === 'function'
    )
  }

  /**
   * 将各种 schema 适配为 Standard Schema 接口
   */
  static adaptToStandardSchema(schema: any, vendor?: string): StandardSchemaV1 {
    // 如果已经是 Standard Schema，直接返回
    if (this.isStandardSchema(schema)) {
      return schema
    }

    // Zod 适配
    if (this.isZodSchema(schema)) {
      return this.adaptZodSchema(schema)
    }

    // ArkType 适配
    if (this.isArkTypeSchema(schema)) {
      return this.adaptArkTypeSchema(schema)
    }

    // Valibot 适配
    if (this.isValibotSchema(schema)) {
      return this.adaptValibotSchema(schema)
    }

    // Yup 适配
    if (this.isYupSchema(schema)) {
      return this.adaptYupSchema(schema)
    }

    // 如果提供了vendor，尝试通用适配
    if (vendor) {
      return this.adaptGenericSchema(schema, vendor)
    }

    throw new Error(
      'Unsupported schema type. Please use a Standard Schema compatible library.'
    )
  }

  /**
   * Zod schema 适配器
   */
  private static adaptZodSchema(zodSchema: any): StandardSchemaV1 {
    return {
      '~standard': {
        version: 1,
        vendor: 'zod',
        validate: (value: unknown) => {
          try {
            const result = zodSchema.safeParse(value)
            if (result.success) {
              return { value: result.data }
            } else {
              return {
                issues: result.error.issues.map((issue: any) => ({
                  message: issue.message,
                  path: issue.path,
                })),
              }
            }
          } catch (error) {
            return {
              issues: [
                {
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Validation failed',
                },
              ],
            }
          }
        },
        types: {
          input: undefined as any,
          output: undefined as any,
        },
      },
    }
  }

  /**
   * ArkType schema 适配器
   */
  private static adaptArkTypeSchema(arkSchema: any): StandardSchemaV1 {
    return {
      '~standard': {
        version: 1,
        vendor: 'arktype',
        validate: (value: unknown) => {
          try {
            // ArkType 通常作为函数调用
            let result
            if (typeof arkSchema === 'function') {
              result = arkSchema(value)
            } else if (arkSchema[Symbol.toPrimitive]) {
              // 处理 ArkType schema 的调用方式
              const validator = arkSchema[Symbol.toPrimitive]()
              result = validator(value)
            } else if (arkSchema.assert) {
              result = arkSchema.assert(value)
            } else {
              throw new Error('No validation method found on ArkType schema')
            }

            // ArkType 返回错误对象表示验证失败
            if (result instanceof Error) {
              return {
                issues: [
                  {
                    message: result.message || 'Validation failed',
                  },
                ],
              }
            }

            // 检查是否有 problems 属性
            if (result && result.problems && Array.isArray(result.problems)) {
              return {
                issues: result.problems.map((problem: any) => ({
                  message: problem.message || 'Validation failed',
                  path: problem.path,
                })),
              }
            }

            return { value: result }
          } catch (error) {
            return {
              issues: [
                {
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Validation failed',
                },
              ],
            }
          }
        },
        types: {
          input: undefined as any,
          output: undefined as any,
        },
      },
    }
  }

  /**
   * Valibot schema 适配器
   */
  private static adaptValibotSchema(valibotSchema: any): StandardSchemaV1 {
    return {
      '~standard': {
        version: 1,
        vendor: 'valibot',
        validate: async (value: unknown) => {
          try {
            // 假设 valibot 有类似的验证方法
            const result =
              (await valibotSchema.parse?.(value)) || valibotSchema(value)
            return { value: result }
          } catch (error: any) {
            return {
              issues: [
                {
                  message: error.message || 'Validation failed',
                  path: error.path,
                },
              ],
            }
          }
        },
        types: {
          input: undefined as any,
          output: undefined as any,
        },
      },
    }
  }

  /**
   * Yup schema 适配器
   */
  private static adaptYupSchema(yupSchema: any): StandardSchemaV1 {
    return {
      '~standard': {
        version: 1,
        vendor: 'yup',
        validate: async (value: unknown) => {
          try {
            const result = await yupSchema.validate(value)
            return { value: result }
          } catch (error: any) {
            return {
              issues: [
                {
                  message: error.message || 'Validation failed',
                  path: error.path ? [error.path] : undefined,
                },
              ],
            }
          }
        },
        types: {
          input: undefined as any,
          output: undefined as any,
        },
      },
    }
  }

  /**
   * 通用 schema 适配器
   */
  private static adaptGenericSchema(
    schema: any,
    vendor: string
  ): StandardSchemaV1 {
    return {
      '~standard': {
        version: 1,
        vendor,
        validate: (value: unknown) => {
          try {
            // 尝试各种常见的验证方法
            let result
            if (typeof schema.validate === 'function') {
              result = schema.validate(value)
            } else if (typeof schema.parse === 'function') {
              result = schema.parse(value)
            } else if (typeof schema === 'function') {
              result = schema(value)
            } else {
              throw new Error('No validation method found')
            }

            // 处理 Promise 结果
            if (result && typeof result.then === 'function') {
              return result.then(
                (data: any) => ({ value: data }),
                (error: any) => ({
                  issues: [
                    {
                      message: error.message || 'Validation failed',
                    },
                  ],
                })
              )
            }

            return { value: result }
          } catch (error) {
            return {
              issues: [
                {
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Validation failed',
                },
              ],
            }
          }
        },
        types: {
          input: undefined as any,
          output: undefined as any,
        },
      },
    }
  }

  /**
   * 从 schema 中推断类型信息
   */
  static inferTypes(schema: any): { input: any; output: any } | undefined {
    if (this.isStandardSchema(schema)) {
      return schema['~standard'].types
    }

    // 对于非标准 schema，返回 undefined
    // 具体的类型推断需要在编译时通过 TypeScript 处理
    return undefined
  }

  /**
   * 获取 schema 的 vendor 信息
   */
  static getVendor(schema: any): string {
    if (this.isStandardSchema(schema)) {
      return schema['~standard'].vendor
    }

    if (this.isZodSchema(schema)) return 'zod'
    if (this.isArkTypeSchema(schema)) return 'arktype'
    if (this.isValibotSchema(schema)) return 'valibot'
    if (this.isYupSchema(schema)) return 'yup'

    return 'unknown'
  }
}

/**
 * 常用 schema 工厂函数
 * 用于在不依赖具体验证库的情况下创建基础验证
 */
export class SchemaFactory {
  /**
   * 创建字符串验证 schema
   */
  static string(options?: {
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    format?: 'email' | 'url' | 'uuid'
  }): StandardSchemaV1<string, string> {
    return {
      '~standard': {
        version: 1,
        vendor: 'safenv-builtin',
        validate: (value: unknown) => {
          if (typeof value !== 'string') {
            return {
              issues: [
                {
                  message: 'Expected string',
                },
              ],
            }
          }

          const str = value as string

          if (options?.minLength && str.length < options.minLength) {
            return {
              issues: [
                {
                  message: `String must be at least ${options.minLength} characters`,
                },
              ],
            }
          }

          if (options?.maxLength && str.length > options.maxLength) {
            return {
              issues: [
                {
                  message: `String must be at most ${options.maxLength} characters`,
                },
              ],
            }
          }

          if (options?.pattern && !options.pattern.test(str)) {
            return {
              issues: [
                {
                  message: 'String does not match required pattern',
                },
              ],
            }
          }

          if (options?.format) {
            const formatValid = this.validateFormat(str, options.format)
            if (!formatValid) {
              return {
                issues: [
                  {
                    message: `Invalid ${options.format} format`,
                  },
                ],
              }
            }
          }

          return { value: str }
        },
        types: {
          input: undefined as any,
          output: undefined as any,
        },
      },
    }
  }

  /**
   * 创建数字验证 schema
   */
  static number(options?: {
    min?: number
    max?: number
    integer?: boolean
    positive?: boolean
  }): StandardSchemaV1<number, number> {
    return {
      '~standard': {
        version: 1,
        vendor: 'safenv-builtin',
        validate: (value: unknown) => {
          let num: number

          if (typeof value === 'string') {
            num = Number(value)
            if (isNaN(num)) {
              return {
                issues: [
                  {
                    message: 'Cannot convert to number',
                  },
                ],
              }
            }
          } else if (typeof value === 'number') {
            num = value
          } else {
            return {
              issues: [
                {
                  message: 'Expected number or numeric string',
                },
              ],
            }
          }

          if (options?.min !== undefined && num < options.min) {
            return {
              issues: [
                {
                  message: `Number must be at least ${options.min}`,
                },
              ],
            }
          }

          if (options?.max !== undefined && num > options.max) {
            return {
              issues: [
                {
                  message: `Number must be at most ${options.max}`,
                },
              ],
            }
          }

          if (options?.integer && !Number.isInteger(num)) {
            return {
              issues: [
                {
                  message: 'Number must be an integer',
                },
              ],
            }
          }

          if (options?.positive && num <= 0) {
            return {
              issues: [
                {
                  message: 'Number must be positive',
                },
              ],
            }
          }

          return { value: num }
        },
        types: {
          input: undefined as any,
          output: undefined as any,
        },
      },
    }
  }

  /**
   * 创建布尔值验证 schema
   */
  static boolean(): StandardSchemaV1<boolean, boolean> {
    return {
      '~standard': {
        version: 1,
        vendor: 'safenv-builtin',
        validate: (value: unknown) => {
          if (typeof value === 'boolean') {
            return { value }
          }

          if (typeof value === 'string') {
            const lower = value.toLowerCase()
            if (lower === 'true' || lower === '1' || lower === 'yes') {
              return { value: true }
            }
            if (lower === 'false' || lower === '0' || lower === 'no') {
              return { value: false }
            }
          }

          return {
            issues: [
              {
                message: 'Expected boolean or boolean-like string',
              },
            ],
          }
        },
        types: {
          input: undefined as any,
          output: undefined as any,
        },
      },
    }
  }

  /**
   * 验证格式
   */
  private static validateFormat(
    str: string,
    format: 'email' | 'url' | 'uuid'
  ): boolean {
    switch (format) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)
      case 'url':
        try {
          new URL(str)
          return true
        } catch {
          return false
        }
      case 'uuid':
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          str
        )
      default:
        return true
    }
  }
}
