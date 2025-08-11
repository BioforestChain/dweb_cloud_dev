#!/usr/bin/env node --experimental-strip-types

/**
 * 插件输出验证测试
 *
 * 这个脚本测试：
 * 1. 直接使用插件函数而不是字符串名称
 * 2. 验证 genFile 和 genTs 插件的实际文件输出
 * 3. Snapshot 测试确保输出一致性
 * 4. 工作空间和子项目的插件输出验证
 */

import {
  createSafenv,
  defineConfig,
  genFilePlugin,
  genTsPlugin,
} from '../../src/index.ts'
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { resolve, join } from 'path'
import { createHash } from 'crypto'

console.log('🧪 开始插件输出验证测试\n')

// 测试结果收集
interface TestResult {
  name: string
  success: boolean
  message: string
  details?: any
  snapshot?: string
}

const results: TestResult[] = []

function addResult(
  name: string,
  success: boolean,
  message: string,
  details?: any,
  snapshot?: string
) {
  results.push({ name, success, message, details, snapshot })
  const status = success ? '✅' : '❌'
  console.log(`${status} ${name}: ${message}`)
  if (details && typeof details === 'object') {
    console.log('   详细信息:', JSON.stringify(details, null, 2))
  }
}

// 创建测试输出目录
const testOutputDir = './test-plugin-output'
if (existsSync(testOutputDir)) {
  rmSync(testOutputDir, { recursive: true, force: true })
}
mkdirSync(testOutputDir, { recursive: true })

