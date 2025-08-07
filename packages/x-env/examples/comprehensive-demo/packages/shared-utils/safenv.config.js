export default {
  variables: {
    LOGGER_LEVEL: {
      type: 'string',
      default: 'info',
      description: 'Logging level for shared utilities',
      validate: value =>
        ['debug', 'info', 'warn', 'error'].includes(value) ||
        'Must be debug, info, warn, or error',
    },
    ENABLE_PERFORMANCE_TRACKING: {
      type: 'boolean',
      default: false,
      description: 'Enable performance tracking in shared utilities',
    },
    CACHE_TTL: {
      type: 'number',
      default: 300000,
      description: 'Default cache TTL in milliseconds (5 minutes)',
    },
    MAX_RETRY_ATTEMPTS: {
      type: 'number',
      default: 3,
      description: 'Maximum retry attempts for failed operations',
    },
  },
}
