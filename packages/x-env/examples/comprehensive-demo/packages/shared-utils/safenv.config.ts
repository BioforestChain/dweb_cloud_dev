#!/usr/bin/env node --experimental-strip-types

/**
 * Shared Utils 项目配置
 *
 * 这个配置演示：
 * 1. 共享工具库的环境变量配置
 * 2. 跨项目共享的配置
 * 3. 工具库特有的配置
 */

import { defineConfig } from '../../../../dist/index.mjs'

export default defineConfig({
  name: 'shared_utils',

  // 共享工具库的环境变量
  variables: {
    // 工具库版本
    UTILS_VERSION: {
      type: 'string',
      default: '1.0.0',
      description: '工具库版本',
    },

    // 加密配置
    ENCRYPTION_ALGORITHM: {
      type: 'string',
      default: 'aes-256-gcm',
      description: '加密算法',
    },

    HASH_ROUNDS: {
      type: 'number',
      default: 12,
      description: '哈希轮数',
    },

    // 时间配置
    DEFAULT_TIMEZONE: {
      type: 'string',
      default: 'UTC',
      description: '默认时区',
    },

    DATE_FORMAT: {
      type: 'string',
      default: 'YYYY-MM-DD HH:mm:ss',
      description: '默认日期格式',
    },

    // 验证配置
    PASSWORD_MIN_LENGTH: {
      type: 'number',
      default: 8,
      description: '密码最小长度',
    },

    PASSWORD_REQUIRE_SPECIAL: {
      type: 'boolean',
      default: true,
      description: '密码是否需要特殊字符',
    },

    // 国际化配置
    DEFAULT_LOCALE: {
      type: 'string',
      default: 'en-US',
      description: '默认语言',
    },

    SUPPORTED_LOCALES: {
      type: 'string',
      default: 'en-US,zh-CN,ja-JP',
      description: '支持的语言列表',
    },

    // 工具配置
    MAX_RETRY_ATTEMPTS: {
      type: 'number',
      default: 3,
      description: '最大重试次数',
    },

    RETRY_DELAY: {
      type: 'number',
      default: 1000,
      description: '重试延迟时间（毫秒）',
    },
  },

  // 插件配置 - 为共享工具库生成配置文件
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
