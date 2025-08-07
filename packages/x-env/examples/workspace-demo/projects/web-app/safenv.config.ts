import { defineConfig } from '@dweb-cloud/safenv'

export default defineConfig({
  name: 'web-app',
  description: 'Web application configuration that depends on base service',
  // 启用自动依赖发现
  // autoDependencies: true,
  variables: {
    // Web应用特有配置
    APP_PORT: {
      type: 'number',
      description: 'Web application port',
      default: 3001,
      constraints: {
        min: 1000,
        max: 65535,
        integer: true,
      },
    },
    APP_NAME: {
      type: 'string',
      description: 'Application name',
      default: 'Web App',
      required: true,
    },
    // API配置
    API_BASE_URL: {
      type: 'string',
      description: 'Base service API URL',
      default: 'http://localhost:3000',
      constraints: {
        format: 'url',
      },
    },
    API_TIMEOUT: {
      type: 'number',
      description: 'API request timeout in milliseconds',
      default: 5000,
      constraints: {
        min: 1000,
        max: 30000,
        integer: true,
      },
    },
    // 功能开关
    ENABLE_AUTH: {
      type: 'boolean',
      description: 'Enable authentication',
      default: true,
    },
    ENABLE_ANALYTICS: {
      type: 'boolean',
      description: 'Enable analytics tracking',
      default: false,
    },
    // 前端配置
    STATIC_PATH: {
      type: 'string',
      description: 'Static files path',
      default: './public',
    },
    MAX_UPLOAD_SIZE: {
      type: 'number',
      description: 'Maximum upload size in bytes',
      default: 10485760, // 10MB
      constraints: {
        min: 1024,
        max: 104857600, // 100MB
        integer: true,
      },
    },
  },
  plugins: [
    {
      name: 'genTs',
      options: {
        outputPath: './src/generated/config.ts',
        exportName: 'WebAppConfig',
        validatorStyle: 'pure',
        exportMode: 'process.env',
      },
    },
    {
      name: 'genFile',
      options: {
        name: 'web-app',
        formats: ['env'],
      },
    },
  ],
})
