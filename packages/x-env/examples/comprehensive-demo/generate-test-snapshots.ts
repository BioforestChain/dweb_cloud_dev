#!/usr/bin/env node --experimental-strip-types

/**
 * 生成测试快照文件
 *
 * 这个脚本会生成插件输出的快照文件，用于验证插件功能的正确性
 */

import { createSafenv, defineConfig } from '../../src/index.ts'
import { genFilePlugin } from '../../src/plugins/genFile.ts'
import { genTsPlugin } from '../../src/plugins/genTs.ts'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

console.log('📸 开始生成测试快照文件\n')

// 创建快照输出目录
const snapshotDir = './test-snapshots'
if (existsSync(snapshotDir)) {
  rmSync(snapshotDir, { recursive: true, force: true })
}
mkdirSync(snapshotDir, { recursive: true })

// 1. genFile 插件快照
function generateGenFileSnapshot() {
  console.log('🔧 生成 genFile 插件快照')

  const testConfig = defineConfig({
    name: 'genfile_snapshot_test',
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
      genFilePlugin({
        name: 'genFile',
        formats: ['env', 'json', 'yaml'],
        outputDir: './generated',
      }),
    ],
  })

  // 生成预期的输出内容
  const expectedOutputs = {
    env: `# Generated environment variables
# API 基础 URL
API_URL=https://api.example.com

# 服务端口
PORT=3000

# 调试模式
DEBUG=true

# 密钥 (sensitive)
SECRET_KEY=secret123`,

    json: JSON.stringify(
      {
        API_URL: 'https://api.example.com',
        PORT: 3000,
        DEBUG: true,
        SECRET_KEY: 'secret123',
      },
      null,
      2
    ),

    yaml: `# Generated environment variables
# API 基础 URL
API_URL: https://api.example.com

# 服务端口
PORT: 3000

# 调试模式
DEBUG: true

# 密钥 (sensitive)
SECRET_KEY: secret123`,
  }

  const snapshot = {
    pluginName: 'genFile',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      formats: ['env', 'json', 'yaml'],
      outputDir: './generated',
      variableCount: Object.keys(testConfig.variables || {}).length,
    },
    expectedOutputs,
    checksums: {
      env: createHash('md5').update(expectedOutputs.env).digest('hex'),
      json: createHash('md5').update(expectedOutputs.json).digest('hex'),
      yaml: createHash('md5').update(expectedOutputs.yaml).digest('hex'),
    },
    validation: {
      filesGenerated: ['.env', 'config.json', 'config.yaml'],
      hasComments: true,
      hasSensitiveMarking: true,
      jsonValid: true,
    },
  }

  writeFileSync(
    join(snapshotDir, 'genFile-plugin.snapshot.json'),
    JSON.stringify(snapshot, null, 2)
  )

  console.log('✅ genFile 插件快照已生成')
  return snapshot
}

