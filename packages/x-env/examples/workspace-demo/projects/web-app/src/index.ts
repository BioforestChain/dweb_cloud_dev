import { WebAppConfig } from './generated/config.ts'
import { BaseServiceConfig } from 'base-service'
import { createApiClient } from './api.ts'
import { createWebServer } from './server.ts'

export class WebApp {
  private config: typeof WebAppConfig
  private baseServiceConfig: typeof BaseServiceConfig

  constructor() {
    this.config = WebAppConfig
    this.baseServiceConfig = BaseServiceConfig
  }

  async start() {
    console.log(
      `Starting ${this.config.APP_NAME} on port ${this.config.APP_PORT}`
    )

    // 使用基础服务的配置
    console.log(
      `Connecting to base service database: ${this.baseServiceConfig.DB_HOST}:${this.baseServiceConfig.DB_PORT}`
    )

    // 创建API客户端
    const apiClient = createApiClient({
      baseURL: this.config.API_BASE_URL,
      timeout: this.config.API_TIMEOUT,
    })

    // 创建Web服务器
    const server = await createWebServer({
      port: this.config.APP_PORT,
      staticPath: this.config.STATIC_PATH,
      maxUploadSize: this.config.MAX_UPLOAD_SIZE,
      features: {
        auth: this.config.ENABLE_AUTH,
        analytics: this.config.ENABLE_ANALYTICS,
      },
    })

    return {
      server,
      apiClient,
      config: this.config,
    }
  }
}

// 启动应用（如果直接运行此文件）
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = new WebApp()
  app.start().catch(console.error)
}

export { WebAppConfig } from './generated/config.ts'
export type { WebAppConfigType } from './generated/config.ts'
