import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { GenTsPluginOptions } from './types.ts'
import type { SafenvContext, SafenvVariable, SafenvPlugin } from '../types.ts'

/**
 * Generate TypeScript validation code with Standard Schema support
 * @param options Plugin configuration options
 * @returns SafenvPlugin instance
 */
export function genTsPlugin(options: GenTsPluginOptions): SafenvPlugin {
  return {
    name: 'genTsPlugin',

    async afterGenerate(context: SafenvContext): Promise<void> {
      const content = generateStandardSchemaContent(context, options)
      writeFile(options.outputPath, content)
      console.log(
        `genTsPlugin: Generated TypeScript file at ${options.outputPath}`
      )
    },

    async cleanup(): Promise<void> {
      // Cleanup logic if needed
    },
  }
}

// Helper function to ensure directory exists and write file
function writeFile(filePath: string, content: string): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(filePath, content, 'utf8')
}

function generateStandardSchemaContent(
  context: SafenvContext,
  options: GenTsPluginOptions
): string {
  const parts: string[] = []

  // Add Standard Schema interface import
  parts.push(generateStandardSchemaImport())

  // Generate the schema type definition
  parts.push(generateSchemaTypeDefinition(context))

  // Generate the main validation function
  parts.push(generateValidationFunction(context, options))

  // Generate export based on export mode
  if (options.exportMode) {
    parts.push(generateExport(context, options))
  }

  return parts.join('\n\n')
}

function generateStandardSchemaImport(): string {
  return `// Standard Schema interface for validation
export namespace StandardSchemaV1 {
  export interface Result<T> {
    value?: T
    issues?: Issue[]
  }
  
  export interface Issue {
    message: string
    path?: (string | number)[]
  }
}`
}

function generateSchemaTypeDefinition(context: SafenvContext): string {
  const configName = context.config.name
  const pascalCaseName = toPascalCase(configName || 'Config')

  const interfaceFields: string[] = []
  Object.entries(context.config.variables).forEach(([key, variable]) => {
    const optional = !variable.required ? '?' : ''
    const tsType = getTypeScriptType(variable)
    interfaceFields.push(`  ${key}${optional}: ${tsType}`)
  })

  return `// TypeScript interface for ${configName} configuration
export interface ${pascalCaseName}Config {
${interfaceFields.join('\n')}
}

// Standard Schema type definition
export interface ${pascalCaseName}Schema {
  name: string
  '~standard': {
    version: 1
    vendor: 'safenv'
    validate(value: unknown): StandardSchemaV1.Result<${pascalCaseName}Config>
    types?: any
  }
}`
}

function generateValidationFunction(
  context: SafenvContext,
  options: GenTsPluginOptions
): string {
  const configName = context.config.name
  const pascalCaseName = toPascalCase(configName || 'Config')
  const functionName = options.validatorName || `create${pascalCaseName}Schema`

  const validationLogic = generateValidationLogic(context.config.variables)

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
      types: undefined as any // Standard Schema types are optional
    }
  }
}`
}

function generateValidationLogic(
  variables: Record<string, SafenvVariable>
): string {
  const validationSteps: string[] = []

  validationSteps.push('const issues: StandardSchemaV1.Issue[] = []')
  validationSteps.push('const result: Record<string, any> = {}')
  validationSteps.push('')
  validationSteps.push('// Type check: ensure input is an object')
  validationSteps.push(
    'if (typeof value !== "object" || value === null || Array.isArray(value)) {'
  )
  validationSteps.push(
    '  return { issues: [{ message: "Expected an object, got " + typeof value }] }'
  )
  validationSteps.push('}')
  validationSteps.push('')
  validationSteps.push('const input = value as Record<string, unknown>')
  validationSteps.push('')

  Object.entries(variables).forEach(([key, variable]) => {
    validationSteps.push(`// Validate field: ${key}`)
    validationSteps.push(`{`)
    validationSteps.push(`  const fieldValue = input[${JSON.stringify(key)}]`)

    if (variable.required) {
      validationSteps.push(
        `  if (fieldValue === undefined || fieldValue === null) {`
      )
      validationSteps.push(
        `    issues.push({ message: "Required field '${key}' is missing or null", path: [${JSON.stringify(key)}] })`
      )
      validationSteps.push(`  } else {`)
      validationSteps.push(`    ${generateFieldValidation(key, variable)}`)
      validationSteps.push(`  }`)
    } else {
      validationSteps.push(
        `  if (fieldValue !== undefined && fieldValue !== null) {`
      )
      validationSteps.push(`    ${generateFieldValidation(key, variable)}`)
      if (variable.default !== undefined) {
        validationSteps.push(`  } else {`)
        validationSteps.push(
          `    result[${JSON.stringify(key)}] = ${JSON.stringify(variable.default)}`
        )
      }
      validationSteps.push(`  }`)
    }

    validationSteps.push(`}`)
    validationSteps.push('')
  })

  validationSteps.push('if (issues.length > 0) {')
  validationSteps.push('  return { issues }')
  validationSteps.push('}')
  validationSteps.push('')
  validationSteps.push('return { value: result }')

  return validationSteps.join('\n        ')
}