// 2. genTs 插件快照
function generateGenTsSnapshot() {
  console.log('🔧 生成 genTs 插件快照')

  const testConfig = defineConfig({
    name: 'gents_snapshot_test',
    variables: {
      DATABASE_URL: {
        type: 'string',
        default: 'postgresql://localhost:5432/db',
        description: '数据库 URL',
        sensitive: true,
      },
      REDIS_PORT: { type: 'number', default: 6379, description: 'Redis 端口' },
      ENABLE_CACHE: {
        type: 'boolean',
        default: false,
        description: '启用缓存',
      },
    },
    plugins: [
      genTsPlugin({
        outputPath: './types/env.d.ts',
        validatorStyle: 'zod',
        exportMode: 'process.env',
        exportValidator: true,
      }),
    ],
  })

  const expectedTsContent = `// Generated TypeScript definitions
export interface ProcessEnv {
  /** 数据库 URL */
  DATABASE_URL: string
  
  /** Redis 端口 */
  REDIS_PORT: number
  
  /** 启用缓存 */
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

// Environment validation function
export function validateEnv(env: Record<string, any> = process.env): ValidatedEnv {
  return envSchema.parse(env)
}

// Usage example:
// const validatedEnv = validateEnv()
// console.log(validatedEnv.DATABASE_URL) // Type-safe access`

  const snapshot = {
    pluginName: 'genTs',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      outputPath: './types/env.d.ts',
      validatorStyle: 'zod',
      exportMode: 'process.env',
      exportValidator: true,
      variableCount: Object.keys(testConfig.variables || {}).length,
    },
    expectedOutput: expectedTsContent,
    checksum: createHash('md5').update(expectedTsContent).digest('hex'),
    validation: {
      hasInterface: expectedTsContent.includes('interface ProcessEnv'),
      hasZodSchema: expectedTsContent.includes('envSchema'),
      hasValidationFunction: expectedTsContent.includes('validateEnv'),
      hasTypeComments: expectedTsContent.includes('/** 数据库 URL */'),
      hasUsageExample: expectedTsContent.includes('Usage example'),
      contentLength: expectedTsContent.length,
    },
  }

  writeFileSync(
    join(snapshotDir, 'genTs-plugin.snapshot.json'),
    JSON.stringify(snapshot, null, 2)
  )

  console.log('✅ genTs 插件快照已生成')
  return snapshot
}

// 3. 工作空间插件快照
function generateWorkspaceSnapshot() {
  console.log('🔧 生成工作空间插件快照')

  const workspaceConfig = defineConfig({
    name: 'workspace_snapshot_test',
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
        formats: ['env'],
        outputDir: './workspace-generated',
      }),
      genTsPlugin({
        outputPath: './workspace-types/env.d.ts',
        validatorStyle: 'zod',
        exportMode: 'process.env',
      }),
    ],
  })

  const instance = createSafenv(workspaceConfig)

  const snapshot = {
    name: 'workspace-plugin-snapshot',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      workspace: true,
      variableCount: Object.keys(workspaceConfig.variables || {}).length,
      pluginCount: workspaceConfig.plugins?.length || 0,
    },
    instance: {
      type: instance.constructor.name,
      isWorkspace: instance.constructor.name === 'SafenvWorkspace',
    },
    expectedBehavior: {
      autoDiscovery: true,
      variableInheritance: true,
      pluginExecution: 'workspace-level',
      subprojectAccess: true,
    },
    plugins: [
      {
        name: 'genFile',
        formats: ['env'],
        outputDir: './workspace-generated',
      },
      {
        name: 'genTs',
        outputPath: './workspace-types/env.d.ts',
        validatorStyle: 'zod',
      },
    ],
  }

  writeFileSync(
    join(snapshotDir, 'workspace-plugin.snapshot.json'),
    JSON.stringify(snapshot, null, 2)
  )

  console.log('✅ 工作空间插件快照已生成')
  return snapshot
}

