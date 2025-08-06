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

/** Configuration interface for web-app */
export interface WebAppConfigType {
  /** Web application port */
  APP_PORT: number
  /** Application name */
  APP_NAME: string
  /** Base service API URL */
  API_BASE_URL: string
  /** API request timeout in milliseconds */
  API_TIMEOUT: number
  /** Enable authentication */
  ENABLE_AUTH: boolean
  /** Enable analytics tracking */
  ENABLE_ANALYTICS: boolean
  /** Static files path */
  STATIC_PATH: string
  /** Maximum upload size in bytes */
  MAX_UPLOAD_SIZE: number
}

/** Standard Schema for web-app configuration */
export interface WebAppSchema extends StandardSchemaV1<WebAppConfigType> {
  readonly name: 'web-app'
}

/** Creates a Standard Schema validator for web-app configuration */
export function createWebAppSchema(): WebAppSchema {
  return {
    name: 'web-app',
    '~standard': {
      version: 1,
      vendor: 'safenv',
      validate(value: unknown): StandardSchemaV1.Result<WebAppConfigType> {
        const issues: StandardSchemaV1.Issue[] = []
        const result: Partial<WebAppConfigType> = {}

        // Type check: ensure input is an object
        if (
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)
        ) {
          return { issues: [{ message: 'Expected an object' }] }
        }

        const input = value as Record<string, unknown>

        // Validate APP_PORT
        {
          const fieldValue = input.APP_PORT
          if (fieldValue !== undefined) {
            const numValue =
              typeof fieldValue === 'string' ? Number(fieldValue) : fieldValue
            if (typeof numValue !== 'number' || isNaN(numValue)) {
              issues.push({
                message: "Field 'APP_PORT' must be a number",
                path: ['APP_PORT'],
              })
            } else if (
              numValue < 1000 ||
              numValue > 65535 ||
              !Number.isInteger(numValue)
            ) {
              issues.push({
                message:
                  "Field 'APP_PORT' must be an integer between 1000 and 65535",
                path: ['APP_PORT'],
              })
            } else {
              result.APP_PORT = numValue
            }
          } else {
            result.APP_PORT = 3001
          }
        }

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
            result.APP_NAME = 'Web App'
          }
        }

        // Validate API_BASE_URL
        {
          const fieldValue = input.API_BASE_URL
          if (fieldValue !== undefined) {
            if (typeof fieldValue !== 'string') {
              issues.push({
                message: "Field 'API_BASE_URL' must be a string",
                path: ['API_BASE_URL'],
              })
            } else {
              try {
                new URL(fieldValue)
                result.API_BASE_URL = fieldValue
              } catch {
                issues.push({
                  message: "Field 'API_BASE_URL' must be a valid URL",
                  path: ['API_BASE_URL'],
                })
              }
            }
          } else {
            result.API_BASE_URL = 'http://localhost:3000'
          }
        }

        // Validate API_TIMEOUT
        {
          const fieldValue = input.API_TIMEOUT
          if (fieldValue !== undefined) {
            const numValue =
              typeof fieldValue === 'string' ? Number(fieldValue) : fieldValue
            if (typeof numValue !== 'number' || isNaN(numValue)) {
              issues.push({
                message: "Field 'API_TIMEOUT' must be a number",
                path: ['API_TIMEOUT'],
              })
            } else if (
              numValue < 1000 ||
              numValue > 30000 ||
              !Number.isInteger(numValue)
            ) {
              issues.push({
                message:
                  "Field 'API_TIMEOUT' must be an integer between 1000 and 30000",
                path: ['API_TIMEOUT'],
              })
            } else {
              result.API_TIMEOUT = numValue
            }
          } else {
            result.API_TIMEOUT = 5000
          }
        }

        // Validate ENABLE_AUTH
        {
          const fieldValue = input.ENABLE_AUTH
          if (fieldValue !== undefined) {
            if (typeof fieldValue === 'boolean') {
              result.ENABLE_AUTH = fieldValue
            } else if (typeof fieldValue === 'string') {
              result.ENABLE_AUTH = fieldValue.toLowerCase() === 'true'
            } else {
              issues.push({
                message: "Field 'ENABLE_AUTH' must be a boolean",
                path: ['ENABLE_AUTH'],
              })
            }
          } else {
            result.ENABLE_AUTH = true
          }
        }

        // Validate ENABLE_ANALYTICS
        {
          const fieldValue = input.ENABLE_ANALYTICS
          if (fieldValue !== undefined) {
            if (typeof fieldValue === 'boolean') {
              result.ENABLE_ANALYTICS = fieldValue
            } else if (typeof fieldValue === 'string') {
              result.ENABLE_ANALYTICS = fieldValue.toLowerCase() === 'true'
            } else {
              issues.push({
                message: "Field 'ENABLE_ANALYTICS' must be a boolean",
                path: ['ENABLE_ANALYTICS'],
              })
            }
          } else {
            result.ENABLE_ANALYTICS = false
          }
        }

        // Validate STATIC_PATH
        {
          const fieldValue = input.STATIC_PATH
          if (fieldValue !== undefined) {
            if (typeof fieldValue !== 'string') {
              issues.push({
                message: "Field 'STATIC_PATH' must be a string",
                path: ['STATIC_PATH'],
              })
            } else {
              result.STATIC_PATH = fieldValue
            }
          } else {
            result.STATIC_PATH = './public'
          }
        }

        // Validate MAX_UPLOAD_SIZE
        {
          const fieldValue = input.MAX_UPLOAD_SIZE
          if (fieldValue !== undefined) {
            const numValue =
              typeof fieldValue === 'string' ? Number(fieldValue) : fieldValue
            if (typeof numValue !== 'number' || isNaN(numValue)) {
              issues.push({
                message: "Field 'MAX_UPLOAD_SIZE' must be a number",
                path: ['MAX_UPLOAD_SIZE'],
              })
            } else if (
              numValue < 1024 ||
              numValue > 104857600 ||
              !Number.isInteger(numValue)
            ) {
              issues.push({
                message:
                  "Field 'MAX_UPLOAD_SIZE' must be an integer between 1024 and 104857600",
                path: ['MAX_UPLOAD_SIZE'],
              })
            } else {
              result.MAX_UPLOAD_SIZE = numValue
            }
          } else {
            result.MAX_UPLOAD_SIZE = 10485760
          }
        }

        if (issues.length > 0) {
          return { issues }
        }

        return { value: result as WebAppConfigType }
      },
      types: {} as StandardSchemaV1.Types<WebAppConfigType, WebAppConfigType>,
    },
  }
}

// Load configuration from environment variables
function loadConfig(): WebAppConfigType {
  const env = process.env
  const schema = createWebAppSchema()

  const input = {
    APP_PORT: env.APP_PORT,
    APP_NAME: env.APP_NAME,
    API_BASE_URL: env.API_BASE_URL,
    API_TIMEOUT: env.API_TIMEOUT,
    ENABLE_AUTH: env.ENABLE_AUTH,
    ENABLE_ANALYTICS: env.ENABLE_ANALYTICS,
    STATIC_PATH: env.STATIC_PATH,
    MAX_UPLOAD_SIZE: env.MAX_UPLOAD_SIZE,
  }

  const result = schema['~standard'].validate(input)

  if ('issues' in result) {
    const errorMessage = result.issues
      .map(issue =>
        issue.path ? `${issue.path.join('.')}: ${issue.message}` : issue.message
      )
      .join('\n')
    throw new Error(`Configuration validation failed:\n${errorMessage}`)
  }

  return result.value
}

/** Web App configuration instance - loads dynamically */
export const WebAppConfig = new Proxy({} as WebAppConfigType, {
  get(target, prop) {
    const config = loadConfig()
    return config[prop as keyof WebAppConfigType]
  },
})
