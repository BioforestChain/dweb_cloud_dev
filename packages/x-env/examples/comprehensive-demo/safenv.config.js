export default {
  variables: {
    NODE_ENV: {
      type: 'string',
      default: 'development',
      description: 'Application environment (development, staging, production)',
      validate: value =>
        ['development', 'staging', 'production'].includes(value),
    },
    APP_NAME: {
      type: 'string',
      default: 'X-Env Demo App',
      description: 'Application name for logging and monitoring',
    },
    LOG_LEVEL: {
      type: 'string',
      default: 'info',
      description: 'Logging level (debug, info, warn, error)',
      validate: value => ['debug', 'info', 'warn', 'error'].includes(value),
    },
    ENABLE_METRICS: {
      type: 'boolean',
      default: false,
      description: 'Enable application metrics collection',
    },
  },
  plugins: [
    {
      name: 'dependency-resolver',
      apply: () => ({
        beforeResolve: _context => {
          console.log('🔍 Resolving dependencies for main project...')
        },
        afterResolve: _context => {
          console.log('✅ Main project dependencies resolved')
        },
      }),
    },
  ],
}
