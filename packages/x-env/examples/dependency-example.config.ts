import type { SafenvConfig } from '../src/types.ts'

// 这是一个模拟依赖包的配置文件示例
// 在真实场景中，这会在依赖包的根目录中
const config: SafenvConfig = {
  name: 'example-dependency',
  description: 'Example dependency configuration',
  variables: {
    API_URL: {
      type: 'string',
      description: 'API endpoint URL for the service',
      required: true,
      default: 'https://api.example.com',
    },
    API_TIMEOUT: {
      type: 'number',
      description: 'API request timeout in milliseconds',
      default: 5000,
      validate: value => value > 0 || 'Timeout must be positive',
    },
    ENABLE_CACHE: {
      type: 'boolean',
      description: 'Enable response caching',
      default: true,
    },
    ALLOWED_ORIGINS: {
      type: 'array',
      description: 'List of allowed CORS origins',
      default: ['http://localhost:3000'],
    },
  },
}

export default config
