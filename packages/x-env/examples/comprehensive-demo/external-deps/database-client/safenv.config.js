export default {
  variables: {
    DATABASE_URL: {
      type: 'string',
      required: true,
      description: 'Database connection URL (PostgreSQL, MySQL, etc.)',
      validate: value => {
        const dbUrlPattern = /^(postgresql|mysql|sqlite):\/\/.+/
        return dbUrlPattern.test(value) || 'Must be a valid database URL'
      },
    },
    DB_POOL_MIN: {
      type: 'number',
      default: 2,
      description: 'Minimum number of connections in the pool',
    },
    DB_POOL_MAX: {
      type: 'number',
      default: 10,
      description: 'Maximum number of connections in the pool',
    },
    DB_POOL_IDLE_TIMEOUT: {
      type: 'number',
      default: 30000,
      description: 'Connection idle timeout in milliseconds',
    },
    DB_QUERY_TIMEOUT: {
      type: 'number',
      default: 60000,
      description: 'Query timeout in milliseconds',
    },
    ENABLE_QUERY_LOGGING: {
      type: 'boolean',
      default: false,
      description: 'Enable SQL query logging for debugging',
    },
    DB_SSL_MODE: {
      type: 'string',
      default: 'prefer',
      description: 'SSL mode for database connection',
      validate: value =>
        ['disable', 'allow', 'prefer', 'require'].includes(value) ||
        'Must be disable, allow, prefer, or require',
    },
  },
}
