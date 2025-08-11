#!/usr/bin/env node

/**
 * 修复所有测试文件的脚本
 *
 * 这个脚本会：
 * 1. 修复 TypeScript 参数属性语法问题
 * 2. 更新所有导入和 API 使用
 * 3. 确保测试与最新 API 兼容
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'

console.log('🔧 开始修复所有测试文件\n')

const testDir = './src/__test__'
const results = []

function logResult(file, action, success, details) {
  results.push({ file, action, success, details })
  console.log(`${success ? '✅' : '❌'} ${file}: ${action}`)
  if (details) {
    console.log(`   ${details}`)
  }
}

// 修复 TypeScript 参数属性语法
function fixParameterPropertySyntax(content, filename) {
  let modified = false

  // 匹配 constructor(private xxx: Type) 模式
  const parameterPropertyRegex =
    /constructor\s*\(\s*private\s+(\w+):\s*([^)]+)\)\s*\{([^}]*)\}/g

  content = content.replace(
    parameterPropertyRegex,
    (match, paramName, paramType, body) => {
      modified = true
      return `private ${paramName}: ${paramType}

  constructor(${paramName}: ${paramType}) {
    this.${paramName} = ${paramName}${body}
  }`
    }
  )

  if (modified) {
    logResult(filename, '修复参数属性语法', true, '转换为标准语法')
  }

  return content
}

// 修复插件导入
function fixPluginImports(content, filename) {
  let modified = false

  // 修复 GenFilePlugin 导入
  if (content.includes('GenFilePlugin')) {
    content = content.replace(
      /import.*GenFilePlugin.*from.*['"].*genFile.*['"]/g,
      "import { genFilePlugin } from '../plugins/genFile.ts'"
    )
    modified = true
  }

  // 修复 GenTsPlugin 导入
  if (content.includes('GenTsPlugin')) {
    content = content.replace(
      /import.*GenTsPlugin.*from.*['"].*genTs.*['"]/g,
      "import { genTsPlugin } from '../plugins/genTs.ts'"
    )
    modified = true
  }

  if (modified) {
    logResult(filename, '修复插件导入', true, '更新为插件函数导入')
  }

  return content
}

// 修复插件使用
function fixPluginUsage(content, filename) {
  let modified = false

  // 修复 GenFilePlugin 实例化
  content = content.replace(
    /new GenFilePlugin\s*\(\s*\{([^}]+)\}\s*\)/g,
    (match, options) => {
      modified = true
      return `genFilePlugin({ options: {${options}} })`
    }
  )

  // 修复 GenTsPlugin 实例化
  content = content.replace(
    /new GenTsPlugin\s*\(\s*\{([^}]+)\}\s*\)/g,
    (match, options) => {
      modified = true
      return `genTsPlugin({ options: {${options}} })`
    }
  )

  if (modified) {
    logResult(filename, '修复插件使用', true, '更新为插件函数调用')
  }

  return content
}

// 修复测试用例
function fixTestCases(content, filename) {
  let modified = false

  // 修复插件名称测试
  content = content.replace(
    /expect\(plugin\.name\)\.toBe\(['"]genFilePlugin['"]\)/g,
    "expect(plugin.name).toBe('genFile')"
  )

  content = content.replace(
    /expect\(plugin\.name\)\.toBe\(['"]genTsPlugin['"]\)/g,
    "expect(plugin.name).toBe('genTs')"
  )

  if (content.includes('plugin.name')) {
    modified = true
    logResult(filename, '修复测试用例', true, '更新插件名称断言')
  }

  return content
}

// 添加缺失的导入
function addMissingImports(content, filename) {
  let modified = false

  // 检查是否需要添加 createSafenv 和 defineConfig 导入
  if (
    (content.includes('createSafenv') || content.includes('defineConfig')) &&
    !content.includes("from '../index.ts'")
  ) {
    // 在现有导入后添加
    const importIndex = content.lastIndexOf('import')
    if (importIndex !== -1) {
      const nextLineIndex = content.indexOf('\n', importIndex)
      if (nextLineIndex !== -1) {
        content =
          content.slice(0, nextLineIndex + 1) +
          "import { createSafenv, defineConfig } from '../index.ts'\n" +
          content.slice(nextLineIndex + 1)
        modified = true
      }
    }
  }

  if (modified) {
    logResult(
      filename,
      '添加缺失导入',
      true,
      '添加 createSafenv 和 defineConfig'
    )
  }

  return content
}

// 修复单个测试文件
function fixTestFile(filename) {
  try {
    const filePath = join(testDir, filename)
    let content = readFileSync(filePath, 'utf-8')

    console.log(`\n🔍 处理文件: ${filename}`)

    // 应用所有修复
    content = fixParameterPropertySyntax(content, filename)
    content = fixPluginImports(content, filename)
    content = fixPluginUsage(content, filename)
    content = fixTestCases(content, filename)
    content = addMissingImports(content, filename)

    // 写回文件
    writeFileSync(filePath, content, 'utf-8')

    logResult(filename, '文件处理完成', true, '所有修复已应用')
  } catch (error) {
    logResult(filename, '文件处理失败', false, error.message)
  }
}

// 创建新的兼容测试文件
function createCompatibleCoreTest() {
  const testContent = `import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from 'node:fs'
import { join } from 'node:path'
import { SafenvCore } from '../core.ts'
import { genFilePlugin } from '../plugins/genFile.ts'
import { genTsPlugin } from '../plugins/genTs.ts'
import { createSafenv, defineConfig } from '../index.ts'
import type { SafenvConfig } from '../types.ts'

describe('SafenvCore (Compatible)', () => {
  const testConfigDir = join(process.cwd(), 'test-output')

  beforeEach(() => {
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true })
    }
    mkdirSync(testConfigDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testConfigDir)) {
      rmSync(testConfigDir, { recursive: true })
    }
  })

  it('should create core instance with createSafenv', () => {
    const config = defineConfig({
      name: 'test',
      variables: {
        TEST_VAR: { type: 'string', default: 'test' }
      }
    })
    
    const safenv = createSafenv(config)
    expect(safenv).toBeInstanceOf(SafenvCore)
  })

  it('should resolve variables correctly', async () => {
    const safenv = new SafenvCore()
    
    const config: SafenvConfig = {
      name: 'test',
      variables: {
        TEST_STRING: { type: 'string', default: 'hello' },
        TEST_NUMBER: { type: 'number', default: 42 },
        TEST_BOOLEAN: { type: 'boolean', default: true },
      },
    }

    const resolved = await safenv.resolveVariables(config)
    
    expect(resolved.TEST_STRING).toBe('hello')
    expect(resolved.TEST_NUMBER).toBe(42)
    expect(resolved.TEST_BOOLEAN).toBe(true)
  })

  it('should validate required variables', async () => {
    const safenv = new SafenvCore()
    
    const config: SafenvConfig = {
      name: 'test',
      variables: {
        REQUIRED_VAR: { type: 'string', required: true },
      },
    }

    await expect(safenv.resolveVariables(config)).rejects.toThrow()
  })
})

describe('Plugin Functions (Compatible)', () => {
  const testOutputDir = join(process.cwd(), 'test-output')

  beforeEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true })
    }
    mkdirSync(testOutputDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true })
    }
  })

  it('should create genFile plugin correctly', () => {
    const plugin = genFilePlugin({
      options: {
        formats: ['env', 'json'],
        outputDir: testOutputDir
      }
    })
    
    expect(plugin.name).toBe('genFile')
    expect(typeof plugin.apply).toBe('function')
  })

  it('should create genTs plugin correctly', () => {
    const plugin = genTsPlugin({
      options: {
        outputPath: join(testOutputDir, 'types.ts'),
        validatorStyle: 'zod'
      }
    })
    
    expect(plugin.name).toBe('genTs')
    expect(typeof plugin.apply).toBe('function')
  })

  it('should generate files with genFile plugin', async () => {
    const plugin = genFilePlugin({
      options: {
        formats: ['env', 'json'],
        outputDir: testOutputDir
      }
    })

    const context = {
      config: {
        name: 'test',
        variables: {
          API_URL: { type: 'string' as const },
          PORT: { type: 'number' as const }
        }
      },
      resolvedVariables: {
        API_URL: 'https://api.example.com',
        PORT: 3000
      },
      outputDir: testOutputDir,
      mode: 'build' as const
    }

    await plugin.apply(context)

    expect(existsSync(join(testOutputDir, 'test.safenv.env'))).toBe(true)
    expect(existsSync(join(testOutputDir, 'test.safenv.json'))).toBe(true)
  })

  it('should generate TypeScript with genTs plugin', async () => {
    const outputPath = join(testOutputDir, 'types.ts')
    const plugin = genTsPlugin({
      options: {
        outputPath,
        validatorStyle: 'zod',
        exportType: 'named'
      }
    })

    const context = {
      config: {
        name: 'test',
        variables: {
          API_URL: { type: 'string' as const },
          PORT: { type: 'number' as const }
        }
      },
      resolvedVariables: {
        API_URL: 'https://api.example.com',
        PORT: 3000
      },
      outputDir: testOutputDir,
      mode: 'build' as const
    }

    await plugin.apply(context)

    expect(existsSync(outputPath)).toBe(true)
    
    const content = readFileSync(outputPath, 'utf-8')
    expect(content).toContain('interface')
    expect(content).toContain('API_URL')
    expect(content).toContain('PORT')
  })
})

describe('API Integration (Compatible)', () => {
  it('should work with defineConfig and createSafenv', () => {
    const config = defineConfig({
      name: 'integration-test',
      variables: {
        TEST_VAR: { type: 'string', default: 'test' }
      },
      plugins: [
        genFilePlugin({
          options: {
            formats: ['env'],
            outputDir: './test-output'
          }
        })
      ]
    })
    
    expect(config.name).toBe('integration-test')
    expect(config.variables).toBeDefined()
    expect(config.plugins).toHaveLength(1)
    
    const safenv = createSafenv(config)
    expect(safenv).toBeInstanceOf(SafenvCore)
  })

  it('should create server instance with server config', () => {
    const config = defineConfig({
      name: 'server-test',
      variables: {
        PORT: { type: 'number', default: 3000 }
      },
      server: {
        hotReload: true,
        apiEndpoint: '/api/env'
      }
    })
    
    const instance = createSafenv(config)
    expect(instance).toBeDefined()
  })

  it('should create workspace instance with workspace config', () => {
    const config = defineConfig({
      name: 'workspace-test',
      variables: {
        SHARED_VAR: { type: 'string', default: 'shared' }
      },
      workspace: ['./project1', './project2']
    })
    
    const instance = createSafenv(config)
    expect(instance).toBeDefined()
  })
})
`

  writeFileSync(join(testDir, 'compatible.test.ts'), testContent, 'utf-8')
  logResult(
    'compatible.test.ts',
    '创建兼容测试文件',
    true,
    '新的兼容测试文件已创建'
  )
}

// 主执行函数
async function main() {
  try {
    console.log('🚀 开始修复所有测试文件\n')

    // 获取所有测试文件
    const testFiles = readdirSync(testDir).filter(
      file => file.endsWith('.test.ts') && file !== 'compatible.test.ts'
    )

    console.log(`找到 ${testFiles.length} 个测试文件:`)
    testFiles.forEach(file => console.log(`  - ${file}`))

    // 修复每个测试文件
    console.log('\n📝 开始修复测试文件...')
    testFiles.forEach(fixTestFile)

    // 创建新的兼容测试文件
    console.log('\n📄 创建兼容测试文件...')
    createCompatibleCoreTest()

    // 生成报告
    console.log('\n📊 生成修复报告...')
    const report = {
      title: '测试文件修复报告',
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: testFiles.length + 1, // +1 for new compatible test
        processedFiles: testFiles.length,
        newFiles: 1,
        totalActions: results.length,
        successfulActions: results.filter(r => r.success).length,
      },
      results: results,
      recommendations: [
        '运行 npm test 验证所有测试通过',
        '检查新的 compatible.test.ts 文件',
        '确保所有插件函数正确导入',
        '验证 TypeScript 类型检查通过',
      ],
    }

    writeFileSync('./test-fix-report.json', JSON.stringify(report, null, 2))

    console.log('\n📋 修复结果摘要:')
    console.log('='.repeat(50))
    console.log(`处理文件: ${testFiles.length}`)
    console.log(`新建文件: 1`)
    console.log(`总操作数: ${results.length}`)
    console.log(`成功操作: ${results.filter(r => r.success).length}`)
    console.log(`失败操作: ${results.filter(r => !r.success).length}`)

    console.log('\n🎯 修复完成！建议运行以下命令验证:')
    console.log('  npm test')
    console.log('  node validate-snapshots.js')

    return results.filter(r => !r.success).length === 0
  } catch (error) {
    console.error('❌ 修复过程失败:', error.message)
    return false
  }
}

// 运行修复
main()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('修复运行失败:', error)
    process.exit(1)
  })
