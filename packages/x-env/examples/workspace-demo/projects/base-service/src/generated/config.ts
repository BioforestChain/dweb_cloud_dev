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

/** Configuration interface for base-service */
export interface BaseServiceConfig {
  /** Database host address */
  DB_HOST: string
  /** Database port number */
  DB_PORT: number
  /** Database name */
  DB_NAME: string
  /** Database username */
  DB_USER: string
  /** Database password */
  DB_PASSWORD: string
  /** Redis connection URL */
  REDIS_URL?: string
  /** Redis default TTL in seconds */
  REDIS_TTL?: number
  /** Service HTTP port */
  SERVICE_PORT?: number
  /** Logging level */
  LOG_LEVEL?: string
}

/** Standard Schema for base-service configuration */
export interface BaseServiceSchema extends StandardSchemaV1<BaseServiceConfig> {
  readonly name: 'base-service'
}

/** Creates a Standard Schema validator for base-service configuration */
export function createBaseServiceSchema(): BaseServiceSchema {
  return {
    name: 'base-service',
    '~standard': {
      version: 1,
      vendor: 'safenv',
      validate(value: unknown): StandardSchemaV1.Result<BaseServiceConfig> {
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

        // Validate DB_HOST
        {
          const fieldValue = input.DB_HOST
          if (fieldValue === undefined) {
            issues.push({
              message: "Required field 'DB_HOST' is missing",
              path: ['DB_HOST'],
            })
          } else {
            if (typeof fieldValue !== 'string') {
              issues.push({
                message: "Field 'DB_HOST' must be a string",
                path: ['DB_HOST'],
              })
            } else {
              result.DB_HOST = fieldValue
            }
          }
        }

        // Validate DB_PORT
        {
          const fieldValue = input.DB_PORT
          if (fieldValue === undefined) {
            issues.push({
              message: "Required field 'DB_PORT' is missing",
              path: ['DB_PORT'],
            })
          } else {
            const numValue =
              typeof fieldValue === 'string' ? Number(fieldValue) : fieldValue
            if (typeof numValue !== 'number' || isNaN(numValue)) {
              issues.push({
                message: "Field 'DB_PORT' must be a number",
                path: ['DB_PORT'],
              })
            } else {
              result.DB_PORT = numValue
            }
          }
        }

        // Validate DB_NAME
        {
          const fieldValue = input.DB_NAME
          if (fieldValue === undefined) {
            issues.push({
              message: "Required field 'DB_NAME' is missing",
              path: ['DB_NAME'],
            })
          } else {
            if (typeof fieldValue !== 'string') {
              issues.push({
                message: "Field 'DB_NAME' must be a string",
                path: ['DB_NAME'],
              })
            } else {
              result.DB_NAME = fieldValue
            }
          }
        }

        // Validate DB_USER
        {
          const fieldValue = input.DB_USER
          if (fieldValue === undefined) {
            issues.push({
              message: "Required field 'DB_USER' is missing",
              path: ['DB_USER'],
            })
          } else {
            if (typeof fieldValue !== 'string') {
              issues.push({
                message: "Field 'DB_USER' must be a string",
                path: ['DB_USER'],
              })
            } else {
              result.DB_USER = fieldValue
            }
          }
        }

        // Validate DB_PASSWORD
        {
          const fieldValue = input.DB_PASSWORD
          if (fieldValue === undefined) {
            issues.push({
              message: "Required field 'DB_PASSWORD' is missing",
              path: ['DB_PASSWORD'],
            })
          } else {
            if (typeof fieldValue !== 'string') {
              issues.push({
                message: "Field 'DB_PASSWORD' must be a string",
                path: ['DB_PASSWORD'],
              })
            } else {
              result.DB_PASSWORD = fieldValue
            }
          }
        }

        // Validate REDIS_URL
        {
          const fieldValue = input.REDIS_URL
          if (fieldValue !== undefined) {
            if (typeof fieldValue !== 'string') {
              issues.push({
                message: "Field 'REDIS_URL' must be a string",
                path: ['REDIS_URL'],
              })
            } else {
              result.REDIS_URL = fieldValue
            }
          } else {
            result.REDIS_URL = 'redis://localhost:6379'
          }
        }

        // Validate REDIS_TTL
        {
          const fieldValue = input.REDIS_TTL
          if (fieldValue !== undefined) {
            const numValue =
              typeof fieldValue === 'string' ? Number(fieldValue) : fieldValue
            if (typeof numValue !== 'number' || isNaN(numValue)) {
              issues.push({
                message: "Field 'REDIS_TTL' must be a number",
                path: ['REDIS_TTL'],
              })
            } else {
              result.REDIS_TTL = numValue
            }
          } else {
            result.REDIS_TTL = 3600
          }
        }

        // Validate SERVICE_PORT
        {
          const fieldValue = input.SERVICE_PORT
          if (fieldValue !== undefined) {
            const numValue =
              typeof fieldValue === 'string' ? Number(fieldValue) : fieldValue
            if (typeof numValue !== 'number' || isNaN(numValue)) {
              issues.push({
                message: "Field 'SERVICE_PORT' must be a number",
                path: ['SERVICE_PORT'],
              })
            } else {
              result.SERVICE_PORT = numValue
            }
          } else {
            result.SERVICE_PORT = 3000
          }
        }

        // Validate LOG_LEVEL
        {
          const fieldValue = input.LOG_LEVEL
          if (fieldValue !== undefined) {
            if (typeof fieldValue !== 'string') {
              issues.push({
                message: "Field 'LOG_LEVEL' must be a string",
                path: ['LOG_LEVEL'],
              })
            } else {
              // Custom validation would go here
              result.LOG_LEVEL = fieldValue
            }
          } else {
            result.LOG_LEVEL = 'info'
          }
        }

        if (issues.length > 0) {
          return { issues }
        }

        return { value: result as any }
      },
      types: {} as StandardSchemaV1.Types<BaseServiceConfig, BaseServiceConfig>,
    },
  }
}