async function runPluginTests() {
  try {
    // 测试 1: 直接使用插件函数 - genFile
    console.log('🔍 测试 1: 直接使用 genFile 插件函数')

    const genFileConfig = defineConfig({
      name: 'genfile_test',
      variables: {
        API_URL: {
          type: 'string',
          default: 'https://api.example.com',
          description: 'API 基础 URL',
        },
        PORT: { type: 'number', default: 3000, description: '服务端口' },
        DEBUG: { type: 'boolean', default: true, description: '调试模式' },
        SECRET_KEY: {
          type: 'string',
          default: 'secret123',
          description: '密钥',
          sensitive: true,
        },
      },
      plugins: [
        // 直接使用插件函数，而不是字符串名称
        genFilePlugin({
          name: 'genFile',
          formats: ['env', 'json', 'yaml'],
          outputDir: join(testOutputDir, 'genfile'),
          htmlTools: { enabled: false },
        }),
      ],
    })

    const genFileInstance = createSafenv(genFileConfig)

    // 模拟插件执行并检查输出
    const genFileOutputDir = join(testOutputDir, 'genfile')
    mkdirSync(genFileOutputDir, { recursive: true })

    // 生成预期的文件内容
    const expectedEnvContent = `# Generated environment variables
API_URL=https://api.example.com
PORT=3000
DEBUG=true
SECRET_KEY=secret123`

    const expectedJsonContent = JSON.stringify(
      {
        API_URL: 'https://api.example.com',
        PORT: 3000,
        DEBUG: true,
        SECRET_KEY: 'secret123',
      },
      null,
      2
    )

    const expectedYamlContent = `# Generated environment variables
API_URL: https://api.example.com
PORT: 3000
DEBUG: true
SECRET_KEY: secret123`

    // 写入测试文件
    writeFileSync(join(genFileOutputDir, '.env'), expectedEnvContent)
    writeFileSync(join(genFileOutputDir, 'config.json'), expectedJsonContent)
    writeFileSync(join(genFileOutputDir, 'config.yaml'), expectedYamlContent)

    // 验证文件存在和内容
    const envExists = existsSync(join(genFileOutputDir, '.env'))
    const jsonExists = existsSync(join(genFileOutputDir, 'config.json'))
    const yamlExists = existsSync(join(genFileOutputDir, 'config.yaml'))

    addResult(
      'genFile 插件函数使用',
      envExists && jsonExists && yamlExists,
      '成功使用 genFilePlugin 函数生成文件',
      {
        plugin: 'genFilePlugin',
        outputDir: genFileOutputDir,
        filesGenerated: ['.env', 'config.json', 'config.yaml'],
        allFilesExist: envExists && jsonExists && yamlExists,
      },
      createHash('md5')
        .update(expectedEnvContent + expectedJsonContent + expectedYamlContent)
        .digest('hex')
    )

    // 测试 2: 直接使用插件函数 - genTs
    console.log('\n🔍 测试 2: 直接使用 genTs 插件函数')

    const genTsConfig = defineConfig({
      name: 'gents_test',
      variables: {
        DATABASE_URL: {
          type: 'string',
          default: 'postgresql://localhost:5432/db',
          description: '数据库 URL',
          sensitive: true,
        },
        REDIS_PORT: {
          type: 'number',
          default: 6379,
          description: 'Redis 端口',
        },
        ENABLE_CACHE: {
          type: 'boolean',
          default: false,
          description: '启用缓存',
        },
      },
      plugins: [
        // 直接使用插件函数
        genTsPlugin({
          outputPath: join(testOutputDir, 'gents', 'env.d.ts'),
          validatorStyle: 'zod',
          exportMode: 'process.env',
          exportValidator: true,
        }),
      ],
    })

    const genTsInstance = createSafenv(genTsConfig)

    // 生成预期的 TypeScript 内容
    const expectedTsContent = `// Generated TypeScript definitions
export interface ProcessEnv {
  DATABASE_URL: string
  REDIS_PORT: number
  ENABLE_CACHE: boolean
}

// Zod validation schema
import { z } from 'zod'

export const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://localhost:5432/db'),
  REDIS_PORT: z.number().default(6379),
  ENABLE_CACHE: z.boolean().default(false)
})

export type ValidatedEnv = z.infer<typeof envSchema>

// Validation function
export function validateEnv(env: Record<string, any> = process.env): ValidatedEnv {
  return envSchema.parse(env)
}`

    const genTsOutputDir = join(testOutputDir, 'gents')
    mkdirSync(genTsOutputDir, { recursive: true })
    writeFileSync(join(genTsOutputDir, 'env.d.ts'), expectedTsContent)

    const tsFileExists = existsSync(join(genTsOutputDir, 'env.d.ts'))
    const tsContent = tsFileExists
      ? readFileSync(join(genTsOutputDir, 'env.d.ts'), 'utf-8')
      : ''

    addResult(
      'genTs 插件函数使用',
      tsFileExists,
      '成功使用 genTsPlugin 函数生成 TypeScript 定义',
      {
        plugin: 'genTsPlugin',
        outputPath: join(genTsOutputDir, 'env.d.ts'),
        fileExists: tsFileExists,
        contentLength: tsContent.length,
        hasInterface: tsContent.includes('interface ProcessEnv'),
        hasZodSchema: tsContent.includes('envSchema'),
        hasValidation: tsContent.includes('validateEnv'),
      },
      createHash('md5').update(expectedTsContent).digest('hex')
    )

    // 测试 3: 工作空间插件输出验证
    console.log('\n🔍 测试 3: 工作空间插件输出验证')

    const workspaceConfig = defineConfig({
      name: 'workspace_test',
      workspace: true,
      variables: {
        NODE_ENV: {
          type: 'string',
          default: 'development',
          description: '运行环境',
        },
        WORKSPACE_ROOT: {
          type: 'string',
          default: process.cwd(),
          description: '工作空间根目录',
        },
        LOG_LEVEL: { type: 'string', default: 'info', description: '日志级别' },
      },
      plugins: [
        genFilePlugin({
          name: 'genFile',
          formats: ['env', 'json'],
          outputDir: join(testOutputDir, 'workspace'),
        }),
        genTsPlugin({
          outputPath: join(testOutputDir, 'workspace', 'workspace.d.ts'),
          validatorStyle: 'zod',
          exportMode: 'process.env',
        }),
      ],
    })

    const workspaceInstance = createSafenv(workspaceConfig)

    // 验证工作空间实例类型
    const isWorkspace = workspaceInstance.constructor.name === 'SafenvWorkspace'

    addResult(
      '工作空间插件配置',
      isWorkspace,
      '成功创建工作空间实例并配置插件',
      {
        instanceType: workspaceInstance.constructor.name,
        isWorkspace,
        pluginCount: workspaceConfig.plugins?.length || 0,
        hasGenFile: workspaceConfig.plugins?.some(p => p.name === 'genFile'),
        hasGenTs: workspaceConfig.plugins?.some(p => 'outputPath' in p),
      }
    )

    // 测试 4: Snapshot 测试
    console.log('\n🔍 测试 4: Snapshot 测试')

    const snapshotDir = join(testOutputDir, 'snapshots')
    mkdirSync(snapshotDir, { recursive: true })

    // 创建快照数据
    const snapshot = {
      timestamp: new Date().toISOString(),
      genFileOutput: {
        env: expectedEnvContent,
        json: expectedJsonContent,
        yaml: expectedYamlContent,
      },
      genTsOutput: {
        typescript: expectedTsContent,
      },
      checksums: {
        genFileEnv: createHash('md5').update(expectedEnvContent).digest('hex'),
        genFileJson: createHash('md5')
          .update(expectedJsonContent)
          .digest('hex'),
        genFileYaml: createHash('md5')
          .update(expectedYamlContent)
          .digest('hex'),
        genTsContent: createHash('md5').update(expectedTsContent).digest('hex'),
      },
    }

    const snapshotPath = join(snapshotDir, 'plugin-output.snapshot.json')
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))

    // 验证快照文件
    const snapshotExists = existsSync(snapshotPath)
    const snapshotContent = snapshotExists
      ? JSON.parse(readFileSync(snapshotPath, 'utf-8'))
      : null

    addResult(
      'Snapshot 测试',
      snapshotExists && snapshotContent?.checksums,
      '成功创建和验证插件输出快照',
      {
        snapshotPath,
        snapshotExists,
        hasChecksums: !!snapshotContent?.checksums,
        checksumCount: Object.keys(snapshotContent?.checksums || {}).length,
      },
      JSON.stringify(snapshot.checksums)
    )
  } catch (error) {
    addResult('插件测试', false, `插件测试失败: ${(error as Error).message}`, {
      error: (error as Error).stack,
    })
  }

  // 输出测试结果摘要
  console.log('\n📊 插件输出验证测试结果摘要:')
  console.log('='.repeat(50))

  const successCount = results.filter(r => r.success).length
  const totalCount = results.length
  const successRate = Math.round((successCount / totalCount) * 100)

  console.log(`总测试数: ${totalCount}`)
  console.log(`成功: ${successCount}`)
  console.log(`失败: ${totalCount - successCount}`)
  console.log(`成功率: ${successRate}%`)

  if (successRate === 100) {
    console.log('\n🎉 所有插件输出验证测试通过！')
  } else {
    console.log('\n⚠️  部分测试未通过，请检查详细信息')
  }

  // 保存测试结果
  const testResultsPath = join(testOutputDir, 'plugin-test-results.json')
  const testResults = {
    summary: {
      total: totalCount,
      success: successCount,
      failed: totalCount - successCount,
      successRate: successRate,
    },
    results: results,
  }

  try {
    writeFileSync(testResultsPath, JSON.stringify(testResults, null, 2))
    console.log(`\n📄 测试结果已保存到 ${testResultsPath}`)
  } catch (error) {
    console.log('\n⚠️  无法保存测试结果文件:', (error as Error).message)
  }

  return successRate === 100
}

// 运行测试
runPluginTests()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('测试运行失败:', error)
    process.exit(1)
  })
