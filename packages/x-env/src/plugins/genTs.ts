import { BasePlugin } from './base.ts'
import type { GenTsPluginOptions } from './types.ts'
import type { SafenvContext, SafenvVariable } from '../types.ts'

export class GenTsPlugin extends BasePlugin {
  name = 'genTsPlugin'

  constructor(private options: GenTsPluginOptions) {
    super()
  }

  async apply(context: SafenvContext): Promise<void> {
    const content = this.generateStandardSchemaContent(context)
    this.writeFile(this.options.outputPath, content)
  }

  private generateStandardSchemaContent(context: SafenvContext): string {
    const parts: string[] = []

    // Add Standard Schema interface import
    parts.push(this.generateStandardSchemaImport())

    // Generate the schema type definition
    parts.push(this.generateSchemaTypeDefinition(context))

    // Generate the main validation function
    parts.push(this.generateValidationFunction(context))

    // Generate export based on export mode
    if (this.options.exportMode) {
      parts.push(this.generateExport(context))
    }

    return parts.join('\n\n')
  }

  private generateStandardSchemaImport(): string {
    return `/** Standard Schema interface for TypeScript schema validation libraries */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }

  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }

  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['input'];

  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['output'];
}`
  }

  private generateSchemaTypeDefinition(context: SafenvContext): string {
    const configName = context.config.name
    const pascalCaseName = this.toPascalCase(configName)

    // Generate TypeScript interface for the expected shape
    const interfaceFields = Object.entries(context.config.variables)
      .map(([key, variable]) => {
        const tsType = this.getTypeScriptType(variable)
        const optional = !variable.required ? '?' : ''
        const comment = variable.description
          ? `  /** ${variable.description} */\n`
          : ''
        return `${comment}  ${key}${optional}: ${tsType}`
      })
      .join('\n')

    return `/** Configuration interface for ${configName} */
export interface ${pascalCaseName}Config {
${interfaceFields}
}

/** Standard Schema for ${configName} configuration */
export interface ${pascalCaseName}Schema extends StandardSchemaV1<${pascalCaseName}Config> {
  readonly name: '${configName}';
}`
  }

  private generateValidationFunction(context: SafenvContext): string {
    const configName = context.config.name
    const pascalCaseName = this.toPascalCase(configName)
    const functionName =
      this.options.validatorName || `create${pascalCaseName}Schema`

    const validationLogic = this.generateValidationLogic(
      context.config.variables
    )

    return `/** Creates a Standard Schema validator for ${configName} configuration */
export function ${functionName}(): ${pascalCaseName}Schema {
  return {
    name: '${configName}',
    '~standard': {
      version: 1,
      vendor: 'safenv',
      validate(value: unknown): StandardSchemaV1.Result<${pascalCaseName}Config> {
        ${validationLogic}
      },
      types: {} as StandardSchemaV1.Types<${pascalCaseName}Config, ${pascalCaseName}Config>
    }
  }
}`
  }

  private generateValidationLogic(
    variables: Record<string, SafenvVariable>
  ): string {
    const validationSteps: string[] = []

    validationSteps.push('const issues: StandardSchemaV1.Issue[] = []')
    validationSteps.push('const result: Partial<any> = {}')
    validationSteps.push('')
    validationSteps.push('// Type check: ensure input is an object')
    validationSteps.push(
      'if (typeof value !== "object" || value === null || Array.isArray(value)) {'
    )
    validationSteps.push(
      '  return { issues: [{ message: "Expected an object" }] }'
    )
    validationSteps.push('}')
    validationSteps.push('')
    validationSteps.push('const input = value as Record<string, unknown>')
    validationSteps.push('')

    Object.entries(variables).forEach(([key, variable]) => {
      validationSteps.push(`// Validate ${key}`)
      validationSteps.push(`{`)
      validationSteps.push(`  const fieldValue = input.${key}`)

      if (variable.required) {
        validationSteps.push(`  if (fieldValue === undefined) {`)
        validationSteps.push(
          `    issues.push({ message: "Required field '${key}' is missing", path: ['${key}'] })`
        )
        validationSteps.push(`  } else {`)
        validationSteps.push(
          `    ${this.generateFieldValidation(key, variable)}`
        )
        validationSteps.push(`  }`)
      } else {
        validationSteps.push(`  if (fieldValue !== undefined) {`)
        validationSteps.push(
          `    ${this.generateFieldValidation(key, variable)}`
        )
        validationSteps.push(
          `  }${variable.default !== undefined ? ` else {\n    result.${key} = ${JSON.stringify(variable.default)}\n  }` : ''}`
        )
      }

      validationSteps.push(`}`)
      validationSteps.push('')
    })

    validationSteps.push('if (issues.length > 0) {')
    validationSteps.push('  return { issues }')
    validationSteps.push('}')
    validationSteps.push('')
    validationSteps.push('return { value: result as any }')

    return validationSteps.join('\n        ')
  }

