import type { SafenvPlugin, SafenvPluginConfig } from './plugins/types.ts'

// Standard Schema V1 interface for type safety
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

// Supported primitive types
export type SafenvPrimitiveType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'

// Type-safe default values based on the variable type
export type SafenvDefaultValue<T extends SafenvPrimitiveType> =
  T extends 'string'
    ? string
    : T extends 'number'
      ? number
      : T extends 'boolean'
        ? boolean
        : T extends 'array'
          ? unknown[]
          : T extends 'object'
            ? Record<string, unknown>
            : never

// Type-safe resolved values
export type SafenvResolvedValue<T extends SafenvPrimitiveType> =
  SafenvDefaultValue<T>

// Custom validation function with proper typing
// Validators receive the raw input value (string from env vars) and should validate/transform it
export type SafenvValidator<
  _T extends SafenvPrimitiveType = SafenvPrimitiveType,
> = (
  value: string | number | boolean | Record<string, unknown> | unknown[]
) => boolean | string

// Enhanced variable definition with type safety
export interface SafenvVariable<
  T extends SafenvPrimitiveType = SafenvPrimitiveType,
> {
  type: T
  description?: string
  default?: SafenvDefaultValue<T>
  required?: boolean
  validate?: SafenvValidator<T>
  // Standard Schema integration
  schema?: StandardSchemaV1<unknown, SafenvResolvedValue<T>>
  // Additional constraints for specific types
  constraints?: T extends 'string'
    ? StringConstraints
    : T extends 'number'
      ? NumberConstraints
      : T extends 'array'
        ? ArrayConstraints
        : T extends 'object'
          ? ObjectConstraints
          : never
}

// Type-specific constraints
export interface StringConstraints {
  minLength?: number
  maxLength?: number
  pattern?: RegExp | string
  format?: 'email' | 'url' | 'uuid' | 'json' | 'semver'
}

export interface NumberConstraints {
  min?: number
  max?: number
  integer?: boolean
  positive?: boolean
  multipleOf?: number
}

export interface ArrayConstraints {
  minItems?: number
  maxItems?: number
  itemType?: SafenvPrimitiveType
  uniqueItems?: boolean
}

export interface ObjectConstraints {
  properties?: Record<string, SafenvVariable>
  additionalProperties?: boolean
  required?: string[]
}

// Type-safe variable collection
export type SafenvVariables = Record<string, SafenvVariable>

// Type-safe resolved variables
export type SafenvResolvedVariables<T extends SafenvVariables> = {
  [K in keyof T]: T[K] extends SafenvVariable<infer U>
    ? SafenvResolvedValue<U>
    : never
}

export interface SafenvConfig<T extends SafenvVariables = SafenvVariables> {
  name: string
  description?: string
  variables: T
  dependencies?: string[]
  plugins?: (SafenvPlugin | SafenvPluginConfig)[]
  workspace?: string[]
  /**
   * Auto-discover dependencies from package.json
   * When true, will scan package.json dependencies for safenv configurations
   */
  autoDependencies?: boolean
  /**
   * Global Standard Schema configuration
   */
  schema?: {
    vendor?: string
    strict?: boolean
    coercion?: boolean
  }
}

export interface SafenvContext<T extends SafenvVariables = SafenvVariables> {
  config: SafenvConfig<T>
  resolvedVariables: SafenvResolvedVariables<T>
  mode: 'serve' | 'build'
  outputDir: string
}

export interface SafenvOptions {
  mode?: 'serve' | 'build'
  configFile?: string
  outputDir?: string
  watch?: boolean
}

// Utility types for type inference
export type InferConfigVariables<T> =
  T extends SafenvConfig<infer U> ? U : never
export type InferResolvedVariables<T> =
  T extends SafenvConfig<infer U> ? SafenvResolvedVariables<U> : never

// Re-export plugin types for convenience
export type { SafenvPlugin, SafenvPluginConfig } from './plugins/types.ts'
