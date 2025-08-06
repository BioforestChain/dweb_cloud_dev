import type { SafenvConfig } from '../src/types.ts'
import { GenTsPlugin } from '../src/plugins/genTs.ts'

const config: SafenvConfig = {
  name: 'standard-schema-demo',
  description: 'Demo configuration using Standard Schema',
  variables: {
    APP_NAME: {
      type: 'string',
      description: 'Application name',
      default: 'My App',
      required: false,
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
    API_CONFIG: {
      type: 'object',
      description: 'API configuration object',
      default: { timeout: 5000 },
      required: false,
    },
  },
  plugins: [
    new GenTsPlugin({
      outputPath: './examples/generated-standard-schema.ts',
      validatorName: 'createStandardSchemaDemoSchema',
      validatorStyle: 'pure',
      exportMode: 'process.env',
      exportName: 'config',
    }),
  ],
}

export default config
