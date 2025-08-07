export default {
  variables: {
    SERVER_PORT: {
      type: 'number',
      default: 8080,
      description: 'Port for the API server',
      validate: value =>
        (value > 1000 && value < 65536) ||
        'Port must be between 1000 and 65535',
    },
    CORS_ORIGINS: {
      type: 'string',
      default: 'http://localhost:3000',
      description: 'Allowed CORS origins (comma-separated)',
      transform: value => value.split(',').map(s => s.trim()),
    },
    RATE_LIMIT_MAX: {
      type: 'number',
      default: 100,
      description: 'Maximum requests per window per IP',
    },
    RATE_LIMIT_WINDOW: {
      type: 'number',
      default: 900000,
      description: 'Rate limiting window in milliseconds (default: 15 minutes)',
    },
    JWT_EXPIRES_IN: {
      type: 'string',
      default: '7d',
      description: 'JWT token expiration time',
    },
    ENABLE_SWAGGER: {
      type: 'boolean',
      default: true,
      description: 'Enable Swagger API documentation',
    },
  },
}
