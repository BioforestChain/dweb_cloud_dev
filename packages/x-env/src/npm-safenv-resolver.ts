import { resolve, join, dirname } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { loadConfig } from 'unconfig'
import type { SafenvConfig, SafenvVariable } from './types.ts'

/**
 * NPM 包的 safenv 配置信息
 */
export interface NpmSafenvConfig {
  packageName: string
  version: string
  configPath: string
  config: SafenvConfig
  variables: Record<string, SafenvVariable>
  isMonorepoProject: boolean
  projectPath?: string // monorepo 项目路径
}

/**
 * 依赖的环境变量信息
 */
export interface DependencyVariableInfo {
  variable: string
  source: string // 包名或项目名
  type: SafenvVariable['type']
  required: boolean
  description?: string
  defaultValue?: any
  category: 'npm' | 'monorepo' | 'local'
}

/**
 * NPM Safenv 解析器
 * 支持从 npm 包的 exports 字段和 monorepo 项目中解析 safenv.config
 */
export class NpmSafenvResolver {
  private workspaceRoot: string
  private cache = new Map<string, NpmSafenvConfig>()
  private packageJsonCache = new Map<string, any>()

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = resolve(workspaceRoot)
  }

  /**
   * 解析项目的所有依赖的 safenv 配置
   */
  async resolveDependencySafenvConfigs(
    projectPath: string = this.workspaceRoot
  ): Promise<NpmSafenvConfig[]> {
    const configs: NpmSafenvConfig[] = []

    // 1. 读取项目的 package.json
    const packageJsonPath = join(projectPath, 'package.json')
    if (!existsSync(packageJsonPath)) {
      return configs
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    }

    // 2. 检查每个依赖是否有 safenv 配置
    for (const [packageName, _version] of Object.entries(allDependencies)) {
      try {
        const config = await this.resolveSafenvConfigForPackage(
          packageName,
          projectPath
        )
        if (config) {
          configs.push(config)
        }
      } catch (error) {
        console.warn(
          `Failed to resolve safenv config for ${packageName}:`,
          error
        )
      }
    }

    // 3. 如果是 monorepo，还要检查工作区内的其他项目
    const monorepoConfigs = await this.resolveMonorepoSafenvConfigs(projectPath)
    configs.push(...monorepoConfigs)

    return configs
  }

  /**
   * 为特定包解析 safenv 配置
   */
  async resolveSafenvConfigForPackage(
    packageName: string,
    fromPath: string
  ): Promise<NpmSafenvConfig | null> {
    // 检查缓存
    const cacheKey = `${packageName}:${fromPath}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    try {
      // 1. 尝试解析包的路径
      const packagePath = this.resolvePackagePath(packageName, fromPath)
      if (!packagePath) {
        return null
      }

      // 2. 读取包的 package.json
      const packageJsonPath = join(packagePath, 'package.json')
      if (!existsSync(packageJsonPath)) {
        return null
      }

      const packageJson = this.getPackageJson(packageJsonPath)

      // 3. 检查 exports 字段中的 safenv 配置
      const safenvConfigPath = this.extractSafenvConfigFromExports(
        packageJson.exports
      )

      if (!safenvConfigPath) {
        return null
      }

      // 4. 解析 safenv 配置文件
      const fullConfigPath = resolve(packagePath, safenvConfigPath)
      const config = await this.loadSafenvConfig(fullConfigPath)

      if (!config) {
        return null
      }

      const result: NpmSafenvConfig = {
        packageName,
        version: packageJson.version || 'unknown',
        configPath: fullConfigPath,
        config,
        variables: config.variables || {},
        isMonorepoProject: false,
      }

      // 缓存结果
      this.cache.set(cacheKey, result)
      return result
    } catch (error) {
      console.warn(`Error resolving safenv config for ${packageName}:`, error)
      return null
    }
  }

  /**
   * 解析 monorepo 中其他项目的 safenv 配置
   */
  async resolveMonorepoSafenvConfigs(
    projectPath: string
  ): Promise<NpmSafenvConfig[]> {
    const configs: NpmSafenvConfig[] = []

    // 查找工作区根目录
    const workspaceRoot = await this.findWorkspaceRoot(projectPath)
    if (!workspaceRoot) {
      return configs
    }

    // 读取工作区配置
    const workspacePackageJson = this.getPackageJson(
      join(workspaceRoot, 'package.json')
    )
    const workspaces = workspacePackageJson.workspaces || []

    if (!Array.isArray(workspaces)) {
      return configs
    }

    // 解析每个工作区项目
    for (const workspace of workspaces) {
      const workspacePaths = await this.resolveWorkspaceGlob(
        workspace,
        workspaceRoot
      )

      for (const workspacePath of workspacePaths) {
        if (workspacePath === projectPath) {
          continue // 跳过当前项目
        }

        try {
          const config = await this.loadProjectSafenvConfig(workspacePath)
          if (config) {
            const packageJson = this.getPackageJson(
              join(workspacePath, 'package.json')
            )
            configs.push({
              packageName: packageJson.name || 'unknown',
              version: packageJson.version || 'unknown',
              configPath: config.configPath,
              config: config.config,
              variables: config.config.variables || {},
              isMonorepoProject: true,
              projectPath: workspacePath,
            })
          }
        } catch (error) {
          console.warn(
            `Failed to load safenv config from workspace ${workspacePath}:`,
            error
          )
        }
      }
    }

    return configs
  }

  /**
   * 获取所有依赖的环境变量信息
   */
  async getAllDependencyVariables(
    projectPath: string = this.workspaceRoot
  ): Promise<DependencyVariableInfo[]> {
    const configs = await this.resolveDependencySafenvConfigs(projectPath)
    const variables: DependencyVariableInfo[] = []

    for (const config of configs) {
      for (const [varName, varConfig] of Object.entries(config.variables)) {
        variables.push({
          variable: varName,
          source: config.packageName,
          type: varConfig.type || 'string',
          required: varConfig.required || false,
          description: varConfig.description,
          defaultValue: varConfig.default,
          category: config.isMonorepoProject ? 'monorepo' : 'npm',
        })
      }
    }

    return variables
  }

  /**
   * 生成依赖关系可视化数据
   */
  async generateDependencyVisualization(
    projectPath: string = this.workspaceRoot
  ): Promise<{
    nodes: Array<{
      id: string
      name: string
      type: 'project' | 'package' | 'variable'
      category?: 'npm' | 'monorepo' | 'local'
      variableCount?: number
      version?: string
    }>
    edges: Array<{
      source: string
      target: string
      type: 'depends' | 'provides'
      variables?: string[]
    }>
  }> {
    const configs = await this.resolveDependencySafenvConfigs(projectPath)
    const nodes: any[] = []
    const edges: any[] = []

    // 添加当前项目节点
    const currentPackageJson = this.getPackageJson(
      join(projectPath, 'package.json')
    )
    const currentProjectName = currentPackageJson.name || 'current-project'

    nodes.push({
      id: currentProjectName,
      name: currentProjectName,
      type: 'project',
      category: 'local',
    })

    // 添加依赖包节点和边
    for (const config of configs) {
      const nodeId = config.packageName

      // 添加包节点
      nodes.push({
        id: nodeId,
        name: config.packageName,
        type: 'package',
        category: config.isMonorepoProject ? 'monorepo' : 'npm',
        variableCount: Object.keys(config.variables).length,
        version: config.version,
      })

      // 添加依赖边
      edges.push({
        source: currentProjectName,
        target: nodeId,
        type: 'depends',
        variables: Object.keys(config.variables),
      })

      // 添加变量节点
      for (const [varName, _varConfig] of Object.entries(config.variables)) {
        const varNodeId = `${nodeId}:${varName}`
        nodes.push({
          id: varNodeId,
          name: varName,
          type: 'variable',
          category: config.isMonorepoProject ? 'monorepo' : 'npm',
        })

        // 添加提供变量的边
        edges.push({
          source: nodeId,
          target: varNodeId,
          type: 'provides',
        })
      }
    }

    return { nodes, edges }
  }

  /**
   * 从 package.json exports 字段提取 safenv 配置路径
   */
  private extractSafenvConfigFromExports(exports: any): string | null {
    if (!exports || typeof exports !== 'object') {
      return null
    }

    // 支持多种 exports 格式
    // 1. 直接指定: { "safenv": "./safenv.config.js" }
    if (exports.safenv && typeof exports.safenv === 'string') {
      return exports.safenv
    }

    // 2. 嵌套格式: { "./safenv": "./safenv.config.js" }
    if (exports['./safenv'] && typeof exports['./safenv'] === 'string') {
      return exports['./safenv']
    }

    // 3. 条件导出: { "safenv": { "import": "./safenv.config.js" } }
    if (exports.safenv && typeof exports.safenv === 'object') {
      return (
        exports.safenv.import ||
        exports.safenv.require ||
        exports.safenv.default
      )
    }

    return null
  }

  /**
   * 解析包路径
   */
  private resolvePackagePath(
    packageName: string,
    fromPath: string
  ): string | null {
    try {
      // 尝试使用 Node.js 模块解析
      const packageJsonPath = require.resolve(`${packageName}/package.json`, {
        paths: [fromPath],
      })
      return dirname(packageJsonPath)
    } catch {
      // 回退到手动查找
      const nodeModulesPath = join(fromPath, 'node_modules', packageName)
      if (existsSync(nodeModulesPath)) {
        return nodeModulesPath
      }
      return null
    }
  }

  /**
   * 加载 safenv 配置文件
   */
  private async loadSafenvConfig(
    configPath: string
  ): Promise<SafenvConfig | null> {
    try {
      if (!existsSync(configPath)) {
        return null
      }

      // 使用 unconfig 加载配置
      const { config } = await loadConfig<SafenvConfig>({
        sources: [
          {
            files: [configPath],
          },
        ],
      })

      return config || null
    } catch (error) {
      console.warn(`Failed to load safenv config from ${configPath}:`, error)
      return null
    }
  }

  /**
   * 加载项目的 safenv 配置
   */
  private async loadProjectSafenvConfig(projectPath: string): Promise<{
    configPath: string
    config: SafenvConfig
  } | null> {
    const configFiles = [
      'safenv.config.js',
      'safenv.config.ts',
      'safenv.config.json',
      '.safenvrc.js',
      '.safenvrc.json',
    ]

    for (const configFile of configFiles) {
      const configPath = join(projectPath, configFile)
      if (existsSync(configPath)) {
        const config = await this.loadSafenvConfig(configPath)
        if (config) {
          return { configPath, config }
        }
      }
    }

    return null
  }

  /**
   * 查找工作区根目录
   */
  private async findWorkspaceRoot(startPath: string): Promise<string | null> {
    let currentPath = startPath

    while (currentPath !== dirname(currentPath)) {
      const packageJsonPath = join(currentPath, 'package.json')
      if (existsSync(packageJsonPath)) {
        const packageJson = this.getPackageJson(packageJsonPath)
        if (packageJson.workspaces) {
          return currentPath
        }
      }
      currentPath = dirname(currentPath)
    }

    return null
  }

  /**
   * 解析工作区 glob 模式
   */
  private async resolveWorkspaceGlob(
    pattern: string,
    workspaceRoot: string
  ): Promise<string[]> {
    // 简化实现，实际应该使用 glob 库
    const paths: string[] = []

    if (pattern.includes('*')) {
      // 处理通配符模式，这里简化处理
      const baseDir = pattern.replace('/*', '')
      const fullPath = join(workspaceRoot, baseDir)

      try {
        const { readdirSync, statSync } = await import('node:fs')
        const entries = readdirSync(fullPath)

        for (const entry of entries) {
          const entryPath = join(fullPath, entry)
          if (statSync(entryPath).isDirectory()) {
            const packageJsonPath = join(entryPath, 'package.json')
            if (existsSync(packageJsonPath)) {
              paths.push(entryPath)
            }
          }
        }
      } catch {
        // 忽略错误
      }
    } else {
      // 直接路径
      const fullPath = join(workspaceRoot, pattern)
      if (existsSync(join(fullPath, 'package.json'))) {
        paths.push(fullPath)
      }
    }

    return paths
  }

  /**
   * 获取并缓存 package.json
   */
  private getPackageJson(packageJsonPath: string): any {
    if (this.packageJsonCache.has(packageJsonPath)) {
      return this.packageJsonCache.get(packageJsonPath)
    }

    try {
      const content = readFileSync(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(content)
      this.packageJsonCache.set(packageJsonPath, packageJson)
      return packageJson
    } catch {
      return {}
    }
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear()
    this.packageJsonCache.clear()
  }
}