function generateFieldValidation(
  key: string,
  variable: SafenvVariable
): string {
  const validationSteps: string[] = []
  const keyJson = JSON.stringify(key)

  switch (variable.type) {
    case 'string':
      validationSteps.push(`if (typeof fieldValue !== 'string') {`)
      validationSteps.push(
        `  issues.push({ message: "Field '${key}' must be a string, got " + typeof fieldValue, path: [${keyJson}] })`
      )
      validationSteps.push(`} else {`)

      // Add custom validation if present
      if (variable.validate) {
        validationSteps.push(`  // Custom validation`)
        validationSteps.push(`  try {`)
        validationSteps.push(
          `    const validationResult = (${variable.validate.toString()})(fieldValue)`
        )
        validationSteps.push(`    if (validationResult !== true) {`)
        validationSteps.push(
          `      const errorMsg = typeof validationResult === 'string' ? validationResult : "Custom validation failed"`
        )
        validationSteps.push(
          `      issues.push({ message: "Field '${key}': " + errorMsg, path: [${keyJson}] })`
        )
        validationSteps.push(`    } else {`)
        validationSteps.push(`      result[${keyJson}] = fieldValue`)
        validationSteps.push(`    }`)
        validationSteps.push(`  } catch (err) {`)
        validationSteps.push(
          `    issues.push({ message: "Field '${key}': Validation error - " + (err instanceof Error ? err.message : String(err)), path: [${keyJson}] })`
        )
        validationSteps.push(`  }`)
      } else {
        validationSteps.push(`  result[${keyJson}] = fieldValue`)
      }

      validationSteps.push(`}`)
      break

    case 'number':
      validationSteps.push(`if (typeof fieldValue !== 'number') {`)
      validationSteps.push(
        `  issues.push({ message: "Field '${key}' must be a number, got " + typeof fieldValue, path: [${keyJson}] })`
      )
      validationSteps.push(`} else {`)

      if (variable.validate) {
        validationSteps.push(`  // Custom validation`)
        validationSteps.push(`  try {`)
        validationSteps.push(
          `    const validationResult = (${variable.validate.toString()})(fieldValue)`
        )
        validationSteps.push(`    if (validationResult !== true) {`)
        validationSteps.push(
          `      const errorMsg = typeof validationResult === 'string' ? validationResult : "Custom validation failed"`
        )
        validationSteps.push(
          `      issues.push({ message: "Field '${key}': " + errorMsg, path: [${keyJson}] })`
        )
        validationSteps.push(`    } else {`)
        validationSteps.push(`      result[${keyJson}] = fieldValue`)
        validationSteps.push(`    }`)
        validationSteps.push(`  } catch (err) {`)
        validationSteps.push(
          `    issues.push({ message: "Field '${key}': Validation error - " + (err instanceof Error ? err.message : String(err)), path: [${keyJson}] })`
        )
        validationSteps.push(`  }`)
      } else {
        validationSteps.push(`  result[${keyJson}] = fieldValue`)
      }

      validationSteps.push(`}`)
      break

    case 'boolean':
      validationSteps.push(`if (typeof fieldValue !== 'boolean') {`)
      validationSteps.push(
        `  issues.push({ message: "Field '${key}' must be a boolean, got " + typeof fieldValue, path: [${keyJson}] })`
      )
      validationSteps.push(`} else {`)

      if (variable.validate) {
        validationSteps.push(`  // Custom validation`)
        validationSteps.push(`  try {`)
        validationSteps.push(
          `    const validationResult = (${variable.validate.toString()})(fieldValue)`
        )
        validationSteps.push(`    if (validationResult !== true) {`)
        validationSteps.push(
          `      const errorMsg = typeof validationResult === 'string' ? validationResult : "Custom validation failed"`
        )
        validationSteps.push(
          `      issues.push({ message: "Field '${key}': " + errorMsg, path: [${keyJson}] })`
        )
        validationSteps.push(`    } else {`)
        validationSteps.push(`      result[${keyJson}] = fieldValue`)
        validationSteps.push(`    }`)
        validationSteps.push(`  } catch (err) {`)
        validationSteps.push(
          `    issues.push({ message: "Field '${key}': Validation error - " + (err instanceof Error ? err.message : String(err)), path: [${keyJson}] })`
        )
        validationSteps.push(`  }`)
      } else {
        validationSteps.push(`  result[${keyJson}] = fieldValue`)
      }

      validationSteps.push(`}`)
      break

    case 'array':
      validationSteps.push(`if (!Array.isArray(fieldValue)) {`)
      validationSteps.push(
        `  issues.push({ message: "Field '${key}' must be an array, got " + typeof fieldValue, path: [${keyJson}] })`
      )
      validationSteps.push(`} else {`)

      if (variable.validate) {
        validationSteps.push(`  // Custom validation`)
        validationSteps.push(`  try {`)
        validationSteps.push(
          `    const validationResult = (${variable.validate.toString()})(fieldValue)`
        )
        validationSteps.push(`    if (validationResult !== true) {`)
        validationSteps.push(
          `      const errorMsg = typeof validationResult === 'string' ? validationResult : "Custom validation failed"`
        )
        validationSteps.push(
          `      issues.push({ message: "Field '${key}': " + errorMsg, path: [${keyJson}] })`
        )
        validationSteps.push(`    } else {`)
        validationSteps.push(`      result[${keyJson}] = fieldValue`)
        validationSteps.push(`    }`)
        validationSteps.push(`  } catch (err) {`)
        validationSteps.push(
          `    issues.push({ message: "Field '${key}': Validation error - " + (err instanceof Error ? err.message : String(err)), path: [${keyJson}] })`
        )
        validationSteps.push(`  }`)
      } else {
        validationSteps.push(`  result[${keyJson}] = fieldValue`)
      }

      validationSteps.push(`}`)
      break

    case 'object':
      validationSteps.push(
        `if (typeof fieldValue !== 'object' || fieldValue === null || Array.isArray(fieldValue)) {`
      )
      validationSteps.push(
        `  issues.push({ message: "Field '${key}' must be an object, got " + typeof fieldValue, path: [${keyJson}] })`
      )
      validationSteps.push(`} else {`)

      if (variable.validate) {
        validationSteps.push(`  // Custom validation`)
        validationSteps.push(`  try {`)
        validationSteps.push(
          `    const validationResult = (${variable.validate.toString()})(fieldValue)`
        )
        validationSteps.push(`    if (validationResult !== true) {`)
        validationSteps.push(
          `      const errorMsg = typeof validationResult === 'string' ? validationResult : "Custom validation failed"`
        )
        validationSteps.push(
          `      issues.push({ message: "Field '${key}': " + errorMsg, path: [${keyJson}] })`
        )
        validationSteps.push(`    } else {`)
        validationSteps.push(`      result[${keyJson}] = fieldValue`)
        validationSteps.push(`    }`)
        validationSteps.push(`  } catch (err) {`)
        validationSteps.push(
          `    issues.push({ message: "Field '${key}': Validation error - " + (err instanceof Error ? err.message : String(err)), path: [${keyJson}] })`
        )
        validationSteps.push(`  }`)
      } else {
        validationSteps.push(`  result[${keyJson}] = fieldValue`)
      }

      validationSteps.push(`}`)
      break

    default:
      validationSteps.push(`result[${keyJson}] = fieldValue`)
      break
  }

  return validationSteps.join('\n    ')
}

