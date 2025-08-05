import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { BasePlugin } from '../plugins/base.ts'
import type { SafenvContext } from '../types.ts'

// Test implementation of BasePlugin
class TestPlugin extends BasePlugin {
  name = 'testPlugin'

  async apply(context: SafenvContext): Promise<void> {
    const content = `Test content for ${context.config.name}`
    this.writeFile(join(context.outputDir, 'test.txt'), content)
  }

  // Public methods for testing protected functionality
  public testWriteFile(filePath: string, content: string): void {
    this.writeFile(filePath, content)
  }

  public testEnsureDir(dir: string): void {
    this.ensureDir(dir)
  }
}

describe('BasePlugin', () => {
  let plugin: TestPlugin
  const testOutputDir = join(process.cwd(), 'test-output')

  beforeEach(() => {
    plugin = new TestPlugin()
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true })
    }
    mkdirSync(testOutputDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true })
    }
  })

  it('should create plugin instance', () => {
    expect(plugin).toBeInstanceOf(BasePlugin)
    expect(plugin.name).toBe('testPlugin')
  })

  it('should write files with directory creation', async () => {
    const context = {
      config: { name: 'test', variables: {} },
      resolvedVariables: {},
      outputDir: testOutputDir,
      mode: 'build' as const,
    }

    await plugin.apply(context)

    const filePath = join(testOutputDir, 'test.txt')
    expect(existsSync(filePath)).toBe(true)

    const content = readFileSync(filePath, 'utf8')
    expect(content).toBe('Test content for test')
  })

  it('should create nested directories when writing files', async () => {
    const nestedDir = join(testOutputDir, 'nested', 'deep')
    const filePath = join(nestedDir, 'test.txt')

    plugin.testWriteFile(filePath, 'nested content')

    expect(existsSync(filePath)).toBe(true)
    expect(existsSync(nestedDir)).toBe(true)

    const content = readFileSync(filePath, 'utf8')
    expect(content).toBe('nested content')
  })

  it('should handle existing directories gracefully', () => {
    // Create directory first
    const existingDir = join(testOutputDir, 'existing')
    mkdirSync(existingDir, { recursive: true })

    // Should not throw when directory already exists
    expect(() => plugin.testEnsureDir(existingDir)).not.toThrow()
  })
})
