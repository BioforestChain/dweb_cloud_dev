#!/usr/bin/env node --experimental-strip-types

/**
 * 测试依赖项目prefix机制
 */

import { SafenvCore } from '../src/core.ts'

console.log('🔍 测试依赖项目prefix机制...\n')

async function testPrefix() {
  try {
    // 使用 dependency-demo 配置来测试，它配置了很多依赖项
    const safenvCore = new SafenvCore({
      configFile: 'dependency-demo.config.ts',
      root: '/Users/kingsword09/aispace/dweb_cloud_dev/packages/x-env/examples',
    })

    console.log('🔄 加载配置文件...')
    const config = await safenvCore.loadConfig()
    console.log(`✅ 配置加载成功: ${config.name}`)
    console.log(`📋 原始变量数量: ${Object.keys(config.variables).length}`)

    // 打印原始变量名
    console.log('\n📝 原始变量名:')
    Object.keys(config.variables).forEach(name => {
      console.log(`  - ${name}`)
    })

    console.log('\n🔄 解析变量（包含依赖）...')
    const resolvedVariables = await safenvCore.resolveVariables(config)
    console.log(`✅ 变量解析成功`)
    console.log(`📋 解析后变量数量: ${Object.keys(resolvedVariables).length}`)

    // 打印解析后的变量名，查看是否有prefix
    console.log('\n📝 解析后变量名:')
    Object.keys(resolvedVariables).forEach(name => {
      console.log(`  - ${name}`)
    })

    // 检查是否有带prefix的变量
    const prefixedVars = Object.keys(resolvedVariables).filter(
      name =>
        name.includes('_') &&
        name !== name.toLowerCase() &&
        !Object.keys(config.variables).includes(name)
    )

    if (prefixedVars.length > 0) {
      console.log('\n🏷️ 发现带prefix的变量:')
      prefixedVars.forEach(name => {
        console.log(`  - ${name}`)
      })
    } else {
      console.log('\n⚠️ 未发现明显的prefix变量')
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  }
}

testPrefix()
