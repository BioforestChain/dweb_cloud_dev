/** Standard Schema interface for TypeScript schema validation libraries */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown
    ) => Result<Output> | Promise<Result<Output>>
    readonly types?: Types<Input, Output> | undefined
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult

  export interface SuccessResult<Output> {
    readonly value: Output
    readonly issues?: undefined
  }

  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>
  }

  export interface Issue {
    readonly message: string
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined
  }

  export interface PathSegment {
    readonly key: PropertyKey
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input
    readonly output: Output
  }

  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['input']

  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['output']
}

/** Configuration interface for standard-schema-demo */
export interface StandardSchemaDemoConfig {
  /** Application name */
  APP_NAME?: string
  /** Server port */
  PORT?: number
  /** Database connection URL */
  DATABASE_URL: string
  /** Enabled feature flags */
  FEATURE_FLAGS?: string[]
  /** Enable debug mode */
  DEBUG?: boolean
  /** API configuration object */
  API_CONFIG?: Record<string, any>
}

/** Standard Schema for standard-schema-demo configuration */
export interface StandardSchemaDemoSchema
  extends StandardSchemaV1<StandardSchemaDemoConfig> {
  readonly name: 'standard-schema-demo'
}

/** Creates a Standard Schema validator for standard-schema-demo configuration */
export function createStandardSchemaDemoSchema(): StandardSchemaDemoSchema {
  return {
    name: 'standard-schema-demo',
    '~standard': {
      version: 1,
      vendor: 'safenv',
      validate(
        value: unknown
      ): StandardSchemaV1.Result<StandardSchemaDemoConfig> {
        const issues: StandardSchemaV1.Issue[] = []
        const result: Partial<any> = {}

        // Type check: ensure input is an object
        if (
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)
        ) {
          return { issues: [{ message: 'Expected an object' }] }
        }

        const input = value as Record<string, unknown>

        // Validate APP_NAME
        {
          const fieldValue = input.APP_NAME
          if (fieldValue !== undefined) {
            if (typeof fieldValue !== 'string') {
              issues.push({
                message: "Field 'APP_NAME' must be a string",
                path: ['APP_NAME'],
              })
            } else {
              result.APP_NAME = fieldValue
            }
          } else {
            result.APP_NAME = 'My App'
          }
        }

        // Validate PORT
        {
          const fieldValue = input.PORT
          if (fieldValue !== undefined) {
            const numValue =
              typeof fieldValue === 'string' ? Number(fieldValue) : fieldValue
            if (typeof numValue !== 'number' || isNaN(numValue)) {
              issues.push({
                message: "Field 'PORT' must be a number",
                path: ['PORT'],
              })
            } else {
              result.PORT = numValue
            }
          } else {
            result.PORT = 3000
          }
        }

        // Validate DATABASE_URL
        {
          const fieldValue = input.DATABASE_URL
          if (fieldValue === undefined) {
            issues.push({
              message: "Required field 'DATABASE_URL' is missing",
              path: ['DATABASE_URL'],
            })
          } else {
            if (typeof fieldValue !== 'string') {
              issues.push({
                message: "Field 'DATABASE_URL' must be a string",
                path: ['DATABASE_URL'],
              })
            } else {
              result.DATABASE_URL = fieldValue
            }
          }
        }

        // Validate FEATURE_FLAGS
        {
          const fieldValue = input.FEATURE_FLAGS
          if (fieldValue !== undefined) {
            let arrayValue: string[]
            if (Array.isArray(fieldValue)) {
              arrayValue = fieldValue.map(String)
            } else if (typeof fieldValue === 'string') {
              arrayValue = fieldValue.split(',').map(s => s.trim())
            } else {
              issues.push({
                message:
                  "Field 'FEATURE_FLAGS' must be an array or comma-separated string",
                path: ['FEATURE_FLAGS'],
              })
              return { issues }
            }
            result.FEATURE_FLAGS = arrayValue
          } else {
            result.FEATURE_FLAGS = []
          }
        }

        // Validate DEBUG
        {
          const fieldValue = input.DEBUG
          if (fieldValue !== undefined) {
            let boolValue: boolean
            if (typeof fieldValue === 'boolean') {
              boolValue = fieldValue
            } else if (typeof fieldValue === 'string') {
              boolValue =
                fieldValue.toLowerCase() === 'true' || fieldValue === '1'
            } else {
              issues.push({
                message: "Field 'DEBUG' must be a boolean",
                path: ['DEBUG'],
              })
              return { issues }
            }
            result.DEBUG = boolValue
          } else {
            result.DEBUG = false
          }
        }

        // Validate API_CONFIG
        {
          const fieldValue = input.API_CONFIG
          if (fieldValue !== undefined) {
            let objValue: any
            if (
              typeof fieldValue === 'object' &&
              fieldValue !== null &&
              !Array.isArray(fieldValue)
            ) {
              objValue = fieldValue
            } else if (typeof fieldValue === 'string') {
              try {
                objValue = JSON.parse(fieldValue)
              } catch {
                issues.push({
                  message: "Field 'API_CONFIG' must be valid JSON",
                  path: ['API_CONFIG'],
                })
                return { issues }
              }
            } else {
              issues.push({
                message: "Field 'API_CONFIG' must be an object",
                path: ['API_CONFIG'],
              })
              return { issues }
            }
            result.API_CONFIG = objValue
          } else {
            result.API_CONFIG = { timeout: 5000 }
          }
        }

        if (issues.length > 0) {
          return { issues }
        }

        return { value: result as any }
      },
      types: {} as StandardSchemaV1.Types<
        StandardSchemaDemoConfig,
        StandardSchemaDemoConfig
      >,
    },
  }
}

/** Validated configuration from process.env */
export const config = (() => {
  const schema = createStandardSchemaDemoSchema()
  const result = schema['~standard'].validate(process.env)

  if (result.issues) {
    const errorMessage = result.issues
      .map((issue: StandardSchemaV1.Issue) =>
        issue.path ? `${issue.path.join('.')}: ${issue.message}` : issue.message
      )
      .join('\n')
    throw new Error(`Configuration validation failed:\n${errorMessage}`)
  }

  return result.value
})()
