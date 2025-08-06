import { GenFilePlugin, GenTsPlugin } from '../src/plugins/index.ts'
import type { SafenvConfig } from '../src/types.ts'

const config: SafenvConfig = {
  name: 'ui-demo',
  description: 'Demo configuration for UI testing',
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
    API_KEY: {
      type: 'string',
      description: 'API key for external services',
      required: false,
    },
  },
  plugins: [
    new GenFilePlugin({
      name: 'ui-demo',
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
