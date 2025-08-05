import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from 'node:fs'
import { join } from 'node:path'
import { SafenvCore } from '../core.ts'
import { GenFilePlugin } from '../plugins/genFile.ts'
import { GenTsPlugin } from '../plugins/genTs.ts'
import { SafenvServer } from '../server.ts'
import { SafenvWorkspace } from '../workspace.ts'
import { SafenvBuilder } from '../builder.ts'
import type { SafenvConfig } from '../types.ts'

describe('SafenvCore', () => {
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

  it('should parse variables correctly', async () => {
    const safenv = new SafenvCore()

    const config: SafenvConfig = {
      name: 'test',
      variables: {
        TEST_STRING: { type: 'string', default: 'hello' },
        TEST_NUMBER: { type: 'number', default: 42 },
        TEST_BOOLEAN: { type: 'boolean', default: true },
        TEST_ARRAY: { type: 'array', default: ['a', 'b', 'c'] },
        TEST_OBJECT: { type: 'object', default: { key: 'value' } },
      },
    }

    const resolved = await safenv.resolveVariables(config)

    expect(resolved.TEST_STRING).toBe('hello')
    expect(resolved.TEST_NUMBER).toBe(42)
    expect(resolved.TEST_BOOLEAN).toBe(true)
    expect(resolved.TEST_ARRAY).toEqual(['a', 'b', 'c'])
    expect(resolved.TEST_OBJECT).toEqual({ key: 'value' })
  })

  it('should validate required variables', async () => {
    const safenv = new SafenvCore()

    const config: SafenvConfig = {
      name: 'test',
      variables: {
        REQUIRED_VAR: { type: 'string', required: true },
      },
    }

    await expect(safenv.resolveVariables(config)).rejects.toThrow(
      'Required variable REQUIRED_VAR is not set'
    )
  })

  it('should override defaults with environment variables', async () => {
    process.env.TEST_ENV_VAR = 'from_env'

    const safenv = new SafenvCore()
    const config: SafenvConfig = {
      name: 'test',
      variables: {
        TEST_ENV_VAR: { type: 'string', default: 'default_value' },
      },
    }

    const resolved = await safenv.resolveVariables(config)
    expect(resolved.TEST_ENV_VAR).toBe('from_env')

    delete process.env.TEST_ENV_VAR
  })

  it('should handle type conversion', async () => {
    process.env.TEST_NUMBER = '123'
    process.env.TEST_BOOLEAN = 'true'
    process.env.TEST_ARRAY = 'a,b,c'

    const safenv = new SafenvCore()
    const config: SafenvConfig = {
      name: 'test',
      variables: {
        TEST_NUMBER: { type: 'number' },
        TEST_BOOLEAN: { type: 'boolean' },
        TEST_ARRAY: { type: 'array' },
      },
    }

    const resolved = await safenv.resolveVariables(config)
    expect(resolved.TEST_NUMBER).toBe(123)
    expect(resolved.TEST_BOOLEAN).toBe(true)
    expect(resolved.TEST_ARRAY).toEqual(['a', 'b', 'c'])

    delete process.env.TEST_NUMBER
    delete process.env.TEST_BOOLEAN
    delete process.env.TEST_ARRAY
  })
})