  private generateFieldValidation(
    key: string,
    variable: SafenvVariable
  ): string {
    const validationSteps: string[] = []

    switch (variable.type) {
      case 'string':
        validationSteps.push(`if (typeof fieldValue !== 'string') {`)
        validationSteps.push(
          `  issues.push({ message: "Field '${key}' must be a string", path: ['${key}'] })`
        )
        validationSteps.push(`} else {`)
        if (variable.validate) {
          validationSteps.push(`  // Custom validation would go here`)
        }
        validationSteps.push(`  result.${key} = fieldValue`)
        validationSteps.push(`}`)
        break

      case 'number':
        validationSteps.push(
          `const numValue = typeof fieldValue === 'string' ? Number(fieldValue) : fieldValue`
        )
        validationSteps.push(
          `if (typeof numValue !== 'number' || isNaN(numValue)) {`
        )
        validationSteps.push(
          `  issues.push({ message: "Field '${key}' must be a number", path: ['${key}'] })`
        )
        validationSteps.push(`} else {`)
        validationSteps.push(`  result.${key} = numValue`)
        validationSteps.push(`}`)
        break

      case 'boolean':
        validationSteps.push(`let boolValue: boolean`)
        validationSteps.push(`if (typeof fieldValue === 'boolean') {`)
        validationSteps.push(`  boolValue = fieldValue`)
        validationSteps.push(`} else if (typeof fieldValue === 'string') {`)
        validationSteps.push(
          `  boolValue = fieldValue.toLowerCase() === 'true' || fieldValue === '1'`
        )
        validationSteps.push(`} else {`)
        validationSteps.push(
          `  issues.push({ message: "Field '${key}' must be a boolean", path: ['${key}'] })`
        )
        validationSteps.push(`  return { issues }`)
        validationSteps.push(`}`)
        validationSteps.push(`result.${key} = boolValue`)
        break

      case 'array':
        validationSteps.push(`let arrayValue: string[]`)
        validationSteps.push(`if (Array.isArray(fieldValue)) {`)
        validationSteps.push(`  arrayValue = fieldValue.map(String)`)
        validationSteps.push(`} else if (typeof fieldValue === 'string') {`)
        validationSteps.push(
          `  arrayValue = fieldValue.split(',').map(s => s.trim())`
        )
        validationSteps.push(`} else {`)
        validationSteps.push(
          `  issues.push({ message: "Field '${key}' must be an array or comma-separated string", path: ['${key}'] })`
        )
        validationSteps.push(`  return { issues }`)
        validationSteps.push(`}`)
        validationSteps.push(`result.${key} = arrayValue`)
        break

      case 'object':
        validationSteps.push(`let objValue: any`)
        validationSteps.push(
          `if (typeof fieldValue === 'object' && fieldValue !== null && !Array.isArray(fieldValue)) {`
        )
        validationSteps.push(`  objValue = fieldValue`)
        validationSteps.push(`} else if (typeof fieldValue === 'string') {`)
        validationSteps.push(`  try {`)
        validationSteps.push(`    objValue = JSON.parse(fieldValue)`)
        validationSteps.push(`  } catch {`)
        validationSteps.push(
          `    issues.push({ message: "Field '${key}' must be valid JSON", path: ['${key}'] })`
        )
        validationSteps.push(`    return { issues }`)
        validationSteps.push(`  }`)
        validationSteps.push(`} else {`)
        validationSteps.push(
          `  issues.push({ message: "Field '${key}' must be an object", path: ['${key}'] })`
        )
        validationSteps.push(`  return { issues }`)
        validationSteps.push(`}`)
        validationSteps.push(`result.${key} = objValue`)
        break

      default:
        validationSteps.push(`result.${key} = String(fieldValue)`)
    }

    return validationSteps.join('\n      ')
  }

