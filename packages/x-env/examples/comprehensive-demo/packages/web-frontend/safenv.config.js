export default {
  variables: {
    API_BASE_URL: {
      type: 'string',
      required: true,
      description: 'Backend API base URL for frontend requests',
      validate: value => {
        try {
          new URL(value)
          return true
        } catch {
          return 'Must be a valid URL'
        }
      },
    },
    FRONTEND_PORT: {
      type: 'number',
      default: 3000,
      description: 'Port for frontend development server',
    },
    ENABLE_ANALYTICS: {
      type: 'boolean',
      default: false,
      description: 'Enable Google Analytics tracking',
    },
    ANALYTICS_ID: {
      type: 'string',
      required: false,
      description:
        'Google Analytics tracking ID (required if analytics enabled)',
      validate: (value, context) => {
        if (context.ENABLE_ANALYTICS && !value) {
          return 'Analytics ID is required when analytics is enabled'
        }
        return true
      },
    },
    CDN_BASE_URL: {
      type: 'string',
      default: 'https://cdn.example.com',
      description: 'CDN base URL for static assets',
    },
  },
}
