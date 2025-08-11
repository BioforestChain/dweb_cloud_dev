import { defineConfig } from '../src/index.ts'
import { genTsPlugin } from '../src/plugins/genTs.ts'

/**
 * 声明式依赖配置示例
 * 展示新的非import语法依赖关系感知功能
 */
export default defineConfig({
  name: 'dependency_demo',

  // 变量定义
  variables: {
    APP_NAME: {
      type: 'string',
      default: 'dependency-demo',
      description: '应用名称',
    },
    PORT: {
      type: 'number',
      default: 3000,
      description: '服务端口',
    },
  },

  // 增强的依赖配置 - 支持多种声明格式
  dependencies: {
    // 显式依赖声明
    explicit: [
      '@dweb-cloud/shared-config', // npm包形式
      '../common/base.safenv.config', // 相对路径
      'workspace:base-config', // workspace内部依赖
      'npm:lodash@4.17.21', // 显式npm包版本
      'file:./config/database.json', // 文件路径
    ],

    // 条件依赖 - 基于环境或其他条件
    conditional: {
      development: {
        packages: ['npm:debug', 'file:./dev-config.json'],
        condition: 'NODE_ENV=development',
        required: false,
      },
      production: {
        packages: ['npm:newrelic', '@company/prod-config'],
        condition: context =>
          context.resolvedVariables.NODE_ENV === 'production',
        required: true,
      },
      testing: {
        packages: ['npm:jest', 'workspace:test-utils'],
        condition: 'NODE_ENV!=production',
        required: false,
      },
    },

    // 版本约束
    versions: {
      '@dweb-cloud/shared-config': '^1.0.0',
      lodash: '4.17.21',
    },

    // 冲突解决策略
    conflictResolution: 'priority',

    // 依赖优先级 - 数字越大优先级越高
    priority: {
      '@dweb-cloud/shared-config': 10, // 最高优先级
      'workspace:base-config': 5, // 中等优先级
      '../common/base.safenv.config': 1, // 低优先级
    },

    // 依赖别名
    aliases: {
      shared: '@dweb-cloud/shared-config',
      base: 'workspace:base-config',
    },

    // 排除的依赖
    exclude: ['some-old-package'],

    // 依赖加载选项
    loadOptions: {
      parallel: true, // 并行加载
      timeout: 30000, // 30秒超时
      retries: 3, // 重试3次
      cache: true, // 启用缓存
      cacheTimeout: 300000, // 缓存5分钟
    },
  },

  // 启用自动发现依赖（从package.json扫描）
  autoDependencies: true,

  // 插件配置 - 使用导入的插件函数
  plugins: [
    genTsPlugin({
      outputPath: './generated/types.ts',
      validatorStyle: 'zod',
      exportMode: 'process.env',
    }),
  ],
})
