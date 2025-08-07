import { describe, it, expect, beforeEach } from 'vitest'
import { PluginManager, definePlugin, SafenvError } from '../plugin-system'
import type { SafenvContext } from '../../types'

describe('Plugin Lifecycle Hooks', () => {
  let pluginManager: PluginManager
  let mockContext: SafenvContext

  beforeEach(() => {
    pluginManager = new PluginManager()
    mockContext = {
      config: {
        name: 'test-config',
        variables: {
          TEST_VAR: { type: 'string', default: 'test-value' },
        },
      },
      resolvedVariables: {
        TEST_VAR: 'test-value',
      },
      mode: 'build',
      outputDir: './dist',
    }
  })

  describe('beforeLoad hook', () => {
    it('should execute beforeLoad hook with config path', async () => {
      const configPath = './safenv.config.ts'
      let receivedPath = ''

      const plugin = definePlugin({
        name: 'test-beforeLoad',
        beforeLoad(path: string) {
          receivedPath = path
          this.debug('beforeLoad executed', { path })
        },
      })

      pluginManager.register(plugin)
      await pluginManager.executePhase('beforeLoad', mockContext, configPath)

      expect(receivedPath).toBe(configPath)
    })
  })

  describe('afterLoad hook', () => {
    it('should execute afterLoad hook and allow config modification', async () => {
      const plugin = definePlugin({
        name: 'test-afterLoad',
        afterLoad(config) {
          return {
            ...config,
            description: 'Modified by afterLoad hook',
          }
        },
      })

      pluginManager.register(plugin)
      const result = await pluginManager.executePhase(
        'afterLoad',
        mockContext,
        mockContext.config
      )

      expect(result.description).toBe('Modified by afterLoad hook')
    })
  })

  describe('onError hook', () => {
    it('should execute onError hooks when plugin throws error', async () => {
      const errorMessages: string[] = []

      const errorHandlerPlugin = definePlugin({
        name: 'error-handler',
        onError(error: SafenvError, phase) {
          errorMessages.push(`Handled error in ${phase}: ${error.message}`)
          this.debug('Error handled', { error: error.message, phase })
        },
      })

      const faultyPlugin = definePlugin({
        name: 'faulty-plugin',
        beforeResolve() {
          throw new Error('Test error')
        },
      })

      pluginManager.register(errorHandlerPlugin)
      pluginManager.register(faultyPlugin)

      try {
        await pluginManager.executePhase('beforeResolve', mockContext)
      } catch (error) {
        // Expected to throw
      }

      expect(errorMessages).toHaveLength(1)
      expect(errorMessages[0]).toContain(
        'Handled error in beforeResolve: Test error'
      )
    })
  })

  describe('onWarning hook', () => {
    it('should execute onWarning hooks when plugin emits warning', async () => {
      const warnings: string[] = []

      const warningHandlerPlugin = definePlugin({
        name: 'warning-handler',
        onWarning(warning: string, phase) {
          warnings.push(`Handled warning in ${phase}: ${warning}`)
        },
      })

      const warningPlugin = definePlugin({
        name: 'warning-plugin',
        beforeResolve() {
          this.warn('This is a test warning')
        },
      })

      pluginManager.register(warningHandlerPlugin)
      pluginManager.register(warningPlugin)

      await pluginManager.executePhase('beforeResolve', mockContext)

      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('This is a test warning')
    })
  })

  describe('Enhanced error handling', () => {
    it('should create SafenvError with proper metadata', async () => {
      const plugin = definePlugin({
        name: 'error-test',
        beforeResolve() {
          this.error('Test error with metadata')
        },
      })

      pluginManager.register(plugin)

      try {
        await pluginManager.executePhase('beforeResolve', mockContext)
        expect.fail('Should have thrown error')
      } catch (error) {
        const safenvError = error as SafenvError
        expect(safenvError.phase).toBe('beforeResolve')
        expect(safenvError.plugin).toBe('error-test')
        expect(safenvError.suggestions).toBeDefined()
        expect(safenvError.code).toBeDefined()
        expect(safenvError.recoverable).toBeDefined()
      }
    })
  })

  describe('Debug and tracing', () => {
    it('should support debug messages and tracing', async () => {
      // Set debug mode
      process.env.SAFENV_DEBUG = 'true'

      const plugin = definePlugin({
        name: 'debug-test',
        beforeResolve() {
          this.debug('Debug message', { key: 'value' })
          this.trace('Trace point')

          const checkpointId = this.createCheckpoint()
          expect(checkpointId).toBeDefined()

          const stack = this.getStackTrace()
          expect(stack).toBeDefined()

          expect(this.getCurrentPlugin()).toBe('debug-test')
          expect(this.getCurrentPhase()).toBe('beforeResolve')
        },
      })

      pluginManager.register(plugin)
      await pluginManager.executePhase('beforeResolve', mockContext)

      // Clean up
      delete process.env.SAFENV_DEBUG
    })
  })

  describe('Plugin execution results', () => {
    it('should collect enhanced execution results', async () => {
      const plugin = definePlugin({
        name: 'result-test',
        beforeResolve() {
          this.debug('Test debug message')
          this.createCheckpoint()
          this.warn('Test warning')
        },
      })

      pluginManager.register(plugin)
      await pluginManager.executePhase('beforeResolve', mockContext)

      const results = pluginManager.getResults()
      expect(results).toHaveLength(1)

      const result = results[0]
      expect(result.plugin.name).toBe('result-test')
      expect(result.phase).toBe('beforeResolve')
      expect(result.success).toBe(true)
      expect(result.debugInfo).toBeDefined()
      expect(result.checkpoints).toBeDefined()
      expect(result.warnings).toHaveLength(1)
    })
  })

  describe('Plugin mode filtering', () => {
    it('should respect plugin mode restrictions', async () => {
      let executed = false

      const buildOnlyPlugin = definePlugin({
        name: 'build-only',
        mode: 'build',
        beforeResolve() {
          executed = true
        },
      })

      pluginManager.register(buildOnlyPlugin)

      // Should execute in build mode
      await pluginManager.executePhase('beforeResolve', mockContext)
      expect(executed).toBe(true)

      // Should not execute in serve mode
      executed = false
      const serveContext = { ...mockContext, mode: 'serve' as const }
      await pluginManager.executePhase('beforeResolve', serveContext)
      expect(executed).toBe(false)
    })
  })
})
