import { defineConfig } from '../src/index.ts'
import { genTsPlugin } from '../src/plugins/genTs.ts'

/**
 * GenTsPlugin输出模式完整演示
 * 展示所有支持的验证器风格和导出模式
 */

// Demo 1: Zod风格验证器 + process.env导出
export const zodProcessEnvDemo = defineConfig({
  name: 'zod_process_env_demo',

  variables: {
    NODE_ENV: {
      type: 'string',
      default: 'development',
      description: '运行环境',
      required: true,
    },
    PORT: {
      type: 'number',
      default: 3000,
      description: '服务器端口',
    },
    DEBUG: {
      type: 'boolean',
      default: false,
      description: '是否启用调试模式',
    },
  },

  plugins: [
    // 直接使用导入的插件函数
    genTsPlugin({
      outputPath: './generated/zod-process-env.ts',
      validatorStyle: 'zod', // Zod风格，按需导入优化
      exportMode: 'process.env', // 从process.env加载
      exportValidator: true, // 导出验证器
      exportName: 'config', // 配置对象名称
    }),
  ],
})

// Demo 2: Pure风格验证器 + 静态process.env导出（tree-shaking友好）
export const pureStaticDemo = defineConfig({
  name: 'pure_static_demo',

  variables: {
    API_KEY: {
      type: 'string',
      required: true,
      description: 'API密钥',
    },
    MAX_CONNECTIONS: {
      type: 'number',
      default: 100,
      description: '最大连接数',
    },
  },

  plugins: [
    genTsPlugin({
      outputPath: './generated/pure-static.ts',
      validatorStyle: 'pure', // Pure TypeScript验证，无外部依赖
      exportMode: 'process.env-static', // 静态导出，支持tree-shaking
      exportName: 'myapp', // 变量前缀：MYAPP_API_KEY, MYAPP_MAX_CONNECTIONS
    }),
  ],
})

// Demo 3: 环境文件加载
export const envFileDemo = defineConfig({
  name: 'env_file_demo',

  variables: {
    DATABASE_URL: {
      type: 'string',
      required: true,
      description: '数据库连接字符串',
    },
    REDIS_URL: {
      type: 'string',
      default: 'redis://localhost:6379',
      description: 'Redis连接字符串',
    },
  },

  plugins: [
    genTsPlugin({
      outputPath: './generated/env-file.ts',
      validatorStyle: 'zod',
      exportMode: 'env-file', // 从.env文件加载
      envFilePath: 'env_file_demo.safenv.env', // 自定义env文件路径
      exportName: 'dbConfig',
    }),
  ],
})

// Demo 4: JSON文件加载（支持自定义解析器）
export const jsonFileDemo = defineConfig({
  name: 'json_file_demo',

  variables: {
    APP_CONFIG: {
      type: 'object',
      default: {},
      description: '应用配置对象',
    },
    FEATURES: {
      type: 'array',
      default: [],
      description: '启用的功能列表',
    },
  },

  plugins: [
    genTsPlugin({
      outputPath: './generated/json-file.ts',
      validatorStyle: 'zod',
      exportMode: 'json-file', // 从JSON文件加载
      exportName: 'appConfig',
      // 使用JSON5解析器支持注释和尾随逗号
      customDeps: ['json5'],
      customInjectCode: ["import JSON5 from 'json5'"],
    }),
  ],
})

// Demo 5: YAML文件加载
export const yamlFileDemo = defineConfig({
  name: 'yaml_file_demo',

  variables: {
    SERVER_CONFIG: {
      type: 'object',
      required: true,
      description: '服务器配置',
    },
  },

  plugins: [
    genTsPlugin({
      outputPath: './generated/yaml-file.ts',
      validatorStyle: 'pure',
      exportMode: 'yaml-file', // 从YAML文件加载
      exportName: 'serverConfig',
    }),
  ],
})

// Demo 6: TOML文件加载
export const tomlFileDemo = defineConfig({
  name: 'toml_file_demo',

  variables: {
    BUILD_CONFIG: {
      type: 'object',
      default: {},
      description: '构建配置',
    },
  },

  plugins: [
    genTsPlugin({
      outputPath: './generated/toml-file.ts',
      validatorStyle: 'zod',
      exportMode: 'toml-file', // 从TOML文件加载
      exportName: 'buildConfig',
    }),
  ],
})

// Demo 7: 只生成类型定义，不生成验证器
export const typesOnlyDemo = defineConfig({
  name: 'types_only_demo',

  variables: {
    USER_ID: {
      type: 'string',
      required: true,
    },
    SETTINGS: {
      type: 'object',
      default: {},
    },
  },

  plugins: [
    genTsPlugin({
      outputPath: './generated/types-only.ts',
      validatorStyle: 'none', // 不生成验证器
      exportMode: undefined, // 不生成导出代码
      exportValidator: false, // 不导出验证器
    }),
  ],
})

// Demo 8: 自定义验证器名称和导出名称
export const customNamesDemo = defineConfig({
  name: 'custom_names_demo',

  variables: {
    SECRET_KEY: {
      type: 'string',
      required: true,
      description: '密钥',
    },
  },

  plugins: [
    genTsPlugin({
      outputPath: './generated/custom-names.ts',
      validatorStyle: 'zod',
      exportMode: 'process.env',
      validatorName: 'customValidator', // 自定义验证器名称
      exportName: 'secrets', // 自定义导出名称
      exportValidator: true,
    }),
  ],
})

export default zodProcessEnvDemo
