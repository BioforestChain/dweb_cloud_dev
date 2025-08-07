import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NpmSafenvResolver } from '../npm-safenv-resolver.ts'
import type { SafenvConfig } from '../types.ts'

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}))

// Mock unconfig
vi.mock('unconfig', () => ({
  loadConfig: vi.fn(),
}))

// Helper function to create proper require.resolve mock
function createRequireResolveMock(
  returnValue: string | ((id: string) => string)
) {
  const mockFn =
    typeof returnValue === 'function'
      ? vi.fn().mockImplementation(returnValue)
      : vi.fn().mockReturnValue(returnValue)

  return Object.assign(mockFn, {
    paths: vi.fn().mockReturnValue([]),
  })
}

describe('NpmSafenvResolver', () => {
  let resolver: NpmSafenvResolver
  let mockExistsSync: ReturnType<typeof vi.fn>
  let mockReadFileSync: ReturnType<typeof vi.fn>
  let mockLoadConfig: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    resolver = new NpmSafenvResolver('/test/project')

    // 使用 vi.mocked 获取 mock 函数引用
    const fs = await import('node:fs')
    const unconfig = await import('unconfig')

    mockExistsSync = vi.mocked(fs.existsSync) as any
    mockReadFileSync = vi.mocked(fs.readFileSync) as any
    mockLoadConfig = vi.mocked(unconfig.loadConfig) as any

    // 清除之前的 mock 调用
    mockExistsSync.mockClear()
    mockReadFileSync.mockClear()
    mockLoadConfig.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    resolver.clearCache()
  })

  describe('resolveSafenvConfigForPackage', () => {
    it('should resolve safenv config from npm package exports', async () => {
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
        exports: {
          safenv: './safenv.config.js',
        },
      }

      const safenvConfig: SafenvConfig = {
        variables: {
          API_KEY: {
            type: 'string',
            required: true,
            description: 'API key for test service',
          },
          PORT: {
            type: 'number',
            default: 3000,
          },
        },
      }

      // Mock package resolution
      mockExistsSync.mockImplementation((path: string) => {
        // 支持包目录检查
        if (path === '/test/project/node_modules/test-package') return true
        // 支持 package.json 文件检查
        if (path.includes('package.json')) return true
        // 支持 safenv.config.js 文件检查
        if (path.includes('safenv.config.js')) return true
        return false
      })

      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes('package.json')) {
          return JSON.stringify(packageJson)
        }
        return ''
      })

      mockLoadConfig.mockResolvedValue({ config: safenvConfig })

      // Mock require.resolve
      const originalResolve = require.resolve
      require.resolve = createRequireResolveMock(
        '/test/project/node_modules/test-package/package.json'
      ) as any

      const result = await resolver.resolveSafenvConfigForPackage(
        'test-package',
        '/test/project'
      )

      expect(result).toEqual({
        packageName: 'test-package',
        version: '1.0.0',
        configPath: expect.stringContaining('safenv.config.js'),
        config: safenvConfig,
        variables: safenvConfig.variables,
        isMonorepoProject: false,
      })

      require.resolve = originalResolve
    })

    it('should handle different exports formats', async () => {
      const testCases = [
        // Direct format
        { safenv: './config.js' },
        // Nested format
        { './safenv': './config.js' },
        // Conditional format
        { safenv: { import: './config.js' } },
      ]

      for (const exports of testCases) {
        const packageJson = {
          name: 'test-package',
          version: '1.0.0',
          exports,
        }

        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue(JSON.stringify(packageJson))
        mockLoadConfig.mockResolvedValue({ config: { variables: {} } })

        const originalResolve = require.resolve
        require.resolve = createRequireResolveMock(
          '/node_modules/test-package/package.json'
        ) as any

        const result = await resolver.resolveSafenvConfigForPackage(
          'test-package',
          '/test/project'
        )
        expect(result).toBeTruthy()

        require.resolve = originalResolve
      }
    })

    it('should return null for packages without safenv config', async () => {
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
        // No exports field
      }

      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(JSON.stringify(packageJson))

      const originalResolve = require.resolve
      require.resolve = createRequireResolveMock(
        '/node_modules/test-package/package.json'
      ) as any

      const result = await resolver.resolveSafenvConfigForPackage(
        'test-package',
        '/test/project'
      )
      expect(result).toBeNull()

      require.resolve = originalResolve
    })
  })

  describe('resolveDependencySafenvConfigs', () => {
    it('should resolve configs for all dependencies', async () => {
      const projectPackageJson = {
        name: 'my-project',
        dependencies: {
          'package-a': '^1.0.0',
          'package-b': '^2.0.0',
        },
        devDependencies: {
          'package-c': '^3.0.0',
        },
      }

      const packageAJson = {
        name: 'package-a',
        version: '1.0.0',
        exports: { safenv: './safenv.config.js' },
      }

      const packageBJson = {
        name: 'package-b',
        version: '2.0.0',
        // No safenv config
      }

      const packageCJson = {
        name: 'package-c',
        version: '3.0.0',
        exports: { safenv: './env.config.js' },
      }

      mockExistsSync.mockImplementation((path: string) => {
        // 支持项目根目录的 package.json
        if (path === '/test/project/package.json') return true
        if (path.includes('my-project/package.json')) return true
        // 支持包目录检查
        if (path === '/test/project/node_modules/package-a') return true
        if (path === '/test/project/node_modules/package-b') return true
        if (path === '/test/project/node_modules/package-c') return true
        // 支持 package.json 文件检查
        if (path.includes('package-a') && path.includes('package.json'))
          return true
        if (path.includes('package-b') && path.includes('package.json'))
          return true
        if (path.includes('package-c') && path.includes('package.json'))
          return true
        // 支持配置文件检查
        if (path.includes('package-a') && path.includes('safenv.config.js'))
          return true
        if (path.includes('package-c') && path.includes('env.config.js'))
          return true
        return false
      })

      mockReadFileSync.mockImplementation((path: string) => {
        if (path === '/test/project/package.json') {
          return JSON.stringify(projectPackageJson)
        }
        if (path.includes('my-project/package.json')) {
          return JSON.stringify(projectPackageJson)
        }
        if (path.includes('package-a/package.json')) {
          return JSON.stringify(packageAJson)
        }
        if (path.includes('package-b/package.json')) {
          return JSON.stringify(packageBJson)
        }
        if (path.includes('package-c/package.json')) {
          return JSON.stringify(packageCJson)
        }
        return ''
      })

      mockLoadConfig.mockImplementation(({ sources }) => {
        const configPath = sources[0].files[0]
        if (configPath.includes('package-a')) {
          return Promise.resolve({
            config: {
              variables: {
                API_URL: { type: 'string', required: true },
              },
            },
          })
        }
        if (configPath.includes('package-c')) {
          return Promise.resolve({
            config: {
              variables: {
                DEBUG: { type: 'boolean', default: false },
              },
            },
          })
        }
        return Promise.resolve({ config: null })
      })

      const originalResolve = require.resolve
      // 使用辅助函数创建复杂的 require.resolve mock
      require.resolve = createRequireResolveMock((id: string) => {
        if (id.includes('package-a'))
          return '/test/project/node_modules/package-a/package.json'
        if (id.includes('package-b'))
          return '/test/project/node_modules/package-b/package.json'
        if (id.includes('package-c'))
          return '/test/project/node_modules/package-c/package.json'
        throw new Error('Module not found')
      }) as any

      const result =
        await resolver.resolveDependencySafenvConfigs('/test/project')

      // 调试信息
      console.log('Second test result:', result)
      console.log(
        'Second test mockExistsSync calls:',
        mockExistsSync.mock.calls
      )
      console.log(
        'Second test mockReadFileSync calls:',
        mockReadFileSync.mock.calls
      )
      console.log(
        'Second test mockLoadConfig calls:',
        mockLoadConfig.mock.calls
      )

      expect(result).toHaveLength(2) // package-a and package-c
      expect(result[0].packageName).toBe('package-a')
      expect(result[1].packageName).toBe('package-c')

      require.resolve = originalResolve
    })
  })

  describe('getAllDependencyVariables', () => {
    it('should collect all variables from dependencies', async () => {
      // Mock the resolveDependencySafenvConfigs method
      vi.spyOn(resolver, 'resolveDependencySafenvConfigs').mockResolvedValue([
        {
          packageName: 'package-a',
          version: '1.0.0',
          configPath: '/path/to/config',
          config: { variables: {} },
          variables: {
            API_KEY: {
              type: 'string',
              required: true,
              description: 'API key',
            },
            PORT: {
              type: 'number',
              default: 3000,
            },
          },
          isMonorepoProject: false,
        },
        {
          packageName: 'workspace-b',
          version: '1.0.0',
          configPath: '/path/to/workspace/config',
          config: { variables: {} },
          variables: {
            DATABASE_URL: {
              type: 'string',
              required: true,
            },
          },
          isMonorepoProject: true,
          projectPath: '/workspace/b',
        },
      ])

      const variables =
        await resolver.getAllDependencyVariables('/test/project')

      expect(variables).toHaveLength(3)
      expect(variables[0]).toEqual({
        variable: 'API_KEY',
        source: 'package-a',
        type: 'string',
        required: true,
        description: 'API key',
        defaultValue: undefined,
        category: 'npm',
      })
      expect(variables[1]).toEqual({
        variable: 'PORT',
        source: 'package-a',
        type: 'number',
        required: false,
        description: undefined,
        defaultValue: 3000,
        category: 'npm',
      })
      expect(variables[2]).toEqual({
        variable: 'DATABASE_URL',
        source: 'workspace-b',
        type: 'string',
        required: true,
        description: undefined,
        defaultValue: undefined,
        category: 'monorepo',
      })
    })
  })

  describe('generateDependencyVisualization', () => {
    it('should generate visualization data', async () => {
      const projectPackageJson = {
        name: 'my-project',
        version: '1.0.0',
      }

      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(JSON.stringify(projectPackageJson))

      // Mock the resolveDependencySafenvConfigs method
      vi.spyOn(resolver, 'resolveDependencySafenvConfigs').mockResolvedValue([
        {
          packageName: 'package-a',
          version: '1.0.0',
          configPath: '/path/to/config',
          config: { variables: {} },
          variables: {
            API_KEY: { type: 'string', required: true },
            PORT: { type: 'number', default: 3000 },
          },
          isMonorepoProject: false,
        },
      ])

      const result =
        await resolver.generateDependencyVisualization('/test/project')

      expect(result.nodes).toHaveLength(4) // project + package + 2 variables
      expect(result.edges).toHaveLength(3) // 1 depends + 2 provides

      // Check project node
      const projectNode = result.nodes.find(n => n.name === 'my-project')
      expect(projectNode).toEqual({
        id: 'my-project',
        name: 'my-project',
        type: 'project',
        category: 'local',
      })

      // Check package node
      const packageNode = result.nodes.find(n => n.name === 'package-a')
      expect(packageNode).toEqual({
        id: 'package-a',
        name: 'package-a',
        type: 'package',
        category: 'npm',
        variableCount: 2,
        version: '1.0.0',
      })

      // Check dependency edge
      const dependsEdge = result.edges.find(e => e.type === 'depends')
      expect(dependsEdge).toEqual({
        source: 'my-project',
        target: 'package-a',
        type: 'depends',
        variables: ['API_KEY', 'PORT'],
      })
    })
  })

  describe('extractSafenvConfigFromExports', () => {
    it('should extract config path from various export formats', () => {
      const resolver = new NpmSafenvResolver()
      const extractMethod = (
        resolver as any
      ).extractSafenvConfigFromExports.bind(resolver)

      // Direct format
      expect(extractMethod({ safenv: './config.js' })).toBe('./config.js')

      // Nested format
      expect(extractMethod({ './safenv': './config.js' })).toBe('./config.js')

      // Conditional format - import
      expect(extractMethod({ safenv: { import: './config.js' } })).toBe(
        './config.js'
      )

      // Conditional format - require
      expect(extractMethod({ safenv: { require: './config.js' } })).toBe(
        './config.js'
      )

      // Conditional format - default
      expect(extractMethod({ safenv: { default: './config.js' } })).toBe(
        './config.js'
      )

      // No safenv config
      expect(extractMethod({ main: './index.js' })).toBeNull()
      expect(extractMethod(null)).toBeNull()
      expect(extractMethod(undefined)).toBeNull()
    })
  })
})
