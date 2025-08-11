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
export type SafenvValidator<T extends SafenvPrimitiveType> = (
  value: T extends 'string'
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
) => boolean | string | Promise<boolean | string>

// Enhanced variable definition with type safety
export interface SafenvVariable<
  T extends SafenvPrimitiveType = SafenvPrimitiveType,
> {
  type?: T
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
  // Legacy support for simple value definition
  value?: SafenvDefaultValue<T>
  env?: string
  sensitive?: boolean
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
  name?: string
  description?: string
  variables: T
  dependencies?: string[] | DependencyConfiguration
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

/**
 * 增强的依赖配置
 */
export interface DependencyConfiguration {
  /** 显式依赖声明 */
  explicit?: string[]
  /** 条件依赖 - 基于环境或其他条件 */
  conditional?: Record<string, ConditionalDependency>
  /** 版本约束 */
  versions?: Record<string, string>
  /** 冲突解决策略 */
  conflictResolution?: ConflictResolutionStrategy
  /** 依赖优先级 */
  priority?: Record<string, number>
  /** 依赖别名 */
  aliases?: Record<string, string>
  /** 排除的依赖 */
  exclude?: string[]
  /** 依赖加载选项 */
  loadOptions?: DependencyLoadOptions
}

/**
 * 条件依赖配置
 */
export interface ConditionalDependency {
  /** 依赖包名 */
  packages: string[]
  /** 条件表达式 */
  condition: string | ((context: SafenvContext) => boolean)
  /** 是否必需 */
  required?: boolean
}

/**
 * 冲突解决策略
 */
export type ConflictResolutionStrategy =
  | 'strict' // 严格模式，有冲突就报错
  | 'warn' // 警告模式，显示警告但继续
  | 'ignore' // 忽略冲突
  | 'latest' // 使用最新版本
  | 'priority' // 基于优先级解决
  | 'manual' // 手动解决

/**
 * 依赖加载选项
 */
export interface DependencyLoadOptions {
  /** 是否并行加载 */
  parallel?: boolean
  /** 加载超时时间（毫秒） */
  timeout?: number
  /** 重试次数 */
  retries?: number
  /** 是否缓存依赖 */
  cache?: boolean
  /** 缓存过期时间（毫秒） */
  cacheTimeout?: number
}

export interface SafenvContext<T extends SafenvVariables = SafenvVariables> {
  config: SafenvConfig<T>
  resolvedVariables: SafenvResolvedVariables<T>
  root: string
  configFile: string
}

// Safenv 配置结构 - 专注于 VAL (配置、环境、变量) 管理
export interface SafenvOptions {
  // 基础配置
  root?: string
  configFile?: string

  // 项目名称（用于插件输出文件命名）
  name?: string

  // 工作空间配置 - 自动发现或指定包含 safenv.config 的项目路径
  workspace?: boolean | string[]

  // VAL 定义 - Safenv 的核心：配置、环境、变量
  variables?: SafenvVariables

  // 插件配置 - 通过插件输出各种格式
  plugins?: (SafenvPlugin | SafenvPluginConfig)[]

  // 服务器配置（仅用于 web-ui 和 html-tools）
  server?: {
    port?: number
    host?: string
  }
}

// Utility types for type inference
export type InferConfigVariables<T> =
  T extends SafenvConfig<infer U> ? U : never
export type InferResolvedVariables<T> =
  T extends SafenvConfig<infer U> ? SafenvResolvedVariables<U> : never

// Re-export plugin types for convenience
export type { SafenvPlugin, SafenvPluginConfig } from './plugins/types.ts'
