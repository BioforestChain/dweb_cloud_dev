import { defineConfig } from '../src/index.ts'
import { genTsPlugin } from '../src/plugins/genTs.ts'
import { genFilePlugin } from '../src/plugins/genFile.ts'

/**
 * 全面的 SafEnv 功能测试工作空间
 * 这个配置演示并测试所有核心功能：
 *
 * 1. 完整的插件生命周期系统
 * 2. 声明式依赖关系感知
 * 3. GenTsPlugin的所有输出模式
 * 4. GenFilePlugin的多格式输出
 * 5. Web UI和HTML Tools
 * 6. 工作空间管理
 * 7. 监听和构建模式
 */

export default defineConfig({
  // 项目基础信息
  name: 'comprehensive_test_workspace',
  description: 'SafEnv 全功能测试工作空间 - 演示所有核心功能',
  root: process.cwd(),

  // 工作空间配置 - 自动发现包含 safenv.config.* 的子项目
  workspace: true,

  // 全局环境变量定义
  variables: {
    // === 基础配置 ===
    WORKSPACE_NAME: {
      type: 'string',
      default: 'comprehensive_test_workspace',
      description: '工作空间名称',
      required: true,
    },

    WORKSPACE_VERSION: {
      type: 'string',
      default: '1.0.0',
      description: '工作空间版本号',
    },

    NODE_ENV: {
      type: 'string',
      default: 'development',
      description: '运行环境 (development/production/test)',
      required: true,
    },

    // === 服务器配置 ===
    SERVER_HOST: {
      type: 'string',
      default: 'localhost',
      description: '服务器主机地址',
    },

    SERVER_PORT: {
      type: 'number',
      default: 3000,
      description: '服务器端口号',
    },

    // === 数据库配置 ===
    DATABASE_URL: {
      type: 'string',
      default: 'postgresql://localhost:5432/safenv_test',
      description: '主数据库连接字符串',
      sensitive: true,
      required: true,
    },

    DATABASE_POOL_MIN: {
      type: 'number',
      default: 2,
      description: '数据库连接池最小连接数',
    },

    DATABASE_POOL_MAX: {
      type: 'number',
      default: 20,
      description: '数据库连接池最大连接数',
    },

    // === 缓存配置 ===
    REDIS_URL: {
      type: 'string',
      default: 'redis://localhost:6379/0',
      description: 'Redis连接字符串',
    },

    CACHE_DEFAULT_TTL: {
      type: 'number',
      default: 3600,
      description: '默认缓存过期时间（秒）',
    },

    // === API配置 ===
    API_BASE_URL: {
      type: 'string',
      default: 'https://api.example.com/v1',
      description: '外部API基础URL',
    },

    API_KEY: {
      type: 'string',
      default: 'test-api-key-replace-in-production',
      description: '外部API密钥',
      sensitive: true,
      required: true,
    },

    API_TIMEOUT: {
      type: 'number',
      default: 10000,
      description: 'API请求超时时间（毫秒）',
    },

    API_RETRY_COUNT: {
      type: 'number',
      default: 3,
      description: 'API请求重试次数',
    },

    // === 安全配置 ===
    JWT_SECRET: {
      type: 'string',
      default: 'super-secret-jwt-key-change-in-production',
      description: 'JWT签名密钥',
      sensitive: true,
      required: true,
    },

    JWT_EXPIRES_IN: {
      type: 'string',
      default: '24h',
      description: 'JWT过期时间',
    },

    BCRYPT_ROUNDS: {
      type: 'number',
      default: 12,
      description: 'BCrypt加密轮数',
    },

    // === 功能开关 ===
    ENABLE_LOGGING: {
      type: 'boolean',
      default: true,
      description: '是否启用日志记录',
    },

    ENABLE_METRICS: {
      type: 'boolean',
      default: false,
      description: '是否启用指标收集',
    },

    ENABLE_TRACING: {
      type: 'boolean',
      default: false,
      description: '是否启用链路追踪',
    },

    DEBUG_MODE: {
      type: 'boolean',
      default: false,
      description: '是否启用调试模式',
    },

    FEATURE_FLAGS: {
      type: 'array',
      default: ['basic_auth', 'rate_limiting'],
      description: '启用的功能标志列表',
    },

    // === 日志配置 ===
    LOG_LEVEL: {
      type: 'string',
      default: 'info',
      description: '日志级别 (debug/info/warn/error)',
    },

    LOG_FORMAT: {
      type: 'string',
      default: 'json',
      description: '日志格式 (json/text)',
    },

    LOG_MAX_FILES: {
      type: 'number',
      default: 10,
      description: '日志文件最大保留数量',
    },

    // === 监控配置 ===
    METRICS_PORT: {
      type: 'number',
      default: 9090,
      description: '监控指标端口',
    },

    HEALTH_CHECK_PATH: {
      type: 'string',
      default: '/health',
      description: '健康检查路径',
    },

    // === CORS和安全配置 ===
    CORS_ORIGINS: {
      type: 'array',
      default: ['http://localhost:3000', 'http://localhost:3001'],
      description: 'CORS允许的源列表',
    },

    CORS_METHODS: {
      type: 'array',
      default: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      description: 'CORS允许的HTTP方法',
    },

    RATE_LIMIT_WINDOW: {
      type: 'number',
      default: 900000,
      description: '速率限制窗口时间（毫秒）',
    },

    RATE_LIMIT_MAX: {
      type: 'number',
      default: 100,
      description: '速率限制最大请求数',
    },

    // === 文件上传配置 ===
    UPLOAD_MAX_SIZE: {
      type: 'number',
      default: 52428800,
      description: '文件上传最大大小（字节）50MB',
    },

    UPLOAD_ALLOWED_TYPES: {
      type: 'array',
      default: ['image/jpeg', 'image/png', 'application/pdf'],
      description: '允许上传的文件类型',
    },

    // === 邮件配置 ===
    SMTP_HOST: {
      type: 'string',
      default: 'smtp.example.com',
      description: 'SMTP服务器地址',
    },

    SMTP_PORT: {
      type: 'number',
      default: 587,
      description: 'SMTP服务器端口',
    },

    SMTP_USER: {
      type: 'string',
      default: 'no-reply@example.com',
      description: 'SMTP用户名',
    },

    SMTP_PASS: {
      type: 'string',
      default: 'smtp-password',
      description: 'SMTP密码',
      sensitive: true,
    },

    // === 第三方服务配置 ===
    AWS_REGION: {
      type: 'string',
      default: 'us-east-1',
      description: 'AWS区域',
    },

    AWS_ACCESS_KEY_ID: {
      type: 'string',
      default: 'AKIA...',
      description: 'AWS访问密钥ID',
      sensitive: true,
    },

    AWS_SECRET_ACCESS_KEY: {
      type: 'string',
      default: 'secret-key',
      description: 'AWS私有访问密钥',
      sensitive: true,
    },

    S3_BUCKET_NAME: {
      type: 'string',
      default: 'safenv-test-bucket',
      description: 'S3存储桶名称',
    },

    // === 应用配置对象 ===
    APP_CONFIG: {
      type: 'object',
      default: {
        theme: 'light',
        language: 'zh-CN',
        timezone: 'Asia/Shanghai',
        currency: 'CNY',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm:ss',
      },
      description: '应用全局配置对象',
    },

    // === 实验性功能配置 ===
    EXPERIMENTAL_FEATURES: {
      type: 'object',
      default: {
        newUI: false,
        enhancedSecurity: true,
        betaAPI: false,
      },
      description: '实验性功能开关',
    },
  },

  // 声明式依赖配置 - 展示所有依赖格式
  dependencies: {
    // 显式依赖列表
    explicit: [
      // NPM包依赖（模拟）
      '@company/shared-config',
      '@company/auth-config',

      // 本地文件依赖
      '../shared/database.safenv.config',
      './configs/base.json',

      // Workspace内部依赖
      'workspace:common-config',
      'workspace:auth-service',
    ],

    // 条件依赖 - 基于环境动态加载
    conditional: {
      development: {
        packages: ['workspace:dev-tools', '../dev/debug.safenv.config'],
        condition: 'NODE_ENV=development',
        required: false,
      },
      production: {
        packages: ['@company/prod-monitoring', 'workspace:prod-security'],
        condition: context =>
          context.resolvedVariables.NODE_ENV === 'production',
        required: true,
      },
      testing: {
        packages: ['workspace:test-utils', '../test/fixtures.config.json'],
        condition: 'NODE_ENV=test',
        required: false,
      },
    },

    // 版本约束
    versions: {
      '@company/shared-config': '^2.1.0',
      '@company/auth-config': '~1.5.0',
    },

    // 冲突解决策略
    conflictResolution: 'priority',

    // 依赖优先级（数字越大优先级越高）
    priority: {
      '@company/shared-config': 100, // 最高优先级
      '@company/auth-config': 90,
      'workspace:common-config': 80,
      '../shared/database.safenv.config': 70,
      './configs/base.json': 60, // 最低优先级
    },

    // 依赖别名
    aliases: {
      shared: '@company/shared-config',
      auth: '@company/auth-config',
      common: 'workspace:common-config',
    },

    // 排除的依赖
    exclude: ['old-deprecated-package', 'legacy-config'],

    // 依赖加载选项
    loadOptions: {
      parallel: true, // 并行加载依赖
      timeout: 30000, // 30秒超时
      retries: 3, // 重试3次
      cache: true, // 启用缓存
      cacheTimeout: 300000, // 缓存5分钟
    },
  },

  // 启用自动发现依赖
  autoDependencies: true,

  // 插件配置 - 测试所有插件功能
  plugins: [
    // === GenTsPlugin 全面测试 ===

    // 1. Zod风格 + process.env导出
    genTsPlugin({
      outputPath: './generated/main-config.ts',
      validatorStyle: 'zod',
      exportMode: 'process.env',
      exportValidator: true,
      exportName: 'mainConfig',
      validatorName: 'MainConfigSchema',
    }),

    // 2. Pure风格 + 静态导出（tree-shaking优化）
    genTsPlugin({
      outputPath: './generated/static-exports.ts',
      validatorStyle: 'pure',
      exportMode: 'process.env-static',
      exportName: 'SAFENV',
      exportValidator: false,
    }),

    // 3. env文件加载模式
    genTsPlugin({
      outputPath: './generated/env-loader.ts',
      validatorStyle: 'zod',
      exportMode: 'env-file',
      envFilePath: 'comprehensive_test_workspace.safenv.env',
      exportName: 'envConfig',
      exportValidator: true,
    }),

    // 4. JSON文件加载（使用JSON5解析器）
    genTsPlugin({
      outputPath: './generated/json-loader.ts',
      validatorStyle: 'zod',
      exportMode: 'json-file',
      exportName: 'jsonConfig',
      customDeps: ['json5'],
      customInjectCode: ["import JSON5 from 'json5'"],
    }),

    // 5. YAML文件加载
    genTsPlugin({
      outputPath: './generated/yaml-loader.ts',
      validatorStyle: 'pure',
      exportMode: 'yaml-file',
      exportName: 'yamlConfig',
    }),

    // 6. TOML文件加载
    genTsPlugin({
      outputPath: './generated/toml-loader.ts',
      validatorStyle: 'zod',
      exportMode: 'toml-file',
      exportName: 'tomlConfig',
    }),

    // 7. 仅类型定义
    genTsPlugin({
      outputPath: './generated/types-only.ts',
      validatorStyle: 'none',
      exportValidator: false,
    }),

    // === GenFilePlugin 多格式输出测试 ===
    genFilePlugin({
      name: 'comprehensive_test_workspace',
      formats: ['env', 'json', 'yaml', 'toml'],
      outputDir: './generated/files',
      htmlTools: {
        enabled: true,
        outputPath: './generated/html-tools.html',
      },
    }),
  ],
})
