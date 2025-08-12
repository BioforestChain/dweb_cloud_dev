import { defineConfig, genFilePlugin, genTsPlugin } from '@dweb-cloud/safenv'

export default defineConfig({
  name: 'env-examples',
  workspace: true,

  variables: {
    NODE_ENV: {
      type: 'boolean',
      default: true,
      description: 'node开发环境',
    },
  },

  plugins: [
    genFilePlugin({
      name: 'e',
      formats: ['toml'],
    }),
    genTsPlugin({
      outputPath: './pure-static.ts',
      validatorStyle: 'pure', // Pure TypeScript验证，无外部依赖
      exportMode: 'process.env-static', // 静态导出，支持tree-shaking
      exportName: 'myapp', // 变量前缀：MYAPP_API_KEY, MYAPP_MAX_CONNECTIONS
    }),
  ],
})
