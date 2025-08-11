import { defineConfig } from '../src/index.ts'
import { genTsPlugin } from '../src/plugins/genTs.ts'
import { genFilePlugin } from '../src/plugins/genFile.ts'

/**
 * Web UI 功能完整演示
 * 展示 HTML Tools 和 Remote API 功能
 */

// 基础配置用于演示
export const webUIDemo = defineConfig({
  name: 'web_ui_demo',
  description: 'Web UI功能演示配置',

  variables: {
    // 基础应用配置
    APP_NAME: {
      type: 'string',
      default: 'SafEnv Demo App',
      description: '应用名称',
      required: true,
    },
    APP_VERSION: {
      type: 'string',
      default: '1.0.0',
      description: '应用版本',
    },
    NODE_ENV: {
      type: 'string',
      default: 'development',
      description: '运行环境 (development/production/test)',
    },

    // 服务器配置
    PORT: {
      type: 'number',
      default: 3000,
      description: '服务器端口',
    },
    HOST: {
      type: 'string',
      default: 'localhost',
      description: '服务器主机',
    },

    // 数据库配置
    DATABASE_URL: {
      type: 'string',
      default: 'postgresql://localhost:5432/safenv_demo',
      description: '数据库连接字符串',
      sensitive: true,
    },
    DB_POOL_SIZE: {
      type: 'number',
      default: 10,
      description: '数据库连接池大小',
    },

    // 缓存配置
    REDIS_URL: {
      type: 'string',
      default: 'redis://localhost:6379',
      description: 'Redis连接字符串',
    },
    CACHE_TTL: {
      type: 'number',
      default: 3600,
      description: '缓存过期时间（秒）',
    },

    // 功能开关
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
    DEBUG_MODE: {
      type: 'boolean',
      default: false,
      description: '是否启用调试模式',
    },

    // 数组和对象类型演示
    ALLOWED_ORIGINS: {
      type: 'array',
      default: ['http://localhost:3000', 'http://localhost:3001'],
      description: 'CORS允许的源列表',
    },
    APP_CONFIG: {
      type: 'object',
      default: {
        theme: 'light',
        language: 'zh-CN',
        timezone: 'Asia/Shanghai',
      },
      description: '应用配置对象',
    },

    // API配置
    API_KEY: {
      type: 'string',
      default: 'demo-api-key-change-in-production',
      description: '外部API密钥',
      sensitive: true,
      required: true,
    },
    API_TIMEOUT: {
      type: 'number',
      default: 5000,
      description: 'API请求超时时间（毫秒）',
    },
  },

  plugins: [
    // 生成TypeScript类型文件 - 使用导入的插件函数
    genTsPlugin({
      outputPath: './generated/web-ui-demo.ts',
      validatorStyle: 'zod',
      exportMode: 'process.env',
      exportName: 'webUIConfig',
    }),

    // 生成配置文件 - 使用导入的插件函数
    genFilePlugin({
      name: 'web_ui_demo',
      formats: ['env', 'json', 'yaml'],
      outputDir: './generated',
      htmlTools: {
        enabled: true,
        outputPath: './tools.html',
      },
    }),
  ],
})

/**
 * 启动Web UI服务器的演示函数
 */
export async function startWebUIDemo() {
  console.log('🚀 启动 SafEnv Web UI 演示...')

  // 注意：WebUIServer 暂时被注释掉了，因为有解析问题
  console.log('⚠️  WebUIServer 功能暂时不可用，请等待修复')

  console.log('\n📖 Web UI 功能说明:')
  console.log('   • 主界面: 查看配置文件列表，实时查看变量值')
  console.log('   • 变量管理: 查看所有解析后的环境变量')
  console.log('   • 导出功能: 支持导出为JSON、.env、YAML格式')
  console.log('   • HTML Tools: 使用File System Access API进行本地文件操作')

  console.log('\n🔧 API 端点:')
  console.log('   GET /api/v1/configs      - 获取配置列表')
  console.log('   GET /api/v1/variables    - 获取变量值')
  console.log('   POST /api/v1/export      - 导出配置')

  console.log('\n💡 使用提示:')
  console.log('   1. 在主界面查看当前加载的配置文件')
  console.log('   2. 点击"Variables"标签页查看所有环境变量')
  console.log('   3. 使用"Export"功能导出配置到不同格式')
  console.log('   4. 点击"HTML Tools"使用本地文件导入/导出功能')
  console.log('      （需要支持File System Access API的浏览器）')
}

// 如果直接运行此文件，启动演示
if (import.meta.main) {
  startWebUIDemo()
}

export default webUIDemo