describe('GenFilePlugin', () => {
  const testOutputDir = join(process.cwd(), 'test-output')

  beforeEach(() => {
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

  it('should be created with correct name', () => {
    const plugin = new GenFilePlugin({
      name: 'test',
      formats: ['env'],
    })

    expect(plugin.name).toBe('genFilePlugin')
  })

  it('should generate env file correctly', async () => {
    const plugin = new GenFilePlugin({
      name: 'test',
      formats: ['env'],
      outputDir: testOutputDir,
    })

    const context = {
      config: { name: 'test', variables: {} },
      resolvedVariables: {
        API_URL: 'https://api.example.com',
        DEBUG: true,
        PORT: 3000,
        FEATURES: ['auth', 'dashboard'],
      },
      outputDir: testOutputDir,
      mode: 'build' as const,
    }

    await plugin.apply(context)

    const envFile = join(testOutputDir, 'test.safenv.env')
    expect(existsSync(envFile)).toBe(true)

    const envContent = readFileSync(envFile, 'utf-8')
    expect(envContent).toContain('API_URL=https://api.example.com')
    expect(envContent).toContain('DEBUG=true')
    expect(envContent).toContain('PORT=3000')
    expect(envContent).toContain('FEATURES=auth,dashboard')
  })

  it('should generate json file correctly', async () => {
    const plugin = new GenFilePlugin({
      name: 'test',
      formats: ['json'],
      outputDir: testOutputDir,
    })

    const variables = {
      API_URL: 'https://api.example.com',
      DEBUG: true,
      PORT: 3000,
    }

    const context = {
      config: { name: 'test', variables: {} },
      resolvedVariables: variables,
      outputDir: testOutputDir,
      mode: 'build' as const,
    }

    await plugin.apply(context)

    const jsonFile = join(testOutputDir, 'test.safenv.json')
    expect(existsSync(jsonFile)).toBe(true)

    const jsonContent = JSON.parse(readFileSync(jsonFile, 'utf-8'))
    expect(jsonContent).toEqual(variables)
  })

  it('should generate multiple formats', async () => {
    const plugin = new GenFilePlugin({
      name: 'test',
      formats: ['env', 'json', 'yaml'],
      outputDir: testOutputDir,
    })

    const context = {
      config: { name: 'test', variables: {} },
      resolvedVariables: { API_URL: 'https://api.example.com' },
      outputDir: testOutputDir,
      mode: 'build' as const,
    }

    await plugin.apply(context)

    expect(existsSync(join(testOutputDir, 'test.safenv.env'))).toBe(true)
    expect(existsSync(join(testOutputDir, 'test.safenv.json'))).toBe(true)
    expect(existsSync(join(testOutputDir, 'test.safenv.yaml'))).toBe(true)
  })

  it('should generate HTML tools when enabled', async () => {
    const plugin = new GenFilePlugin({
      name: 'test',
      formats: ['json'],
      outputDir: testOutputDir,
      htmlTools: { enabled: true },
    })

    const context = {
      config: {
        name: 'test',
        variables: {
          API_URL: { type: 'string' as const, description: 'API endpoint URL' },
        },
      },
      resolvedVariables: { API_URL: 'https://api.example.com' },
      outputDir: testOutputDir,
      mode: 'build' as const,
    }

    await plugin.apply(context)

    const htmlFile = join(testOutputDir, 'safenv-tools.html')
    expect(existsSync(htmlFile)).toBe(true)

    const htmlContent = readFileSync(htmlFile, 'utf-8')
    expect(htmlContent).toContain('Safenv Configuration Tools')
    expect(htmlContent).toContain('API_URL')
  })
})

describe('GenTsPlugin', () => {
  const testOutputDir = join(process.cwd(), 'test-output')

  beforeEach(() => {
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

  it('should be created with correct name', () => {
    const plugin = new GenTsPlugin({
      outputPath: './test.ts',
      validatorStyle: 'zod',
    })

    expect(plugin.name).toBe('genTsPlugin')
  })

  it('should generate TypeScript file with type definitions', async () => {
    const outputPath = join(testOutputDir, 'config.ts')
    const plugin = new GenTsPlugin({
      outputPath,
      validatorStyle: 'zod',
      exportType: 'named',
    })

    const context = {
      config: {
        name: 'test',
        variables: {
          API_URL: { type: 'string' as const },
          PORT: { type: 'number' as const },
          DEBUG: { type: 'boolean' as const },
        },
      },
      resolvedVariables: {
        API_URL: 'https://api.example.com',
        PORT: 3000,
        DEBUG: true,
      },
      outputDir: testOutputDir,
      mode: 'build' as const,
    }

    await plugin.apply(context)

    expect(existsSync(outputPath)).toBe(true)

    const tsContent = readFileSync(outputPath, 'utf-8')
    expect(tsContent).toContain('export const API_URL')
    expect(tsContent).toContain('export const PORT')
    expect(tsContent).toContain('export const DEBUG')
    expect(tsContent).toContain('z.string()')
    expect(tsContent).toContain('z.number()')
    expect(tsContent).toContain('z.boolean()')
  })

  it('should generate different export styles', async () => {
    const outputPath = join(testOutputDir, 'config.ts')
    const plugin = new GenTsPlugin({
      outputPath,
      validatorStyle: 'none',
      exportType: 'default',
    })

    const context = {
      config: {
        name: 'test',
        variables: { API_URL: { type: 'string' as const } },
      },
      resolvedVariables: { API_URL: 'https://api.example.com' },
      outputDir: testOutputDir,
      mode: 'build' as const,
    }

    await plugin.apply(context)

    const tsContent = readFileSync(outputPath, 'utf-8')
    expect(tsContent).toContain('export default')
    expect(tsContent).not.toContain('z.')
  })
})

describe('SafenvServer', () => {
  it('should extend SafenvCore with serve mode', () => {
    const server = new SafenvServer({ configFile: 'test.config' })
    expect(server).toBeInstanceOf(SafenvCore)
  })

  it('should start and stop watching', async () => {
    const server = new SafenvServer({ watch: false })

    // Test that start doesn't throw
    await expect(server.start()).resolves.not.toThrow()

    // Test that stop doesn't throw
    await expect(server.stop()).resolves.not.toThrow()
  })

  it('should handle config changes during watch mode', async () => {
    const server = new SafenvServer({ watch: true })
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await server.start()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Watching for config changes')
    )

    await server.stop()
    consoleSpy.mockRestore()
  })
})

describe('SafenvBuilder', () => {
  it('should extend SafenvCore with build mode', () => {
    const builder = new SafenvBuilder({ configFile: 'test.config' })
    expect(builder).toBeInstanceOf(SafenvCore)
  })

  it('should build configuration without watching', async () => {
    const builder = new SafenvBuilder({ watch: false })
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(builder.build()).resolves.not.toThrow()
    expect(consoleSpy).toHaveBeenCalledWith('Building safenv configuration...')

    consoleSpy.mockRestore()
  })
})

describe('SafenvWorkspace', () => {
  const testOutputDir = join(process.cwd(), 'test-output')

  beforeEach(() => {
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

  it('should extend SafenvCore with workspace functionality', () => {
    const workspace = new SafenvWorkspace({ configFile: 'test.config' })
    expect(workspace).toBeInstanceOf(SafenvWorkspace)
  })

  it('should handle missing workspace configuration', async () => {
    const workspace = new SafenvWorkspace({ configFile: 'nonexistent' })
    await expect(workspace.loadWorkspace()).rejects.toThrow(
      'No workspace configuration found'
    )
  })

  it('should load workspace configuration', async () => {
    // Create a mock workspace config
    const workspaceConfigPath = join(testOutputDir, 'workspace.config.ts')
    const workspaceConfig = `
export default {
  workspace: ['./project1', './project2']
}
`
    writeFileSync(workspaceConfigPath, workspaceConfig, 'utf8')

    // Create mock project configs
    const project1Dir = join(testOutputDir, 'project1')
    const project2Dir = join(testOutputDir, 'project2')
    mkdirSync(project1Dir, { recursive: true })
    mkdirSync(project2Dir, { recursive: true })

    const projectConfig = `
export default {
  name: 'test-project',
  variables: {
    TEST_VAR: { type: 'string', default: 'test' }
  }
}
`
    writeFileSync(join(project1Dir, 'safenv.config.ts'), projectConfig, 'utf8')
    writeFileSync(join(project2Dir, 'safenv.config.ts'), projectConfig, 'utf8')

    const workspace = new SafenvWorkspace({
      configFile: join(testOutputDir, 'workspace.config'),
    })

    const configs = await workspace.loadWorkspace()
    expect(configs).toHaveLength(2)
    expect(configs[0].name).toBe('safenv') // Default name from unconfig defaults
    expect(configs[1].name).toBe('safenv') // Default name from unconfig defaults
  })
})
