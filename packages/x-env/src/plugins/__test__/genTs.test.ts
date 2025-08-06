import { genTsPlugin } from '../genTs'
import type { SafenvContext, SafenvVariable } from '../../types'
import { resolve } from 'node:path'
import { readFileSync, existsSync, unlinkSync } from 'node:fs'

describe('GenTsPlugin - Standard Schema', () => {
  const testOutputPath = resolve(__dirname, 'test-output.ts')

  afterEach(() => {
    // Clean up test files
    if (existsSync(testOutputPath)) {
      unlinkSync(testOutputPath)
    }
  })

  const createMockContext = (
    variables: Record<string, SafenvVariable>
  ): SafenvContext => {
    // Create mock resolved variables based on the variable definitions
    const resolvedVariables: Record<string, any> = {}
    Object.entries(variables).forEach(([key, variable]) => {
      if (variable.default !== undefined) {
        resolvedVariables[key] = variable.default
      } else {
        // Provide mock values based on type
        switch (variable.type) {
          case 'string':
            resolvedVariables[key] = `mock-${key.toLowerCase()}`
            break
          case 'number':
            resolvedVariables[key] = 3000
            break
          case 'boolean':
            resolvedVariables[key] = true
            break
          case 'array':
            resolvedVariables[key] = ['item1', 'item2']
            break
          case 'object':
            resolvedVariables[key] = { key: 'value' }
            break
          default:
            resolvedVariables[key] = 'mock-value'
        }
      }
    })

    return {
      config: {
        name: 'test-config',
        variables,
        plugins: [],
      },
      resolvedVariables,
      outputDir: __dirname,
      mode: 'build',
    }
  }

  describe('Basic Schema Generation', () => {
    it('should generate a valid Standard Schema with basic types', async () => {
      const variables: Record<string, SafenvVariable> = {
        DB_HOST: {
          type: 'string',
          required: true,
          description: 'Database host',
        },
        DB_PORT: {
          type: 'number',
          required: true,
          default: 5432,
        },
        DEBUG: {
          type: 'boolean',
          required: false,
          default: false,
        },
        TAGS: {
          type: 'array',
          required: false,
          default: [],
        },
        CONFIG: {
          type: 'object',
          required: false,
        },
      }

      const plugin = genTsPlugin({
        outputPath: testOutputPath,
        validatorName: 'createTestSchema',
        validatorStyle: 'none',
        exportMode: 'process.env',
        exportName: 'testConfig',
      })

      const context = createMockContext(variables)
      // Create mock plugin context
      const pluginContext = {
        warn: (msg: string) => console.warn(msg),
        error: (msg: string) => {
          throw new Error(msg)
        },
        emitFile: () => {},
        getEmittedFiles: () => [],
        cache: new Map(),
        meta: {},
      }
      await plugin.afterGenerate!.call(pluginContext, context)

      expect(existsSync(testOutputPath)).toBe(true)
      const content = readFileSync(testOutputPath, 'utf8')

      // Check that the generated content includes Standard Schema interface
      expect(content).toContain('StandardSchemaV1')
      expect(content).toContain('createTestSchema')
      expect(content).toContain('TestConfigSchema')
      expect(content).toContain('TestConfigConfig')

      // Check validation logic
      expect(content).toContain('validate(value: unknown)')
      expect(content).toContain('const issues: StandardSchemaV1.Issue[] = []')
      expect(content).toContain('const result: Record<string, any> = {}')
    })
  })

  describe('Custom Validation Support', () => {
    it('should generate custom validation code when validate function is provided', async () => {
      const variables: Record<string, SafenvVariable> = {
        EMAIL: {
          type: 'string',
          required: true,
          validate: (
            value:
              | string
              | number
              | boolean
              | Record<string, unknown>
              | unknown[]
          ) => {
            if (typeof value !== 'string') return 'Must be a string'
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            return emailRegex.test(value)
              ? true
              : 'Must be a valid email address'
          },
        },
        PORT: {
          type: 'number',
          required: true,
          validate: (
            value:
              | string
              | number
              | boolean
              | Record<string, unknown>
              | unknown[]
          ) => {
            if (typeof value !== 'number') return 'Must be a number'
            return (
              (value > 0 && value < 65536) || 'Port must be between 1 and 65535'
            )
          },
        },
      }

      const plugin = genTsPlugin({
        outputPath: testOutputPath,
        validatorName: 'createValidatedSchema',
        validatorStyle: 'none',
      })

      const context = createMockContext(variables)
      // Create mock plugin context
      const pluginContext = {
        warn: (msg: string) => console.warn(msg),
        error: (msg: string) => {
          throw new Error(msg)
        },
        emitFile: () => {},
        getEmittedFiles: () => [],
        cache: new Map(),
        meta: {},
      }
      await plugin.afterGenerate!.call(pluginContext, context)

      const content = readFileSync(testOutputPath, 'utf8')

      // Check that custom validation is included
      expect(content).toContain('Custom validation')
      expect(content).toContain('validationResult')
      expect(content).toContain('Must be a valid email address')
      expect(content).toContain('Port must be between 1 and 65535')
    })
  })

  describe('Export Modes', () => {
    it('should generate process.env export mode correctly', async () => {
      const variables: Record<string, SafenvVariable> = {
        API_KEY: { type: 'string', required: true },
      }

      const plugin = genTsPlugin({
        outputPath: testOutputPath,
        validatorName: 'createApiSchema',
        validatorStyle: 'none',
        exportMode: 'process.env',
        exportName: 'apiConfig',
      })

      const context = createMockContext(variables)
      // Create mock plugin context
      const pluginContext = {
        warn: (msg: string) => console.warn(msg),
        error: (msg: string) => {
          throw new Error(msg)
        },
        emitFile: () => {},
        getEmittedFiles: () => [],
        cache: new Map(),
        meta: {},
      }
      await plugin.afterGenerate!.call(pluginContext, context)

      const content = readFileSync(testOutputPath, 'utf8')

      expect(content).toContain('export const apiConfig')
      expect(content).toContain('process.env')
      expect(content).toContain('createApiSchema()')
    })

    it('should generate static export mode correctly', async () => {
      const variables: Record<string, SafenvVariable> = {
        API_KEY: { type: 'string', required: true },
        DEBUG: { type: 'boolean', required: false },
      }

      const plugin = genTsPlugin({
        outputPath: testOutputPath,
        validatorName: 'createStaticSchema',
        validatorStyle: 'none',
        exportMode: 'process.env-static',
        exportName: 'MYAPP',
      })

      const context = createMockContext(variables)
      // Create mock plugin context
      const pluginContext = {
        warn: (msg: string) => console.warn(msg),
        error: (msg: string) => {
          throw new Error(msg)
        },
        emitFile: () => {},
        getEmittedFiles: () => [],
        cache: new Map(),
        meta: {},
      }
      await plugin.afterGenerate!.call(pluginContext, context)

      const content = readFileSync(testOutputPath, 'utf8')

      expect(content).toContain('export const MYAPP_API_KEY')
      expect(content).toContain('export const MYAPP_DEBUG')
      expect(content).toContain('@__PURE__')
    })

    it('should generate env-file export mode correctly', async () => {
      const variables: Record<string, SafenvVariable> = {
        DB_URL: { type: 'string', required: true },
      }

      const plugin = genTsPlugin({
        outputPath: testOutputPath,
        validatorName: 'createEnvSchema',
        validatorStyle: 'none',
        exportMode: 'env-file',
        exportName: 'envConfig',
      })

      const context = createMockContext(variables)
      // Create mock plugin context
      const pluginContext = {
        warn: (msg: string) => console.warn(msg),
        error: (msg: string) => {
          throw new Error(msg)
        },
        emitFile: () => {},
        getEmittedFiles: () => [],
        cache: new Map(),
        meta: {},
      }
      await plugin.afterGenerate!.call(pluginContext, context)

      const content = readFileSync(testOutputPath, 'utf8')

      expect(content).toContain('process.loadEnvFile')
      expect(content).toContain('test-config.safenv.env')
      expect(content).toContain('export const envConfig')
    })
  })

  describe('Type Safety', () => {
    it('should generate proper TypeScript interfaces', async () => {
      const variables: Record<string, SafenvVariable> = {
        stringField: { type: 'string', required: true },
        numberField: { type: 'number', required: true },
        booleanField: { type: 'boolean', required: false },
        arrayField: { type: 'array', required: false },
        objectField: { type: 'object', required: false },
      }

      const plugin = genTsPlugin({
        outputPath: testOutputPath,
        validatorName: 'createTypedSchema',
        validatorStyle: 'none',
      })

      const context = createMockContext(variables)
      // Create mock plugin context
      const pluginContext = {
        warn: (msg: string) => console.warn(msg),
        error: (msg: string) => {
          throw new Error(msg)
        },
        emitFile: () => {},
        getEmittedFiles: () => [],
        cache: new Map(),
        meta: {},
      }
      await plugin.afterGenerate!.call(pluginContext, context)

      const content = readFileSync(testOutputPath, 'utf8')

      // Check interface generation
      expect(content).toContain('interface TestConfigConfig')
      expect(content).toContain('stringField: string')
      expect(content).toContain('numberField: number')
      expect(content).toContain('booleanField?: boolean')
      expect(content).toContain('arrayField?: string[]')
      expect(content).toContain('objectField?: Record<string, any>')
    })
  })

  describe('Error Handling', () => {
    it('should generate proper error messages and paths', async () => {
      const variables: Record<string, SafenvVariable> = {
        testField: { type: 'string', required: true },
      }

      const plugin = genTsPlugin({
        outputPath: testOutputPath,
        validatorName: 'createErrorSchema',
        validatorStyle: 'none',
      })

      const context = createMockContext(variables)
      // Create mock plugin context
      const pluginContext = {
        warn: (msg: string) => console.warn(msg),
        error: (msg: string) => {
          throw new Error(msg)
        },
        emitFile: () => {},
        getEmittedFiles: () => [],
        cache: new Map(),
        meta: {},
      }
      await plugin.afterGenerate!.call(pluginContext, context)

      const content = readFileSync(testOutputPath, 'utf8')

      // Check error handling
      expect(content).toContain('issues.push')
      expect(content).toContain('path: [')
      expect(content).toContain('message:')
      expect(content).toContain('Required field')
      expect(content).toContain('must be a string')
    })
  })
})
