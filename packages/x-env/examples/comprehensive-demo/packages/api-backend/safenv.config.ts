#!/usr/bin/env node --experimental-strip-types

/**
 * API Backend 项目配置
 *
 * 这个配置演示：
 * 1. 后端服务的环境变量配置
 * 2. 数据库和缓存配置
 * 3. 安全和认证配置
 */

import { defineConfig } from '../../../../src/index.ts'
import { genFilePlugin } from '../../../../src/plugins/genFile.ts'
import { genTsPlugin } from '../../../../src/plugins/genTs.ts'

export default defineConfig({
  name: 'api_backend',

  // 后端服务特有的环境变量
  variables: {
    // 服务配置
    API_PORT: {
      type: 'number',
      default: 8080,
      description: 'API 服务端口',
    },

    API_HOST: {
      type: 'string',
      default: '0.0.0.0',
      description: 'API 服务主机',
    },

    // 数据库配置 - 继承工作空间的 DATABASE_URL，添加特定配置
    DB_POOL_SIZE: {
      type: 'number',
      default: 10,
      description: '数据库连接池大小',
    },

    DB_TIMEOUT: {
      type: 'number',
      default: 30000,
      description: '数据库连接超时时间（毫秒）',
    },

    // 缓存配置
    CACHE_TTL: {
      type: 'number',
      default: 3600,
      description: '缓存过期时间（秒）',
    },

    // API 限流配置
    RATE_LIMIT_WINDOW: {
      type: 'number',
      default: 900000,
      description: '限流时间窗口（毫秒）',
    },

    RATE_LIMIT_MAX: {
      type: 'number',
      default: 100,
      description: '限流最大请求数',
    },

    // 文件上传配置
    UPLOAD_MAX_SIZE: {
      type: 'string',
      default: '10mb',
      description: '文件上传最大大小',
    },

    UPLOAD_ALLOWED_TYPES: {
      type: 'string',
      default: 'image/jpeg,image/png,image/gif,application/pdf',
      description: '允许的文件类型',
    },

    // 邮件服务配置
    SMTP_HOST: {
      type: 'string',
      default: 'localhost',
      description: 'SMTP 服务器主机',
    },

    SMTP_PORT: {
      type: 'number',
      default: 587,
      description: 'SMTP 服务器端口',
    },

    SMTP_USER: {
      type: 'string',
      default: '',
      description: 'SMTP 用户名',
      sensitive: true,
    },

    SMTP_PASS: {
      type: 'string',
      default: '',
      description: 'SMTP 密码',
      sensitive: true,
    },
  },

  // 插件配置 - 为后端项目生成特定的配置文件 - 使用导入的插件函数
  plugins: [
    genFilePlugin({
      name: 'api_backend',
      formats: ['env', 'json', 'yaml'],
      outputDir: './config',
    }),

    genTsPlugin({
      outputPath: './src/config.ts',
      validatorStyle: 'zod' as const,
      exportMode: 'process.env' as const,
      exportValidator: true,
    }),
  ],
})