function getTypeScriptType(variable: SafenvVariable): string {
  switch (variable.type) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      // For arrays, try to infer element type from default value or use string[] as default
      if (
        variable.default &&
        Array.isArray(variable.default) &&
        variable.default.length > 0
      ) {
        const firstElement = variable.default[0]
        const elementType = typeof firstElement
        if (
          elementType === 'string' ||
          elementType === 'number' ||
          elementType === 'boolean'
        ) {
          return `${elementType}[]`
        }
      }
      return 'string[]' // Default to string[] for arrays
    case 'object':
      return 'Record<string, any>'
    default:
      return 'unknown'
  }
}

function toPascalCase(str: string): string {
  return str.replace(/(?:^|[-_])(\w)/g, (_, char) => char.toUpperCase())
}

function generateExport(
  context: SafenvContext,
  options: GenTsPluginOptions
): string {
  const exportMode = options.exportMode
  const configName = context.config.name
  const pascalCaseName = toPascalCase(configName || 'Config')
  const functionName = options.validatorName || `create${pascalCaseName}Schema`

  switch (exportMode) {
    case 'process.env':
      return generateProcessEnvExport(
        options.exportName || configName || 'Config',
        functionName
      )
    case 'process.env-static':
      return generateStaticExport(
        context,
        options.exportName || configName || 'Config',
        functionName
      )
    case 'env-file':
      return generateEnvFileExport(
        context,
        options.exportName || configName || 'Config',
        functionName,
        options
      )
    default:
      return ''
  }
}

