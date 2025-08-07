import { describe, it, expect, beforeEach } from 'vitest'
import {
  EnhancedVariableResolver,
  EnhancedSafenvVariable,
  VariableResolutionOptions,
  VariableDependency,
} from '../enhanced-variable-resolver'

describe('EnhancedVariableResolver', () => {
  let resolver: EnhancedVariableResolver

  beforeEach(() => {
    resolver = new EnhancedVariableResolver()
    // Clear environment variables
    delete process.env.TEST_VAR
    delete process.env.TEST_NUMBER
    delete process.env.TEST_BOOLEAN
    delete process.env.TEST_ARRAY
    delete process.env.TEST_OBJECT
  })

  describe('Basic Variable Resolution', () => {
    it('should resolve simple variables', async () => {
      process.env.TEST_VAR = 'test-value'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_VAR: {
          type: 'string',
          description: 'Test variable',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.variables.TEST_VAR).toBe('test-value')
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('should use default values when environment variable is not set', async () => {
      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_VAR: {
          type: 'string',
          default: 'default-value',
          description: 'Test variable',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.variables.TEST_VAR).toBe('default-value')
      expect(result.errors).toHaveLength(0)
    })

    it('should handle required variables', async () => {
      const variables: Record<string, EnhancedSafenvVariable> = {
        REQUIRED_VAR: {
          type: 'string',
          required: true,
          description: 'Required test variable',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].variable).toBe('REQUIRED_VAR')
      expect(result.errors[0].error).toContain('Required variable')
    })
  })

  describe('Type Conversion', () => {
    it('should convert string to number', async () => {
      process.env.TEST_NUMBER = '42'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_NUMBER: {
          type: 'number',
          description: 'Test number',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.variables.TEST_NUMBER).toBe(42)
      expect(typeof result.variables.TEST_NUMBER).toBe('number')
    })

    it('should convert string to boolean', async () => {
      process.env.TEST_BOOLEAN = 'true'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_BOOLEAN: {
          type: 'boolean',
          description: 'Test boolean',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.variables.TEST_BOOLEAN).toBe(true)
      expect(typeof result.variables.TEST_BOOLEAN).toBe('boolean')
    })

    it('should convert string to array', async () => {
      process.env.TEST_ARRAY = 'item1,item2,item3'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_ARRAY: {
          type: 'array',
          description: 'Test array',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.variables.TEST_ARRAY).toEqual(['item1', 'item2', 'item3'])
      expect(Array.isArray(result.variables.TEST_ARRAY)).toBe(true)
    })

    it('should convert string to object', async () => {
      process.env.TEST_OBJECT = '{"key":"value","number":123}'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_OBJECT: {
          type: 'object',
          description: 'Test object',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.variables.TEST_OBJECT).toEqual({
        key: 'value',
        number: 123,
      })
      expect(typeof result.variables.TEST_OBJECT).toBe('object')
    })
  })

  describe('Validation', () => {
    it('should validate variables with sync validators', async () => {
      process.env.TEST_VAR = 'invalid'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_VAR: {
          type: 'string',
          validate: value =>
            value === 'valid' ? true : 'Value must be "valid"',
          description: 'Test variable',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('Validation failed')
    })

    it('should validate variables with async validators', async () => {
      process.env.TEST_VAR = 'test'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_VAR: {
          type: 'string',
          asyncValidate: async value => {
            await new Promise(resolve => setTimeout(resolve, 10))
            return value.length > 5
              ? true
              : 'Value must be longer than 5 characters'
          },
          description: 'Test variable',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('Async validation failed')
      expect(result.performance.asyncValidationCount).toBe(1)
    })
  })

  describe('Variable Dependencies', () => {
    it('should resolve variables in dependency order', async () => {
      process.env.BASE_URL = 'https://api.example.com'
      process.env.API_VERSION = 'v1'

      const dependency: VariableDependency = {
        dependsOn: ['BASE_URL', 'API_VERSION'],
        validator: (current, deps) => {
          return deps.BASE_URL && deps.API_VERSION
            ? true
            : 'Missing dependencies'
        },
      }

      const variables: Record<string, EnhancedSafenvVariable> = {
        BASE_URL: {
          type: 'string',
          description: 'Base API URL',
        },
        API_VERSION: {
          type: 'string',
          description: 'API version',
        },
        FULL_API_URL: {
          type: 'string',
          dependencies: dependency,
          computed: vars => `${vars.BASE_URL}/${vars.API_VERSION}`,
          description: 'Full API URL',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.variables.FULL_API_URL).toBe('https://api.example.com/v1')
      expect(result.errors).toHaveLength(0)
    })

    it('should detect circular dependencies', async () => {
      const variables: Record<string, EnhancedSafenvVariable> = {
        VAR_A: {
          type: 'string',
          dependencies: {
            dependsOn: ['VAR_B'],
            validator: () => true,
          },
          description: 'Variable A',
        },
        VAR_B: {
          type: 'string',
          dependencies: {
            dependsOn: ['VAR_A'],
            validator: () => true,
          },
          description: 'Variable B',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('Circular dependency')
    })
  })

  describe('Computed Variables', () => {
    it('should resolve computed variables', async () => {
      process.env.FIRST_NAME = 'John'
      process.env.LAST_NAME = 'Doe'

      const variables: Record<string, EnhancedSafenvVariable> = {
        FIRST_NAME: {
          type: 'string',
          description: 'First name',
        },
        LAST_NAME: {
          type: 'string',
          description: 'Last name',
        },
        FULL_NAME: {
          type: 'string',
          computed: vars => `${vars.FIRST_NAME} ${vars.LAST_NAME}`,
          description: 'Full name',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.variables.FULL_NAME).toBe('John Doe')
    })

    it('should handle async computed variables', async () => {
      process.env.USER_ID = '123'

      const variables: Record<string, EnhancedSafenvVariable> = {
        USER_ID: {
          type: 'string',
          description: 'User ID',
        },
        USER_PROFILE: {
          type: 'object',
          computed: async vars => {
            await new Promise(resolve => setTimeout(resolve, 10))
            return { id: vars.USER_ID, name: 'Test User' }
          },
          description: 'User profile',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.variables.USER_PROFILE).toEqual({
        id: '123',
        name: 'Test User',
      })
    })
  })

  describe('Environment-specific Configuration', () => {
    it('should apply environment-specific overrides', async () => {
      process.env.API_URL = 'https://api.example.com'

      const variables: Record<string, EnhancedSafenvVariable> = {
        API_URL: {
          type: 'string',
          default: 'https://api.example.com',
          environments: {
            development: {
              default: 'https://dev-api.example.com',
            },
            production: {
              default: 'https://prod-api.example.com',
            },
          },
          description: 'API URL',
        },
      }

      const options: VariableResolutionOptions = {
        environment: 'development',
      }

      const result = await resolver.resolveVariables(variables, options)

      expect(result.variables.API_URL).toBe('https://api.example.com') // env var takes precedence
    })
  })

  describe('Variable Transformation', () => {
    it('should transform variable values', async () => {
      process.env.TEST_VAR = 'hello world'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_VAR: {
          type: 'string',
          transform: value => value.toUpperCase(),
          description: 'Test variable',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.variables.TEST_VAR).toBe('HELLO WORLD')
    })

    it('should handle async transformations', async () => {
      process.env.TEST_VAR = 'test'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_VAR: {
          type: 'string',
          transform: async value => {
            await new Promise(resolve => setTimeout(resolve, 10))
            return value.repeat(2)
          },
          description: 'Test variable',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.variables.TEST_VAR).toBe('testtest')
      expect(result.performance.transformTime).toBeGreaterThan(0)
    })
  })

  describe('Constraint Validation', () => {
    it('should validate string constraints', async () => {
      process.env.TEST_VAR = 'ab'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_VAR: {
          type: 'string',
          constraints: {
            minLength: 3,
            maxLength: 10,
            pattern: /^[a-z]+$/,
          },
          description: 'Test variable',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('at least 3 characters')
    })

    it('should validate number constraints', async () => {
      process.env.TEST_NUMBER = '150'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_NUMBER: {
          type: 'number',
          constraints: {
            min: 0,
            max: 100,
            integer: true,
          },
          description: 'Test number',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('at most 100')
    })
  })

  describe('Performance and Caching', () => {
    it('should cache resolved variables', async () => {
      process.env.TEST_VAR = 'cached-value'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_VAR: {
          type: 'string',
          description: 'Test variable',
        },
      }

      const options: VariableResolutionOptions = {
        cache: true,
      }

      // First resolution
      const result1 = await resolver.resolveVariables(variables, options)

      // Second resolution should use cache
      const result2 = await resolver.resolveVariables(variables, options)

      expect(result1.variables.TEST_VAR).toBe('cached-value')
      expect(result2.variables.TEST_VAR).toBe('cached-value')

      const cacheStats = resolver.getCacheStats()
      expect(cacheStats.size).toBeGreaterThan(0)
    })

    it('should provide performance metrics', async () => {
      process.env.TEST_VAR = 'test'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_VAR: {
          type: 'string',
          asyncValidate: async _value => {
            await new Promise(resolve => setTimeout(resolve, 10))
            return true
          },
          transform: async value => {
            await new Promise(resolve => setTimeout(resolve, 5))
            return value.toUpperCase()
          },
          description: 'Test variable',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.performance.totalTime).toBeGreaterThan(0)
      expect(result.performance.validationTime).toBeGreaterThan(0)
      expect(result.performance.transformTime).toBeGreaterThan(0)
      expect(result.performance.variableCount).toBe(1)
      expect(result.performance.asyncValidationCount).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle type conversion errors', async () => {
      process.env.TEST_NUMBER = 'not-a-number'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_NUMBER: {
          type: 'number',
          description: 'Test number',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('Cannot convert')
      expect(result.errors[0].recoverable).toBe(true)
    })

    it('should handle JSON parsing errors', async () => {
      process.env.TEST_OBJECT = 'invalid-json'

      const variables: Record<string, EnhancedSafenvVariable> = {
        TEST_OBJECT: {
          type: 'object',
          description: 'Test object',
        },
      }

      const result = await resolver.resolveVariables(variables)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('Cannot parse')
    })
  })

  describe('Variable Filtering', () => {
    it('should filter variables based on tags', async () => {
      process.env.PUBLIC_VAR = 'public'
      process.env.PRIVATE_VAR = 'private'

      const variables: Record<string, EnhancedSafenvVariable> = {
        PUBLIC_VAR: {
          type: 'string',
          tags: ['public'],
          description: 'Public variable',
        },
        PRIVATE_VAR: {
          type: 'string',
          tags: ['private'],
          sensitive: true,
          description: 'Private variable',
        },
      }

      const options: VariableResolutionOptions = {
        filter: (name, variable) => !variable.sensitive,
      }

      const result = await resolver.resolveVariables(variables, options)

      expect(result.variables.PUBLIC_VAR).toBe('public')
      expect(result.variables.PRIVATE_VAR).toBeUndefined()
    })
  })
})
