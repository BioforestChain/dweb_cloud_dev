import { BasePlugin } from './base.ts'
import type { GenTsPluginOptions } from './types.ts'
import type { SafenvContext, SafenvVariable } from '../types.ts'

export class GenTsPlugin extends BasePlugin {
  name = 'genTsPlugin'

  constructor(private options: GenTsPluginOptions) {
    super()
  }

  async apply(context: SafenvContext): Promise<void> {
    const content = this.generateTsContent(context)
    this.writeFile(this.options.outputPath, content)
  }

  private generateTsContent(context: SafenvContext): string {
    const parts: string[] = []

    // Add imports
    if (this.options.validatorStyle === 'zod') {
      parts.push(this.generateZodImports(context.config.variables))
    }

    // Handle different export types
    if (this.options.exportType === 'named') {
      parts.push(this.generateNamedExports(context))
    } else if (this.options.exportType === 'default') {
      parts.push(this.generateDefaultExport(context))
    } else {
      // Original object-based approach
      parts.push(this.generateValidator(context.config.variables))

      if (this.options.exportMode) {
        parts.push(this.generateExport(context))
      }
    }

    return parts.join('\n\n')
  }

  private generateZodImports(
    variables: Record<string, SafenvVariable>
  ): string {
    const usedTypes = new Set<string>()

    Object.values(variables).forEach(variable => {
      switch (variable.type) {
        case 'string':
          usedTypes.add('string')
          break
        case 'number':
          usedTypes.add('number')
          break
        case 'boolean':
          usedTypes.add('boolean')
          break
        case 'array':
          usedTypes.add('array')
          usedTypes.add('string')
          break
        case 'object':
          usedTypes.add('record')
          usedTypes.add('any')
          break
      }
    })

    return `import { z } from 'zod'`
  }

  private generateValidator(variables: Record<string, SafenvVariable>): string {
    const validatorName = this.options.validatorName || 'zSafenv'

    if (this.options.validatorStyle === 'zod') {
      return this.generateZodValidator(validatorName, variables)
    } else {
      return this.generatePureValidator(validatorName, variables)
    }
  }

  private generateZodValidator(
    validatorName: string,
    variables: Record<string, SafenvVariable>
  ): string {
    const fields: string[] = []

    Object.entries(variables).forEach(([key, variable]) => {
      let fieldDef = this.getZodType(variable)

      if (variable.default !== undefined) {
        fieldDef += `.default(${JSON.stringify(variable.default)})`
      }

      if (!variable.required) {
        fieldDef += '.optional()'
      }

      fields.push(`  ${key}: ${fieldDef}`)
    })

    const exportPrefix = this.options.exportValidator !== false ? 'export ' : ''
    return `${exportPrefix}const ${validatorName} = z.object({\n${fields.join(',\n')}\n})`
  }

  private generatePureValidator(
    validatorName: string,
    variables: Record<string, SafenvVariable>
  ): string {
    const parsers: string[] = []
    const validators: string[] = []

    Object.entries(variables).forEach(([key, variable]) => {
      const parser = this.getPureParser(variable.type)
      parsers.push(`  ${key}: ${parser}`)
    })

    validators.push(`const parsers = {\n${parsers.join(',\n')}\n}`)

    const parseLogic = Object.entries(variables)
      .map(([key, variable]) => {
        let logic = `const ${key}Raw = env.${key}`

        if (variable.default !== undefined) {
          logic += ` ?? ${JSON.stringify(variable.default)}`
        }

        if (variable.required) {
          logic += `\n  if (${key}Raw === undefined) throw new Error('Required variable ${key} is not set')`
        }

        logic += `\n  const ${key} = parsers.${key}(${key}Raw)`

        return logic
      })
      .join('\n  ')

    const returnObj = Object.keys(variables)
      .map(key => `    ${key}`)
      .join(',\n')

    const exportPrefix = this.options.exportValidator !== false ? 'export ' : ''

    return `${parsers.join('\n')}

${exportPrefix}const ${validatorName} = {
  parse: (env: Record<string, any>) => {
    ${parseLogic}
    
    return {
${returnObj}
    }
  }
}`
  }

  private getZodType(variable: SafenvVariable): string {
    switch (variable.type) {
      case 'string':
        return 'z.string()'
      case 'number':
        return 'z.number()'
      case 'boolean':
        return 'z.boolean()'
      case 'array':
        return 'z.array(z.string())'
      case 'object':
        return 'z.record(z.any())'
      default:
        return 'z.string()'
    }
  }

  private getPureParser(type: string): string {
    switch (type) {
      case 'string':
        return '(v: any) => String(v)'
      case 'number':
        return '(v: any) => Number(v)'
      case 'boolean':
        return '(v: any) => String(v).toLowerCase() === "true"'
      case 'array':
        return '(v: any) => String(v).split(",").map(s => s.trim())'
      case 'object':
        return '(v: any) => JSON.parse(String(v))'
      default:
        return '(v: any) => String(v)'
    }
  }