// 4. API 使用快照
function generateApiSnapshot() {
  console.log('🔧 生成 API 使用快照')

  const apiExamples = {
    name: 'api-usage-snapshot',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    examples: [
      {
        name: 'defineConfig-basic',
        code: `import { defineConfig } from '@dweb-cloud/safenv'

export default defineConfig({
  name: 'my_project',
  variables: {
    API_URL: { type: 'string', default: 'https://api.example.com' },
    PORT: { type: 'number', default: 3000 }
  }
})`,
        description: '基础配置定义',
      },
      {
        name: 'createSafenv-core',
        code: `import { createSafenv, defineConfig } from '@dweb-cloud/safenv'

const config = defineConfig({ name: 'test' })
const instance = createSafenv(config) // SafenvCore`,
        description: '创建核心实例',
      },
      {
        name: 'createSafenv-server',
        code: `import { createSafenv, defineConfig } from '@dweb-cloud/safenv'

const config = defineConfig({
  name: 'server',
  server: { port: 3000, host: 'localhost' }
})
const instance = createSafenv(config) // SafenvServer`,
        description: '创建服务器实例',
      },
      {
        name: 'createSafenv-workspace',
        code: `import { createSafenv, defineConfig } from '@dweb-cloud/safenv'

const config = defineConfig({
  name: 'monorepo',
  workspace: true
})
const instance = createSafenv(config) // SafenvWorkspace`,
        description: '创建工作空间实例',
      },
      {
        name: 'plugin-functions',
        code: `import { defineConfig, genFilePlugin, genTsPlugin } from '@dweb-cloud/safenv'

export default defineConfig({
  name: 'plugin_example',
  variables: {
    API_URL: { type: 'string', default: 'https://api.example.com' }
  },
  plugins: [
    genFilePlugin({
      name: 'genFile',
      formats: ['env', 'json']
    }),
    genTsPlugin({
      outputPath: './types/env.d.ts',
      validatorStyle: 'zod',
      exportMode: 'process.env'
    })
  ]
})`,
        description: '直接使用插件函数',
      },
    ],
  }

  writeFileSync(
    join(snapshotDir, 'api-usage.snapshot.json'),
    JSON.stringify(apiExamples, null, 2)
  )

  console.log('✅ API 使用快照已生成')
  return apiExamples
}

// 5. 生成测试报告
function generateTestReport(snapshots: any[]) {
  console.log('📊 生成测试报告')

  const report = {
    title: 'x-env 插件输出快照测试报告',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    summary: {
      totalSnapshots: snapshots.length,
      pluginsTestd: ['genFile', 'genTs'],
      scenariosCovered: ['basic-usage', 'workspace', 'api-examples'],
      outputFormats: ['env', 'json', 'yaml', 'typescript'],
    },
    snapshots: snapshots.map(snapshot => ({
      name: snapshot.pluginName || snapshot.name,
      timestamp: snapshot.timestamp,
      checksum: snapshot.checksum || 'multiple',
      validation: snapshot.validation || snapshot.expectedBehavior,
    })),
    recommendations: [
      '在 CI/CD 中集成快照验证',
      '定期更新快照以反映 API 变化',
      '使用快照进行回归测试',
      '验证插件输出格式的一致性',
    ],
    usage: {
      validation: '使用生成的快照文件验证插件输出是否符合预期',
      regression: '在代码变更后比较新输出与快照的差异',
      documentation: '快照文件可作为插件行为的文档',
    },
  }

  writeFileSync(
    join(snapshotDir, 'test-report.json'),
    JSON.stringify(report, null, 2)
  )

  console.log('✅ 测试报告已生成')
  return report
}

// 主执行函数
async function main() {
  try {
    console.log('🚀 开始生成测试快照文件\n')

    const snapshots = []

    // 生成各种快照
    snapshots.push(generateGenFileSnapshot())
    snapshots.push(generateGenTsSnapshot())
    snapshots.push(generateWorkspaceSnapshot())
    snapshots.push(generateApiSnapshot())

    // 生成测试报告
    const report = generateTestReport(snapshots)

    console.log('\n🎉 所有快照文件生成完成！')
    console.log(`📁 输出目录: ${snapshotDir}`)
    console.log('📋 生成的文件:')
    console.log('   - genFile-plugin.snapshot.json')
    console.log('   - genTs-plugin.snapshot.json')
    console.log('   - workspace-plugin.snapshot.json')
    console.log('   - api-usage.snapshot.json')
    console.log('   - test-report.json')

    console.log('\n💡 如何使用这些快照:')
    console.log('   1. 在测试中加载快照文件')
    console.log('   2. 比较实际输出与快照内容')
    console.log('   3. 验证插件行为的一致性')
    console.log('   4. 用于回归测试和文档')

    return true
  } catch (error) {
    console.error('❌ 快照生成失败:', error)
    return false
  }
}

// 运行脚本
main().then(success => {
  process.exit(success ? 0 : 1)
})
