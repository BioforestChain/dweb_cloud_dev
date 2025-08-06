import { describe, it, expect, beforeEach } from 'vitest'
import { DependencyResolver } from '../dependency-resolver.ts'
import type { SafenvConfig } from '../types.ts'

describe('DependencyResolver', () => {
  let resolver: DependencyResolver

  beforeEach(() => {
    resolver = new DependencyResolver('/test/project')
  })

  describe('generatePrefix', () => {
    it('should generate correct prefixes for different package names', () => {
      const testCases = [
        { input: 'my-package', expected: 'MY_PACKAGE_' },
        { input: '@scope/package', expected: 'SCOPE_PACKAGE_' },
        { input: 'camelCase', expected: 'CAMEL_CASE_' },
        { input: 'simple', expected: 'SIMPLE_' },
        { input: '@org/my-awesome-lib', expected: 'ORG_MY_AWESOME_LIB_' },
      ]

      for (const { input, expected } of testCases) {
        // Access private method for testing
        const result = (resolver as any).generatePrefix(input)
        expect(result).toBe(expected)
      }
    })
  })

  describe('mergeDependencyVariables', () => {
    it('should merge dependency variables with prefixes', () => {
      const mainVariables = {
        MAIN_VAR: {
          type: 'string' as const,
          description: 'Main variable',
        },
      }

      const dependencyConfigs = [
        {
          packageName: 'test-package',
          configPath: '/path/to/config',
          prefix: 'TEST_PACKAGE_',
          config: {
            name: 'test-package',
            variables: {
              API_URL: {
                type: 'string' as const,
                description: 'API URL',
              },
              PORT: {
                type: 'number' as const,
                description: 'Port number',
                default: 3000,
              },
            },
          } as SafenvConfig,
        },
      ]

      const result = resolver.mergeDependencyVariables(
        mainVariables,
        dependencyConfigs
      )

      expect(result).toEqual({
        MAIN_VAR: {
          type: 'string',
          description: 'Main variable',
        },
        TEST_PACKAGE_API_URL: {
          type: 'string',
          description: '[From test-package] API URL',
        },
        TEST_PACKAGE_PORT: {
          type: 'number',
          description: '[From test-package] Port number',
          default: 3000,
        },
      })
    })
  })

  describe('parseVariableValue', () => {
    it('should parse values according to their types', () => {
      const testCases = [
        { value: '123', type: 'number' as const, expected: 123 },
        { value: 'true', type: 'boolean' as const, expected: true },
        { value: 'false', type: 'boolean' as const, expected: false },
        { value: '1', type: 'boolean' as const, expected: true },
        { value: 'a,b,c', type: 'array' as const, expected: ['a', 'b', 'c'] },
        {
          value: '{"key":"value"}',
          type: 'object' as const,
          expected: { key: 'value' },
        },
        { value: 'string', type: 'string' as const, expected: 'string' },
      ]

      for (const { value, type, expected } of testCases) {
        const result = (resolver as any).parseVariableValue(value, type)
        expect(result).toEqual(expected)
      }
    })

    it('should handle invalid JSON gracefully', () => {
      const result = (resolver as any).parseVariableValue(
        'invalid-json',
        'object'
      )
      expect(result).toBe('invalid-json')
    })
  })

  describe('discoverDependencies', () => {
    it('should be a function', () => {
      expect(typeof resolver.discoverDependencies).toBe('function')
    })
  })
})
