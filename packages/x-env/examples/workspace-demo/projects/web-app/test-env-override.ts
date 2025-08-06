#!/usr/bin/env node --experimental-strip-types

import { config } from 'dotenv'

// 加载测试环境变量 - 必须在导入WebApp之前，使用override选项
config({ path: '.env.test', override: true })

import { WebApp } from './src/index.ts'

async function testEnvOverride() {
  console.log('🧪 Testing environment variable override...\n')

  try {
    // 创建Web App实例
    const app = new WebApp()

    // 启动应用
    const { server, apiClient, config: appConfig } = await app.start()

    console.log('\n✅ Web App started with custom configuration!')
    console.log(`📊 Overridden configuration:`)
    console.log(
      `   - App Name: ${appConfig.APP_NAME} (should be "Test Web Application")`
    )
    console.log(`   - Port: ${appConfig.APP_PORT} (should be 4001)`)
    console.log(
      `   - API Base URL: ${appConfig.API_BASE_URL} (should be test-api.example.com)`
    )
    console.log(
      `   - API Timeout: ${appConfig.API_TIMEOUT}ms (should be 10000)`
    )
    console.log(`   - Auth Enabled: ${appConfig.ENABLE_AUTH} (should be false)`)
    console.log(
      `   - Analytics Enabled: ${appConfig.ENABLE_ANALYTICS} (should be true)`
    )
    console.log(
      `   - Static Path: ${appConfig.STATIC_PATH} (should be "./test-public")`
    )
    console.log(
      `   - Max Upload Size: ${appConfig.MAX_UPLOAD_SIZE} bytes (should be 52428800)`
    )

    // 验证配置值
    const expectedValues = {
      APP_NAME: 'Test Web Application',
      APP_PORT: 4001,
      API_BASE_URL: 'http://test-api.example.com',
      API_TIMEOUT: 10000,
      ENABLE_AUTH: false,
      ENABLE_ANALYTICS: true,
      STATIC_PATH: './test-public',
      MAX_UPLOAD_SIZE: 52428800,
    }

    let allCorrect = true
    for (const [key, expected] of Object.entries(expectedValues)) {
      const actual = appConfig[key as keyof typeof appConfig]
      if (actual !== expected) {
        console.error(`❌ ${key}: expected ${expected}, got ${actual}`)
        allCorrect = false
      } else {
        console.log(`✅ ${key}: ${actual}`)
      }
    }

    if (allCorrect) {
      console.log('\n🎉 Environment override test passed!')
      console.log(
        '✅ All configuration values were correctly overridden from .env.test file'
      )
    } else {
      console.error('\n❌ Environment override test failed!')
      process.exit(1)
    }

    // 停止服务器
    await server.stop()
  } catch (error) {
    console.error('❌ Environment override test failed:', error)
    process.exit(1)
  }
}

// 运行测试
testEnvOverride()
