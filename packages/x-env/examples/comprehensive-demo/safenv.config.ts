#!/usr/bin/env node --experimental-strip-types

/**
 * Safenv 工作空间配置 - TypeScript 版本
 *
 * 这个配置演示了新版 API 的以下功能：
 * 1. defineConfig 提供类型安全的配置定义
 * 2. 工作空间自动发现子项目配置
 * 3. genFile 和 genTs 插件的完整功能
 * 4. 变量继承和依赖管理
 */

import { defineConfig } from '../../dist/index.mjs'

export default defineConfig({
  // 项目基础信息
  name: 'comprehensive_workspace',
  root: process.cwd(),

  // 工作空间配置 - 自动发现包含 safenv.config.* 的子项目
  workspace: true,

  // 全局环境变量 - 所有子项目都可以访问
  variables: {
    // 基础环境配置
    NODE_ENV: {
      type: 'string',
      default: 'development',
      description: '运行环境',
    },

    // 工作空间级别配置
    WORKSPACE_NAME: {
      type: 'string',
      default: 'comprehensive_workspace',
      description: '工作空间名称',
    },

    WORKSPACE_VERSION: {
      type: 'string',
      default: '1.0.0',
      description: '工作空间版本',
    },

    // 共享服务配置
    DATABASE_URL: {
      type: 'string',
      default: 'postgresql://localhost:5432/comprehensive_db',
      description: '数据库连接字符串',
      sensitive: true,
    },

    REDIS_URL: {
      type: 'string',
      default: 'redis://localhost:6379',
      description: 'Redis 连接字符串',
    },

    // 日志配置
    LOG_LEVEL: {
      type: 'string',
      default: 'info',
      description: '日志级别',
    },

    // 监控配置
    MONITORING_ENABLED: {
      type: 'boolean',
      default: true,
      description: '是否启用监控',
    },

    METRICS_PORT: {
      type: 'number',
      default: 9090,
      description: '监控指标端口',
    },

    // 安全配置
    JWT_SECRET: {
      type: 'string',
      default: 'your-super-secret-jwt-key-change-in-production',
      description: 'JWT 签名密钥',
      sensitive: true,
    },

    CORS_ORIGINS: {
      type: 'string',
      default: 'http://localhost:3000,http://localhost:3001',
      description: 'CORS 允许的源',
    },
  },

  // 插件配置 - 测试 genFile 和 genTs 插件
  plugins: [
    // genFile 插件 - 生成多种格式的环境变量文件
    {
      name: 'genFile',
      options: {
        formats: ['env', 'json', 'yaml'],
        outputDir: './generated',
      },
    },

    // genTs 插件 - 生成 TypeScript 类型定义和验证
    {
      name: 'genTs',
      options: {
        outputPath: './types',
        validatorStyle: 'zod' as const,
        exportMode: 'process.env' as const,
        exportValidator: true,
      },
    },
  ],
})
