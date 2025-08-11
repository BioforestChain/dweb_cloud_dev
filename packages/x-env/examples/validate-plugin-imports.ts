#!/usr/bin/env node --experimental-strip-types

/**
 * 配置文件修复验证测试
 * 检查所有配置文件是否都正确使用了import导入而不是字符串插件配置
 */

console.log('🔍 验证配置文件插件导入方式...\n')

const configFiles = [
  { path: './dependency-demo.config.ts', name: 'dependency_demo' },
  { path: './web-ui-demo.config.ts', name: 'web_ui_demo' },
  {
    path: './comprehensive-demo/safenv.config.ts',
    name: 'comprehensive_workspace',
  },
  {
    path: './comprehensive-demo/packages/api-backend/safenv.config.ts',
    name: 'api_backend',
  },
  {
    path: './comprehensive-demo/packages/web-frontend/safenv.config.ts',
    name: 'web_frontend',
  },
  {
    path: './comprehensive-demo/packages/shared-utils/safenv.config.ts',
    name: 'shared_utils',
  },
]

let passCount = 0
let failCount = 0

for (const config of configFiles) {
  try {
    console.log(`🔄 测试: ${config.path}`)

    const module = await import(config.path)
    const configObj = module.default

    if (configObj && configObj.name === config.name) {
      // 检查plugins是否使用了函数而不是字符串配置
      const hasStringPlugins = configObj.plugins?.some(
        p =>
          typeof p === 'object' &&
          'name' in p &&
          typeof p.name === 'string' &&
          'options' in p
      )

      if (hasStringPlugins) {
        console.log(`❌ ${config.path} - 仍在使用字符串插件配置`)
        failCount++
      } else {
        console.log(`✅ ${config.path} - 正确使用import插件`)
        passCount++
      }
    } else {
      console.log(`❌ ${config.path} - 配置对象无效`)
      failCount++
    }
  } catch (error) {
    console.log(`❌ ${config.path} - 加载失败: ${error.message}`)
    failCount++
  }
}

console.log('\n📊 测试结果汇总:')
console.log(`✅ 通过: ${passCount}`)
console.log(`❌ 失败: ${failCount}`)
console.log(`总计: ${passCount + failCount}`)

if (failCount === 0) {
  console.log('\n🎉 所有配置文件都已正确使用import插件导入方式！')
  process.exit(0)
} else {
  console.log('\n💥 部分配置文件仍有问题，需要进一步修复')
  process.exit(1)
}
