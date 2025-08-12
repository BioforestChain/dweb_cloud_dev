import { defineConfig, genFilePlugin, genTsPlugin } from '@dweb-cloud/safenv'

export default defineConfig({
  name: 'second',

  variables: {
    API_PORT: {
      type: 'number',
      default: 9090,
      description: '端口',
    },
    API_HOST: {
      type: 'string',
      default: 'x.com',
      description: '主机地址',
    },
    IS_DEVELOPMENT: {
      type: 'boolean',
      default: false,
      description: '是否开发环境',
    },
  },

  plugins: [
    genFilePlugin({
      name: 's',
      formats: ['json'],
    }),
    genTsPlugin({
      outputPath: './json-file.ts',
      validatorStyle: 'zod',
      exportMode: 'json-file', // 从.env文件加载
      envFilePath: 'env_file_demo.safenv.env', // 自定义env文件路径
      exportName: 's',
    }),
  ],
})