  private getTypeScriptType(variable: SafenvVariable): string {
    switch (variable.type) {
      case 'string':
        return 'string'
      case 'number':
        return 'number'
      case 'boolean':
        return 'boolean'
      case 'array':
        return 'string[]'
      case 'object':
        return 'Record<string, any>'
      default:
        return 'string'
    }
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  }

  private generateExport(context: SafenvContext): string {
    const exportName = this.options.exportName || 'config'
    const configName = context.config.name
    const pascalCaseName = this.toPascalCase(configName)
    const schemaFunctionName =
      this.options.validatorName || `create${pascalCaseName}Schema`

    switch (this.options.exportMode) {
      case 'process.env':
        return this.generateProcessEnvExport(exportName, schemaFunctionName)

      case 'process.env-static':
        return this.generateStaticExport(
          context,
          exportName,
          schemaFunctionName
        )

      case 'env-file':
        return this.generateEnvFileExport(
          context,
          exportName,
          schemaFunctionName
        )

      case 'json-file':
      case 'yaml-file':
      case 'toml-file':
        return this.generateFileExport(context, exportName, schemaFunctionName)

      default:
        return this.generateProcessEnvExport(exportName, schemaFunctionName)
    }
  }

  private generateProcessEnvExport(
    exportName: string,
    schemaFunctionName: string
  ): string {
    return `/** Validated configuration from process.env */
export const ${exportName} = (() => {
  const schema = ${schemaFunctionName}()
  const result = schema['~standard'].validate(process.env)
  
  if (result.issues) {
    const errorMessage = result.issues.map((issue: StandardSchemaV1.Issue) => 
      issue.path ? \`\${issue.path.join('.')}: \${issue.message}\` : issue.message
    ).join('\\n')
    throw new Error(\`Configuration validation failed:\\n\${errorMessage}\`)
  }
  
  return result.value
})()`
  }

  private generateStaticExport(
    context: SafenvContext,
    exportName: string,
    schemaFunctionName: string
  ): string {
    const staticExports = Object.keys(context.config.variables).map(key => {
      const constName = `${exportName.toUpperCase()}_${key}`
      return `/** @__PURE__ */ export const ${constName} = (() => {
  const schema = ${schemaFunctionName}()
  const result = schema['~standard'].validate({ ${key}: process.env.${key} })
  return result.issues ? undefined : result.value?.${key}
})()`
    })

    return staticExports.join('\n\n')
  }

  private generateEnvFileExport(
    context: SafenvContext,
    exportName: string,
    schemaFunctionName: string
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

/** Validated configuration from .env file */
export const ${exportName} = (() => {
  const schema = ${schemaFunctionName}()
  const result = schema['~standard'].validate(process.env)
  
  if (result.issues) {
    const errorMessage = result.issues.map((issue: StandardSchemaV1.Issue) => 
      issue.path ? \`\${issue.path.join('.')}: \${issue.message}\` : issue.message
    ).join('\\n')
    throw new Error(\`Configuration validation failed:\\n\${errorMessage}\`)
  }
  
  return result.value
})()`
  }

  private generateFileExport(
    context: SafenvContext,
    exportName: string,
    schemaFunctionName: string
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

/** Validated configuration from ${extension.toUpperCase()} file */
export const ${exportName} = (() => {
  const schema = ${schemaFunctionName}()
  const result = schema['~standard'].validate(config)
  
  if (result.issues) {
    const errorMessage = result.issues.map((issue: StandardSchemaV1.Issue) => 
      issue.path ? \`\${issue.path.join('.')}: \${issue.message}\` : issue.message
    ).join('\\n')
    throw new Error(\`Configuration validation failed:\\n\${errorMessage}\`)
  }
  
  return result.value
})()`
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
}
