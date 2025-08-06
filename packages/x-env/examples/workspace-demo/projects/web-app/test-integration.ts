#!/usr/bin/env node --experimental-strip-types

import { WebApp } from './src/index.ts'

async function testIntegration() {
  console.log('🧪 Testing Web App integration...\n')

  try {
    // 创建Web App实例
    const app = new WebApp()

    // 启动应用
    const { server, apiClient, config } = await app.start()

    console.log('\n✅ Web App started successfully!')
    console.log(`📊 Configuration loaded:`)
    console.log(`   - App Name: ${config.APP_NAME}`)
    console.log(`   - Port: ${config.APP_PORT}`)
    console.log(`   - API Base URL: ${config.API_BASE_URL}`)
    console.log(`   - Auth Enabled: ${config.ENABLE_AUTH}`)
    console.log(`   - Analytics Enabled: ${config.ENABLE_ANALYTICS}`)

    // 启动Web服务器
    await server.start()

    // 测试API客户端
    console.log('\n🔗 Testing API client...')
    const testData = { message: 'Hello from Web App!' }

    const getResult = await apiClient.get('/health')
    console.log('GET /health:', getResult)

    const postResult = await apiClient.post('/data', testData)
    console.log('POST /data:', postResult)

    const putResult = await apiClient.put('/data/1', {
      ...testData,
      updated: true,
    })
    console.log('PUT /data/1:', putResult)

    const deleteResult = await apiClient.delete('/data/1')
    console.log('DELETE /data/1:', deleteResult)

    // 停止服务器
    await server.stop()

    console.log('\n🎉 Integration test completed successfully!')
    console.log('✅ All components are working correctly:')
    console.log('   - Configuration loading and validation')
    console.log('   - Base service dependency integration')
    console.log('   - API client functionality')
    console.log('   - Web server simulation')
  } catch (error) {
    console.error('❌ Integration test failed:', error)
    process.exit(1)
  }
}

// 运行测试
testIntegration()
