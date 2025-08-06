interface WebServerConfig {
  port: number
  staticPath: string
  maxUploadSize: number
  features: {
    auth: boolean
    analytics: boolean
  }
}

export interface WebServer {
  start(): Promise<void>
  stop(): Promise<void>
  getPort(): number
}

export async function createWebServer(
  config: WebServerConfig
): Promise<WebServer> {
  console.log(`Creating web server with config:`)
  console.log(`- Port: ${config.port}`)
  console.log(`- Static path: ${config.staticPath}`)
  console.log(`- Max upload size: ${config.maxUploadSize} bytes`)
  console.log(`- Auth enabled: ${config.features.auth}`)
  console.log(`- Analytics enabled: ${config.features.analytics}`)

  let isRunning = false

  return {
    async start() {
      if (isRunning) {
        console.log('Server is already running')
        return
      }

      console.log(`🚀 Web server starting on port ${config.port}`)

      // 模拟服务器启动
      await new Promise(resolve => setTimeout(resolve, 500))

      isRunning = true
      console.log(`✅ Web server is running on http://localhost:${config.port}`)

      // 显示功能状态
      if (config.features.auth) {
        console.log('🔐 Authentication is enabled')
      }
      if (config.features.analytics) {
        console.log('📊 Analytics tracking is enabled')
      }

      console.log(`📁 Serving static files from: ${config.staticPath}`)
      console.log(
        `📤 Max upload size: ${(config.maxUploadSize / 1024 / 1024).toFixed(1)}MB`
      )
    },

    async stop() {
      if (!isRunning) {
        console.log('Server is not running')
        return
      }

      console.log('🛑 Stopping web server...')

      // 模拟服务器停止
      await new Promise(resolve => setTimeout(resolve, 200))

      isRunning = false
      console.log('✅ Web server stopped')
    },

    getPort() {
      return config.port
    },
  }
}
