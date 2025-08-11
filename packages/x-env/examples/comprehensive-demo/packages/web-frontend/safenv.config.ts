#!/usr/bin/env node --experimental-strip-types

/**
 * Web Frontend 项目配置
 *
 * 这个配置演示：
 * 1. 子项目如何继承工作空间的全局变量
 * 2. 子项目特有的环境变量定义
 * 3. 依赖其他子项目的变量
 */

import { defineConfig } from '../../../../dist/index.mjs'

export default defineConfig({
  name: 'web_frontend',

  // 子项目特有的环境变量
  variables: {
    // 前端服务配置
    FRONTEND_PORT: {
      type: 'number',
      default: 3000,
      description: '前端服务端口',
    },

    FRONTEND_HOST: {
      type: 'string',
      default: '0.0.0.0',
      description: '前端服务主机',
    },

    // API 配置 - 依赖 api-backend 项目
    API_BASE_URL: {
      type: 'string',
      default: 'http://localhost:8080/api',
      description: 'API 基础 URL',
    },

    // 前端特有配置
    PUBLIC_APP_NAME: {
      type: 'string',
      default: 'Comprehensive Demo App',
      description: '应用名称（公开）',
    },

    PUBLIC_APP_VERSION: {
      type: 'string',
      default: '1.0.0',
      description: '应用版本（公开）',
    },

    // 构建配置
    BUILD_OUTPUT_DIR: {
      type: 'string',
      default: './dist',
      description: '构建输出目录',
    },

    ENABLE_SOURCE_MAPS: {
      type: 'boolean',
      default: true,
      description: '是否启用源码映射',
    },

    // 开发配置
    HOT_RELOAD: {
      type: 'boolean',
      default: true,
      description: '是否启用热重载',
    },

    MOCK_API: {
      type: 'boolean',
      default: false,
      description: '是否使用模拟 API',
    },
  },

  // 插件配置 - 为前端项目生成特定的配置文件
  plugins: [
    {
      name: 'genFile',
      options: {
        formats: ['env', 'json'],
        outputDir: './config',
      },
    },

    {
      name: 'genTs',
      options: {
        outputPath: './src/config',
        validatorStyle: 'zod' as const,
        exportMode: 'process.env' as const,
        exportValidator: true,
      },
    },
  ],
})
