import { resolve, join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import type { SafenvConfig, SafenvVariable } from './types.ts'

export interface DependencyConfig {
  packageName: string
  configPath: string
  config: SafenvConfig
  prefix: string
}

export class DependencyResolver {
  private packageJsonPath: string
  private projectRoot: string

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
    this.packageJsonPath = join(projectRoot, 'package.json')
  }

  /**
   * Auto-discover safenv configurations from package.json dependencies
   */
  async discoverDependencies(): Promise<DependencyConfig[]> {
    if (!existsSync(this.packageJsonPath)) {
      return []
    }

    try {
      const packageJson = JSON.parse(
        readFileSync(this.packageJsonPath, 'utf-8')
      )
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
      }

      const discoveredConfigs: DependencyConfig[] = []

      for (const [packageName, version] of Object.entries(dependencies)) {
        if (typeof version !== 'string') continue

        const dependencyConfig = await this.loadDependencyConfig(packageName)
        if (dependencyConfig) {
          discoveredConfigs.push(dependencyConfig)
        }
      }

      return discoveredConfigs
    } catch (error) {
      console.warn(
        'Failed to discover dependencies:',
        error instanceof Error ? error.message : String(error)
      )
      return []
    }
  }

  /**
   * Load safenv configuration from a dependency package
   */
  private async loadDependencyConfig(
    packageName: string
  ): Promise<DependencyConfig | null> {
    try {
      // Try to resolve the package
      const packagePath = this.resolvePackagePath(packageName)
      if (!packagePath) return null

      // Check if package.json has safenv configuration export
      const packageJsonPath = join(packagePath, 'package.json')
      if (!existsSync(packageJsonPath)) return null

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

      // Check if package exports safenv configuration
      const safenvConfigPath = this.findSafenvConfigExport(
        packageJson,
        packagePath
      )
      if (!safenvConfigPath) return null

      // Load the configuration
      const config = await this.loadConfigFromPath(safenvConfigPath)
      if (!config) return null

      // Generate prefix from package name
      const prefix = this.generatePrefix(packageName)

      return {
        packageName,
        configPath: safenvConfigPath,
        config,
        prefix,
      }
    } catch (error) {
      console.warn(
        `Failed to load config from ${packageName}:`,
        error instanceof Error ? error.message : String(error)
      )
      return null
    }
  }

  /**
   * Resolve package path using Node.js module resolution
   */
  private resolvePackagePath(packageName: string): string | null {
    try {
      // Try to resolve package.json of the dependency
      const packageJsonPath = require.resolve(`${packageName}/package.json`, {
        paths: [this.projectRoot],
      })
      return resolve(packageJsonPath, '..')
    } catch {
      return null
    }
  }

  /**
   * Find safenv configuration export in package.json
   */
  private findSafenvConfigExport(
    packageJson: any,
    packagePath: string
  ): string | null {
    // Check exports field
    if (packageJson.exports) {
      const exports = packageJson.exports

      // Look for safenv-specific exports
      const safenvExports = [
        './safenv.config.js',
        './safenv.config.ts',
        './safenv.config.json',
        './safenv',
        './config/safenv',
      ]

      for (const exportPath of safenvExports) {
        if (exports[exportPath]) {
          const resolvedPath = join(packagePath, exports[exportPath])
          if (existsSync(resolvedPath)) {
            return resolvedPath
          }
        }
      }

      // Check if there's a general config export that might be safenv
      if (exports['./config'] || exports['./package.json']) {
        // This could indicate the package has configuration exports
        // Let's check for standard safenv config files
      }
    }

    // Check for standard safenv config files in package root
    const standardConfigFiles = [
      'safenv.config.js',
      'safenv.config.ts',
      'safenv.config.json',
      'safenv.config.yaml',
      'safenv.config.yml',
    ]

    for (const configFile of standardConfigFiles) {
      const configPath = join(packagePath, configFile)
      if (existsSync(configPath)) {
        return configPath
      }
    }

    return null
  }

  /**
   * Load configuration from file path
   */
  private async loadConfigFromPath(
    configPath: string
  ): Promise<SafenvConfig | null> {
    try {
      const ext = configPath.split('.').pop()?.toLowerCase()

      switch (ext) {
        case 'js':
        case 'ts':
          // For JS/TS files, we need to require them
          // Note: This is a simplified implementation
          // In a real scenario, you might want to use dynamic imports or a more sophisticated loader
          delete require.cache[configPath]
          const module = require(configPath)
          return module.default || module

        case 'json':
          const jsonContent = readFileSync(configPath, 'utf-8')
          return JSON.parse(jsonContent)

        case 'yaml':
        case 'yml':
          // For YAML files, you'd need a YAML parser
          // For now, we'll skip YAML support in dependencies
          console.warn(
            `YAML config files not supported for dependencies: ${configPath}`
          )
          return null

        default:
          console.warn(`Unsupported config file format: ${configPath}`)
          return null
      }
    } catch (error) {
      console.warn(
        `Failed to load config from ${configPath}:`,
        error instanceof Error ? error.message : String(error)
      )
      return null
    }
  }

  /**
   * Generate prefix from package name
   * Examples:
   * - "my-package" -> "MY_PACKAGE_"
   * - "@scope/package" -> "SCOPE_PACKAGE_"
   * - "camelCase" -> "CAMEL_CASE_"
   */
  private generatePrefix(packageName: string): string {
    return (
      packageName
        .replace(/^@/, '') // Remove @ from scoped packages
        .replace(/[/\-.]/g, '_') // Replace separators with underscores
        .replace(/([a-z])([A-Z])/g, '$1_$2') // Add underscore before capital letters
        .toUpperCase() + '_'
    )
  }

  /**
   * Merge dependency variables into main config with prefixes
   */
  mergeDependencyVariables(
    mainVariables: Record<string, SafenvVariable>,
    dependencyConfigs: DependencyConfig[]
  ): Record<string, SafenvVariable> {
    const mergedVariables = { ...mainVariables }

    for (const depConfig of dependencyConfigs) {
      const { config, prefix } = depConfig

      for (const [varName, variable] of Object.entries(config.variables)) {
        const prefixedName = prefix + varName

        // Add dependency info to the variable description
        const dependencyInfo = `[From ${depConfig.packageName}]`
        const description = variable.description
          ? `${dependencyInfo} ${variable.description}`
          : `${dependencyInfo} Variable from dependency ${depConfig.packageName}`

        mergedVariables[prefixedName] = {
          ...variable,
          description,
        }
      }
    }

    return mergedVariables
  }

  /**
   * Resolve dependency variables with their prefixed names
   */
  resolveDependencyVariables(
    mainResolvedVariables: Record<string, any>,
    dependencyConfigs: DependencyConfig[]
  ): Record<string, any> {
    const resolvedVariables = { ...mainResolvedVariables }

    for (const depConfig of dependencyConfigs) {
      const { config, prefix } = depConfig

      for (const [varName, variable] of Object.entries(config.variables)) {
        const prefixedName = prefix + varName

        // Try to get value from environment or use default
        const envValue = process.env[prefixedName]
        if (envValue !== undefined) {
          resolvedVariables[prefixedName] = this.parseVariableValue(
            envValue,
            variable.type
          )
        } else if (variable.default !== undefined) {
          resolvedVariables[prefixedName] = variable.default
        } else if (variable.required) {
          // For required variables without values, we'll let the main resolver handle the error
          resolvedVariables[prefixedName] = undefined
        }
      }
    }

    return resolvedVariables
  }

  /**
   * Parse variable value based on type
   */
  private parseVariableValue(value: string, type: SafenvVariable['type']): any {
    switch (type) {
      case 'number':
        const num = Number(value)
        return isNaN(num) ? value : num
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1'
      case 'array':
        return value.split(',').map(item => item.trim())
      case 'object':
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      case 'string':
      default:
        return value
    }
  }
}
