export interface DatabaseConfig {
  host: string
  port: number
  database: string
  username: string
  password: string
}

export interface DatabaseConnection {
  query: (sql: string, params?: any[]) => Promise<any>
  close: () => Promise<void>
  isConnected: () => boolean
}

export async function createDatabaseConnection(
  config: DatabaseConfig
): Promise<DatabaseConnection> {
  console.log(
    `Connecting to database: ${config.username}@${config.host}:${config.port}/${config.database}`
  )

  // 模拟数据库连接过程
  await new Promise(resolve => setTimeout(resolve, 100))

  let connected = true

  return {
    async query(sql: string, params?: any[]) {
      if (!connected) {
        throw new Error('Database connection is closed')
      }

      console.log(
        `Executing query: ${sql}`,
        params ? `with params: ${JSON.stringify(params)}` : ''
      )

      // 模拟查询结果
      return {
        rows: [],
        rowCount: 0,
        command: sql.split(' ')[0].toUpperCase(),
      }
    },

    async close() {
      console.log('Closing database connection')
      connected = false
    },

    isConnected() {
      return connected
    },
  }
}
