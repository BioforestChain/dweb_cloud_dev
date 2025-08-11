#!/usr/bin/env node --experimental-strip-types

/**
 * Safenv defineConfig 配置示例
 *
 * 这个示例展示了使用 defineConfig 的简化配置方式：
 * - defineConfig 提供类型安全的配置定义
 * - createSafenv 基于配置创建相应实例
 * - 简洁的配置结构，专注于 VAL 管理
 */

import {
  defineConfig,
  createSafenv,
  genFilePlugin,
  genTsPlugin,
} from '../src/index.js'

console.log('🌱 Safenv defineConfig 配置示例\n')

// 1. 单项目配置
console.log('1️⃣ 单项目配置:')
const singleProjectConfig = defineConfig({
  name: 'my_app',
  variables: {
    NODE_ENV: { type: 'string', default: 'development' },
    API_URL: { type: 'string', default: 'https://api.example.com' },
    DEBUG: { type: 'boolean', default: true },
    PORT: { type: 'number', default: 3000 },
  },
  plugins: [
    // 直接使用插件函数，而不是字符串名称
    genFilePlugin({
      name: 'genFile',
      formats: ['env', 'json'],
    }),
    genTsPlugin({
      outputPath: './types/env.d.ts',
      validatorStyle: 'zod',
      exportMode: 'process.env',
    }),
  ],
})

const singleProject = createSafenv(singleProjectConfig)
console.log(`   ✅ 单项目实例: ${singleProject.constructor.name}`)
console.log('   🔧 配置: my_app, 4个变量, 2个插件\n')

// 2. 自动发现工作空间配置
console.log('2️⃣ 自动发现工作空间:')
const autoWorkspaceConfig = defineConfig({
  name: 'monorepo',
  workspace: true, // 自动发现子目录中的 safenv.config.*

  server: {
    port: 3000,
    host: '0.0.0.0',
  },

  variables: {
    NODE_ENV: { type: 'string', default: 'development' },
    LOG_LEVEL: { type: 'string', default: 'debug' },
    WORKSPACE_ROOT: { type: 'string', default: process.cwd() },
  },

  plugins: [
    {
      name: 'genFile',
      options: {
        formats: ['env'],
      },
    },
  ],
})

const autoWorkspace = createSafenv(autoWorkspaceConfig)
console.log(`   ✅ 自动发现工作空间: ${autoWorkspace.constructor.name}`)
console.log('   🔍 自动扫描: ./*/safenv.config.*, ./packages/*/safenv.config.*')
console.log('   🌐 服务器: 端口 3000, 主机 0.0.0.0\n')

// 3. 指定路径工作空间配置
console.log('3️⃣ 指定路径工作空间:')
const explicitWorkspaceConfig = defineConfig({
  name: 'explicit_monorepo',
  workspace: [
    './apps/frontend',
    './apps/backend',
    './packages/shared',
    './tools/build',
  ],

  server: {
    port: 3001,
    host: 'localhost',
  },

  variables: {
    WORKSPACE_NAME: { type: 'string', default: 'explicit_monorepo' },
    BUILD_TIME: { type: 'string', default: new Date().toISOString() },
    PROJECTS_COUNT: { type: 'number', default: 4 },
  },

  plugins: [
    {
      name: 'genFile',
      options: {
        formats: ['env', 'json', 'yaml'],
      },
    },
    {
      name: 'genTs',
      options: {
        validatorStyle: 'pure' as const,
        exportMode: 'process.env-static' as const,
      },
    },
  ],
})

const explicitWorkspace = createSafenv(explicitWorkspaceConfig)
console.log(`   ✅ 指定路径工作空间: ${explicitWorkspace.constructor.name}`)
console.log('   📁 指定路径: 4个项目路径')
console.log('   🌐 服务器: 端口 3001, 主机 localhost\n')

// 4. 服务器配置
console.log('4️⃣ 服务器配置:')
const serverConfig = defineConfig({
  name: 'server_project',

  server: {
    port: 3002,
    host: '0.0.0.0',
  },

  variables: {
    SERVER_PORT: { type: 'number', default: 8080 },
    CORS_ORIGIN: { type: 'string', default: 'https://example.com' },
    JWT_SECRET: { type: 'string', default: 'your-secret-key', sensitive: true },
    DATABASE_URL: {
      type: 'string',
      default: 'postgresql://localhost:5432/mydb',
      sensitive: true,
    },
  },

  plugins: [
    {
      name: 'genTs',
      options: {
        validatorStyle: 'zod' as const,
        exportMode: 'env-file' as const,
      },
    },
    {
      name: 'genFile',
      options: {
        formats: ['env'],
      },
    },
  ],
})

const serverProject = createSafenv(serverConfig)
console.log(`   ✅ 服务器项目: ${serverProject.constructor.name}`)
console.log('   🌐 服务器: 端口 3002, 主机 0.0.0.0')
console.log('   🔐 包含敏感配置: JWT_SECRET, DATABASE_URL\n')

console.log('🎉 defineConfig 配置示例完成!\n')

console.log('💡 defineConfig 优势:')
console.log('   ✅ 类型安全: 完整的 TypeScript 类型检查')
console.log('   ✅ 智能提示: IDE 自动补全和错误检测')
console.log('   ✅ 配置分离: 配置定义与实例创建分离')
console.log('   ✅ 可复用: 配置可以导出、导入和组合\n')

console.log('🔧 使用模式:')
console.log('   • defineConfig() - 定义类型安全的配置')
console.log('   • createSafenv() - 基于配置创建实例')
console.log('   • workspace: true - 自动发现子项目')
console.log('   • workspace: ["path"] - 指定项目路径')
console.log('   • server 配置 - Web UI/HTML Tools 服务\n')

console.log('🌟 这样的 API 设计更加现代和易用!')
