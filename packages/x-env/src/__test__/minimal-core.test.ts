import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SafenvCore } from '../core.ts'
import { genFilePlugin } from '../plugins/genFile.ts'
import { genTsPlugin } from '../plugins/genTs.ts'
import { createSafenv, defineConfig } from '../index.ts'
import type { SafenvConfig } from '../types.ts'

describe('Minimal Core Tests', () => {
  const testConfigDir = join(process.cwd(), 'test-output')

  beforeEach(() => {
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true })
    }
    mkdirSync(testConfigDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true })
    }
  })

  describe('Core API', () => {
    it('should create SafenvCore instance', () => {
      const safenv = new SafenvCore()
      expect(safenv).toBeInstanceOf(SafenvCore)
    })

    it('should resolve simple variables', async () => {
      const safenv = new SafenvCore()

      const config: SafenvConfig = {
        name: 'test',
        variables: {
          TEST_STRING: { type: 'string', default: 'hello' },
          TEST_NUMBER: { type: 'number', default: 42 },
          TEST_BOOLEAN: { type: 'boolean', default: true },
        },
      }

      const resolved = await safenv.resolveVariables(config)

      expect(resolved.TEST_STRING).toBe('hello')
      expect(resolved.TEST_NUMBER).toBe(42)
      expect(resolved.TEST_BOOLEAN).toBe(true)
    })

    it('should handle required variables validation', async () => {
      const safenv = new SafenvCore()

      const config: SafenvConfig = {
        name: 'test',
        variables: {
          REQUIRED_VAR: { type: 'string', required: true },
        },
      }

      await expect(safenv.resolveVariables(config)).rejects.toThrow()
    })
  })

  describe('New API', () => {
    it('should work with defineConfig', () => {
      const config = defineConfig({
        name: 'test-config',
        variables: {
          TEST_VAR: { type: 'string', default: 'test-value' },
          PORT: { type: 'number', default: 3000 },
        },
      })

      expect(config.name).toBe('test-config')
      expect(config.variables).toBeDefined()
      expect(Object.keys(config.variables || {})).toHaveLength(2)
    })

    it('should create core instance with createSafenv', () => {
      const config = defineConfig({
        name: 'test',
        variables: {
          TEST_VAR: { type: 'string', default: 'test' },
        },
      })

      const safenv = createSafenv(config)
      expect(safenv).toBeInstanceOf(SafenvCore)
    })

    it('should create server instance with server config', () => {
      const config = defineConfig({
        name: 'server-test',
        variables: {
          PORT: { type: 'number', default: 3000 },
        },
        server: {
          port: 3000,
          host: '0.0.0.0',
        },
      })

      const instance = createSafenv(config)
      expect(instance).toBeDefined()
      expect(instance.constructor.name).toBe('SafenvServer')
    })

    it('should create workspace instance with workspace config', () => {
      const config = defineConfig({
        name: 'workspace-test',
        variables: {
          SHARED_VAR: { type: 'string', default: 'shared' },
        },
        workspace: true,
      })

      const instance = createSafenv(config)
      expect(instance).toBeDefined()
      expect(instance.constructor.name).toBe('SafenvWorkspace')
    })
  })

  describe('Plugin Functions', () => {
    it('should create genFile plugin', () => {
      const plugin = genFilePlugin({
        name: 'test',
        formats: ['env', 'json'],
        outputDir: testConfigDir,
      })

      expect(plugin.name).toBe('genFilePlugin')
      expect(typeof plugin.afterGenerate).toBe('function')
    })

    it('should create genTs plugin', () => {
      const plugin = genTsPlugin({
        outputPath: join(testConfigDir, 'types.ts'),
        validatorStyle: 'zod',
      })

      expect(plugin.name).toBe('genTsPlugin')
      expect(typeof plugin.afterGenerate).toBe('function')
    })
  })

  describe('Integration', () => {
    it('should work with plugins in config', () => {
      const config = defineConfig({
        name: 'integration-test',
        variables: {
          TEST_VAR: { type: 'string', default: 'test' },
        },
        plugins: [
          genFilePlugin({
            name: 'test',
            formats: ['env'],
            outputDir: testConfigDir,
          }),
        ],
      })

      expect(config.name).toBe('integration-test')
      expect(config.variables).toBeDefined()
      expect(config.plugins).toHaveLength(1)

      const safenv = createSafenv(config)
      expect(safenv).toBeInstanceOf(SafenvCore)
    })
  })
})
