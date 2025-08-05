import { GenFilePlugin, GenTsPlugin } from '@dweb-cloud/safenv'
import type { SafenvConfig } from '@dweb-cloud/safenv'

const config: SafenvConfig = {
  name: 'my_project',
  description: 'Example safenv configuration',
  variables: {
    NODE_ENV: {
      type: 'string',
      description: 'Node environment',
      default: 'development',
      required: true,
      validate: value =>
        ['development', 'production', 'test'].includes(value) ||
        'Must be development, production, or test',
    },
    PORT: {
      type: 'number',
      description: 'Server port',
      default: 3000,
      required: false,
    },
    DATABASE_URL: {
      type: 'string',
      description: 'Database connection URL',
      required: true,
    },
    FEATURE_FLAGS: {
      type: 'array',
      description: 'Enabled feature flags',
      default: [],
      required: false,
    },
    DEBUG: {
      type: 'boolean',
      description: 'Enable debug mode',
      default: false,
      required: false,
    },
  },
  plugins: [
    new GenFilePlugin({
      name: 'my_project',
      formats: ['env', 'json'],
    }),
    new GenTsPlugin({
      outputPath: './src/config/safenv.ts',
      validatorStyle: 'zod',
      exportMode: 'process.env',
      exportName: 'config',
    }),
  ],
}

export default config
