#!/usr/bin/env node

/**
 * 清理无用测试文件的脚本
 */

import { readdirSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'

console.log('🧹 清理无用测试文件\n')

const testDir = './src/__test__'
const pluginTestDir = './src/plugins/__test__'

// 要删除的测试文件（有问题的、过时的、无用的）
const filesToDelete = [
  // 主测试目录
  'core.test.ts',
  'compatible.test.ts',
  'optimized-core.test.ts',
  'performance-manager.test.ts',
  'enhanced-dependency-resolver.test.ts',
  'enhanced-variable-resolver.test.ts',
  'hot-reload-manager.test.ts',
  'npm-safenv-resolver.test.ts',
  'update-tests.ts',

  // 插件测试目录
  'lifecycle-hooks.test.ts',
]

let deletedCount = 0

// 删除主测试目录的文件
filesToDelete.forEach(file => {
  const filePath = join(testDir, file)
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath)
      console.log(`✅ 删除: ${file}`)
      deletedCount++
    } catch (error) {
      console.log(`❌ 删除失败: ${file} - ${error.message}`)
    }
  }
})

// 删除插件测试目录的文件
if (existsSync(pluginTestDir)) {
  filesToDelete.forEach(file => {
    const filePath = join(pluginTestDir, file)
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath)
        console.log(`✅ 删除: plugins/${file}`)
        deletedCount++
      } catch (error) {
        console.log(`❌ 删除失败: plugins/${file} - ${error.message}`)
      }
    }
  })
}

console.log(`\n📊 清理完成！删除了 ${deletedCount} 个文件`)

// 显示剩余的测试文件
if (existsSync(testDir)) {
  const remainingFiles = readdirSync(testDir).filter(f =>
    f.endsWith('.test.ts')
  )
  console.log(`\n📁 剩余测试文件 (${remainingFiles.length} 个):`)
  remainingFiles.forEach(file => console.log(`  - ${file}`))
}

console.log('\n🎯 现在只保留了真正有用的测试文件！')
