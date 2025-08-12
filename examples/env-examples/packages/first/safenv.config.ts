import { defineConfig, genFilePlugin, genTsPlugin } from '@dweb-cloud/safenv'

export default defineConfig({
  name: 'first',

  variables: {
    API_PORT: {
      type: 'number',
      default: 8080,
      description: '端口',
    },
    API_HOST: {
      type: 'string',
      default: 'baidu.com',
      description: '主机地址',
    },
    IS_DEVELOPMENT: {
      type: 'boolean',
      default: true,
      description: '是否开发环境',
    },
  },

  plugins: [
    genFilePlugin({
      name: 'f',
      formats: ['env'],
    }),
    genTsPlugin({
      outputPath: '.',
      validatorStyle: 'zod',
    }),
  ],
})
