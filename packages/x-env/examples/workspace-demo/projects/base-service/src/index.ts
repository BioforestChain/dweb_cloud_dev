import { SafenvCore } from '@dweb-cloud/safenv'
import {
  createBaseServiceSchema,
  type BaseServiceConfig,
} from './generated/config.ts'
import { createDatabaseConnection } from './database.ts'
import { createRedisClient } from './redis.ts'
import { config } from 'dotenv'

// Load environment variables from .env file
config()

export class BaseService {
  private config: BaseServiceConfig | null = null
  private safenvCore: SafenvCore

  constructor() {
    this.safenvCore = new SafenvCore()
  }

  private async loadConfig(): Promise<BaseServiceConfig> {
    if (this.config) {
      return this.config
    }

    try {
      // Load safenv configuration
      const safenvConfig = await this.safenvCore.loadConfig()

      // Get environment variables
      const envVars = {
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        REDIS_URL: process.env.REDIS_URL,
        REDIS_TTL: process.env.REDIS_TTL,
        SERVICE_PORT: process.env.SERVICE_PORT,
        LOG_LEVEL: process.env.LOG_LEVEL,
      }

      // Validate using generated schema
      const schema = createBaseServiceSchema()
      const result = schema['~standard'].validate(envVars)

      if ('issues' in result) {
        const errorMessages = result.issues
          .map(issue =>
            issue.path
              ? `${issue.path.join('.')}: ${issue.message}`
              : issue.message
          )
          .join('\n- ')
        throw new Error(`Configuration validation failed:\n- ${errorMessages}`)
      }

      this.config = result.value
      return this.config
    } catch (error) {
      console.error('Failed to load configuration:', error)
      throw error
    }
  }

  async start(): Promise<{
    database: Awaited<ReturnType<typeof createDatabaseConnection>>
    cache: Awaited<ReturnType<typeof createRedisClient>>
    config: BaseServiceConfig
  }> {
    // Load and validate configuration
    const config = await this.loadConfig()

    console.log(`Starting base service on port ${config.SERVICE_PORT}`)
    console.log(`Log level: ${config.LOG_LEVEL}`)

    // 初始化数据库连接
    const db = await createDatabaseConnection({
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_NAME,
      username: config.DB_USER,
      password: config.DB_PASSWORD,
    })

    // 初始化Redis客户端
    const redis = await createRedisClient({
      url: config.REDIS_URL || 'redis://localhost:6379',
      defaultTTL: config.REDIS_TTL || 3600,
    })

    console.log('Base service started successfully')

    return {
      database: db,
      cache: redis,
      config,
    }
  }

  async getConfig(): Promise<BaseServiceConfig> {
    return await this.loadConfig()
  }
}

// 导出配置供其他项目使用
export {
  createBaseServiceSchema,
  type BaseServiceConfig,
} from './generated/config.ts'

// Load configuration from environment variables for direct use
function loadBaseServiceConfigSync(): BaseServiceConfig {
  const env = process.env
  const schema = createBaseServiceSchema()

  const input = {
    DB_HOST: env.DB_HOST,
    DB_PORT: env.DB_PORT,
    DB_NAME: env.DB_NAME,
    DB_USER: env.DB_USER,
    DB_PASSWORD: env.DB_PASSWORD,
    REDIS_URL: env.REDIS_URL,
    REDIS_TTL: env.REDIS_TTL,
    SERVICE_PORT: env.SERVICE_PORT,
    LOG_LEVEL: env.LOG_LEVEL,
  }

  const result = schema['~standard'].validate(input)

  if ('issues' in result) {
    const errorMessage = result.issues
      .map(issue =>
        issue.path ? `${issue.path.join('.')}: ${issue.message}` : issue.message
      )
      .join('\n')
    throw new Error(
      `Base service configuration validation failed:\n${errorMessage}`
    )
  }

  return result.value
}

// Export the loaded configuration for other projects to import
export const BaseServiceConfig: BaseServiceConfig = loadBaseServiceConfigSync()

// Helper function to load base service config for other projects
export async function loadBaseServiceConfig(): Promise<BaseServiceConfig> {
  const service = new BaseService()
  return await service.getConfig()
}

// 如果直接运行此文件，启动服务
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new BaseService()
  service.start().catch(console.error)
}