function generateProcessEnvExport(
  exportName: string,
  schemaFunctionName: string
): string {
  return `// Export validated environment variables from process.env
const schema = ${schemaFunctionName}()
const validationResult = schema['~standard'].validate(process.env)

if (validationResult.issues && validationResult.issues.length > 0) {
  const errorMessages = validationResult.issues.map(issue => 
    issue.path ? \`\${issue.path.join('.')}: \${issue.message}\` : issue.message
  )
  throw new Error('Environment validation failed:\\n' + errorMessages.join('\\n'))
}

export const ${exportName} = validationResult.value!`
}

function generateStaticExport(
  context: SafenvContext,
  exportName: string,
  schemaFunctionName: string
): string {
  const exports: string[] = []

  // Generate individual exports for each variable
  Object.entries(context.resolvedVariables).forEach(([key, value]) => {
    const exportedName = `${exportName}_${key}`
    const serializedValue = JSON.stringify(value)
    exports.push(
      `export const ${exportedName} = ${serializedValue} /* @__PURE__ */`
    )
  })

  // Also export the schema for runtime validation
  const schemaExport = `export const ${schemaFunctionName.replace('create', '')}Schema = ${schemaFunctionName}()`

  return `// Export static configuration values
${exports.join('\n')}

// Schema export
${schemaExport}`
}

function generateEnvFileExport(
  context: SafenvContext,
  exportName: string,
  schemaFunctionName: string,
  _options: GenTsPluginOptions
): string {
  const configName = context.config.name
  const envFileName = `${configName}.safenv.env`

  return `// Export validated environment variables from file
// Load environment file using Node.js built-in process.loadEnvFile
process.loadEnvFile('${envFileName}')

const envData = process.env
const schema = ${schemaFunctionName}()
const validationResult = schema['~standard'].validate(envData)

if (validationResult.issues && validationResult.issues.length > 0) {
  const errorMessages = validationResult.issues.map((issue: any) => 
    issue.path ? \`\${issue.path.join('.')}: \${issue.message}\` : issue.message
  )
  throw new Error('Environment file validation failed:\\n' + errorMessages.join('\\n'))
}

export const ${exportName} = validationResult.value!`
}

function getDefaultDeps(extension: string): string[] {
  switch (extension) {
    case '.env':
      return ["{ config } from 'dotenv'"]
    case '.json':
      return ["{ readFileSync } from 'fs'"]
    case '.yaml':
    case '.yml':
      return ["{ readFileSync } from 'fs'", "yaml from 'js-yaml'"]
    case '.toml':
      return ["{ readFileSync } from 'fs'", "TOML from '@iarna/toml'"]
    default:
      return []
  }
}

function getDefaultInjectCode(extension: string): string {
  switch (extension) {
    case '.env':
      return 'config()'
    case '.json':
    case '.yaml':
    case '.yml':
    case '.toml':
      return `const configPath = process.env.CONFIG_PATH || '${extension}'`
    default:
      return ''
  }
}

function getParseFunction(extension: string): string {
  switch (extension) {
    case '.env':
      return 'process.env'
    case '.json':
      return 'JSON.parse(readFileSync(configPath, "utf8"))'
    case '.yaml':
    case '.yml':
      return 'yaml.load(readFileSync(configPath, "utf8"))'
    case '.toml':
      return 'TOML.parse(readFileSync(configPath, "utf8"))'
    default:
      return 'process.env'
  }
}