  private generateExport(context: SafenvContext): string {
    const exportName = this.options.exportName || 'safenv'
    const validatorName = this.options.validatorName || 'zSafenv'

    switch (this.options.exportMode) {
      case 'process.env':
        return `export const ${exportName} = ${validatorName}.parse(process.env)`

      case 'process.env-static':
        return this.generateStaticExport(context, exportName, validatorName)

      case 'env-file':
        return this.generateEnvFileExport(context, exportName, validatorName)

      case 'json-file':
      case 'yaml-file':
      case 'toml-file':
        return this.generateFileExport(context, exportName, validatorName)

      default:
        return `export const ${exportName} = ${validatorName}.parse(process.env)`
    }
  }

  private generateStaticExport(
    context: SafenvContext,
    exportName: string,
    validatorName: string
  ): string {
    const staticExports = Object.keys(context.config.variables).map(key => {
      const constName = `${exportName.toUpperCase()}_${key}`
      return `export const ${constName} = /* @__PURE__ */ ${validatorName}.shape.${key}.parse(process.env.${key})`
    })

    return staticExports.join('\n')
  }

  private generateEnvFileExport(
    context: SafenvContext,
    exportName: string,
    validatorName: string
  ): string {
    const deps = this.options.customDeps || []
    const injectCode = this.options.customInjectCode || []

    const imports =
      deps.length > 0
        ? deps.map(dep => `import '${dep}'`).join('\n') + '\n'
        : ''
    const injectedCode = injectCode.join('\n')

    return `${imports}${injectedCode}
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envFile = resolve(import.meta.dirname, '${context.config.name}.safenv.env')
if (existsSync(envFile)) {
  process.loadEnvFile(envFile)
}

export const ${exportName} = ${validatorName}.parse(process.env)`
  }

  private generateFileExport(
    context: SafenvContext,
    exportName: string,
    validatorName: string
  ): string {
    const mode = this.options.exportMode!
    const extension = mode.split('-')[0]
    const deps = this.options.customDeps || this.getDefaultDeps(extension)
    const injectCode =
      this.options.customInjectCode || this.getDefaultInjectCode(extension)

    const imports = deps.map(dep => `import '${dep}'`).join('\n')
    const fileName = `${context.config.name}.safenv.${extension}`

    return `${imports}
${injectCode.join('\n')}
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const configFile = resolve(import.meta.dirname, '${fileName}')
let config = {}
if (existsSync(configFile)) {
  const content = readFileSync(configFile, 'utf8')
  config = ${this.getParseFunction(extension)}(content)
}

export const ${exportName} = ${validatorName}.parse(config)`
  }

  private getDefaultDeps(extension: string): string[] {
    switch (extension) {
      case 'json':
        return []
      case 'yaml':
        return ['js-yaml']
      case 'toml':
        return ['@iarna/toml']
      default:
        return []
    }
  }

  private getDefaultInjectCode(extension: string): string[] {
    switch (extension) {
      case 'json':
        return []
      case 'yaml':
        return ["import YAML from 'js-yaml'"]
      case 'toml':
        return ["import TOML from '@iarna/toml'"]
      default:
        return []
    }
  }

  private getParseFunction(extension: string): string {
    switch (extension) {
      case 'json':
        return 'JSON.parse'
      case 'yaml':
        return 'YAML.load'
      case 'toml':
        return 'TOML.parse'
      default:
        return 'JSON.parse'
    }
  }

  private generateNamedExports(context: SafenvContext): string {
    const exports: string[] = []

    Object.entries(context.config.variables).forEach(([key, variable]) => {
      if (this.options.validatorStyle === 'zod') {
        const zodType = this.getZodType(variable)
        let fieldDef = zodType

        if (variable.default !== undefined) {
          fieldDef += `.default(${JSON.stringify(variable.default)})`
        }

        if (!variable.required) {
          fieldDef += '.optional()'
        }

        exports.push(
          `export const ${key} = ${fieldDef}.parse(process.env.${key})`
        )
      } else {
        const value =
          context.resolvedVariables[key] !== undefined
            ? JSON.stringify(context.resolvedVariables[key])
            : 'process.env.' + key
        exports.push(`export const ${key} = ${value}`)
      }
    })

    return exports.join('\n')
  }

  private generateDefaultExport(context: SafenvContext): string {
    if (this.options.validatorStyle === 'none') {
      const fields = Object.entries(context.resolvedVariables)
        .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
        .join(',\n')

      return `export default {\n${fields}\n}`
    } else {
      // Generate validator and use it for default export
      const validator = this.generateValidator(context.config.variables)
      const validatorName = this.options.validatorName || 'zSafenv'

      return `${validator}\n\nexport default ${validatorName}.parse(process.env)`
    }
  }
}
