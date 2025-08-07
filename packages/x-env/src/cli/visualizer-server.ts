import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NpmSafenvResolver } from '../npm-safenv-resolver.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * 依赖可视化服务器
 */
export class VisualizerServer {
  private resolver: NpmSafenvResolver
  private server: any
  private port: number

  constructor(projectPath: string = process.cwd(), port: number = 3000) {
    this.resolver = new NpmSafenvResolver(projectPath)
    this.port = port
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    this.server = createServer(async (req, res) => {
      // 设置 CORS 头
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }

      const url = new URL(req.url!, `http://localhost:${this.port}`)

      try {
        switch (url.pathname) {
          case '/':
            await this.serveHTML(res)
            break
          case '/api/dependencies':
            await this.serveDependencies(res)
            break
          case '/api/variables':
            await this.serveVariables(res)
            break
          case '/api/visualization':
            await this.serveVisualization(res)
            break
          case '/api/stats':
            await this.serveStats(res)
            break
          default:
            this.serve404(res)
        }
      } catch (error) {
        this.serveError(res, error)
      }
    })

    this.server.listen(this.port, () => {
      console.log(
        `🚀 X-Env Dependency Visualizer started at http://localhost:${this.port}`
      )
      console.log(
        `📊 Open your browser to explore environment variable dependencies`
      )
    })
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (this.server) {
      this.server.close()
      console.log('🛑 Visualizer server stopped')
    }
  }

  /**
   * 提供 HTML 页面
   */
  private async serveHTML(res: any): Promise<void> {
    try {
      const htmlPath = resolve(__dirname, '../ui/dependency-visualizer.html')
      const html = readFileSync(htmlPath, 'utf-8')

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
    } catch (error) {
      // 如果文件不存在，提供内联 HTML
      const inlineHTML = this.getInlineHTML()
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(inlineHTML)
    }
  }

  /**
   * 提供依赖配置数据
   */
  private async serveDependencies(res: any): Promise<void> {
    const configs = await this.resolver.resolveDependencySafenvConfigs()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(configs, null, 2))
  }

  /**
   * 提供变量数据
   */
  private async serveVariables(res: any): Promise<void> {
    const variables = await this.resolver.getAllDependencyVariables()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(variables, null, 2))
  }

  /**
   * 提供可视化数据
   */
  private async serveVisualization(res: any): Promise<void> {
    const visualizationData =
      await this.resolver.generateDependencyVisualization()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(visualizationData, null, 2))
  }

  /**
   * 提供统计数据
   */
  private async serveStats(res: any): Promise<void> {
    const variables = await this.resolver.getAllDependencyVariables()
    const configs = await this.resolver.resolveDependencySafenvConfigs()

    const stats = {
      totalVariables: variables.length,
      totalPackages: new Set(variables.map(v => v.source)).size,
      requiredVariables: variables.filter(v => v.required).length,
      monorepoProjects: variables.filter(v => v.category === 'monorepo').length,
      npmPackages: variables.filter(v => v.category === 'npm').length,
      variablesByType: this.groupBy(variables, 'type'),
      variablesByCategory: this.groupBy(variables, 'category'),
      packageVersions: configs.map(c => ({
        name: c.packageName,
        version: c.version,
        variableCount: Object.keys(c.variables).length,
      })),
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(stats, null, 2))
  }

  /**
   * 提供 404 响应
   */
  private serve404(res: any): void {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }

  /**
   * 提供错误响应
   */
  private serveError(res: any, error: any): void {
    console.error('Server error:', error)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
      })
    )
  }

  /**
   * 分组辅助函数
   */
  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce(
      (groups, item) => {
        const value = String(item[key])
        groups[value] = (groups[value] || 0) + 1
        return groups
      },
      {} as Record<string, number>
    )
  }

  /**
   * 获取内联 HTML（当外部文件不存在时使用）
   */
  private getInlineHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>X-Env Dependency Visualizer</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      background: #f8fafc;
    }
    .header {
      text-align: center;
      margin-bottom: 3rem;
    }
    .header h1 {
      color: #1e293b;
      margin-bottom: 0.5rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      text-align: center;
    }
    .stat-number {
      font-size: 2rem;
      font-weight: 700;
      color: #0f172a;
    }
    .stat-label {
      color: #64748b;
      font-size: 0.875rem;
    }
    .variables-list {
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .list-header {
      padding: 1.5rem;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-weight: 600;
    }
    .variable-item {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #f1f5f9;
    }
    .variable-name {
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    .variable-meta {
      font-size: 0.875rem;
      color: #64748b;
    }
    .badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
      margin-right: 0.5rem;
    }
    .badge.required { background: #fecaca; color: #dc2626; }
    .badge.optional { background: #d1fae5; color: #059669; }
    .badge.npm { background: #fef3c7; color: #d97706; }
    .badge.monorepo { background: #e0e7ff; color: #5b21b6; }
    .loading { text-align: center; padding: 2rem; color: #64748b; }
    .error { background: #fef2f2; color: #dc2626; padding: 1rem; border-radius: 0.5rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>X-Env Dependency Visualizer</h1>
    <p>Environment variable dependencies across your project</p>
  </div>

  <div class="stats-grid" id="stats">
    <div class="loading">Loading statistics...</div>
  </div>

  <div class="variables-list">
    <div class="list-header">Environment Variables</div>
    <div id="variables">
      <div class="loading">Loading variables...</div>
    </div>
  </div>

  <script>
    async function loadData() {
      try {
        // Load stats
        const statsResponse = await fetch('/api/stats')
        const stats = await statsResponse.json()
        
        document.getElementById('stats').innerHTML = \`
          <div class="stat-card">
            <div class="stat-number">\${stats.totalVariables}</div>
            <div class="stat-label">Total Variables</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">\${stats.totalPackages}</div>
            <div class="stat-label">Dependencies</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">\${stats.requiredVariables}</div>
            <div class="stat-label">Required Variables</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">\${stats.monorepoProjects}</div>
            <div class="stat-label">Monorepo Projects</div>
          </div>
        \`

        // Load variables
        const variablesResponse = await fetch('/api/variables')
        const variables = await variablesResponse.json()
        
        const variablesHTML = variables.map(v => \`
          <div class="variable-item">
            <div class="variable-name">\${v.variable}</div>
            <div class="variable-meta">
              <span class="badge \${v.required ? 'required' : 'optional'}">
                \${v.required ? 'Required' : 'Optional'}
              </span>
              <span class="badge \${v.category}">\${v.category}</span>
              Type: \${v.type} • From: \${v.source}
              \${v.defaultValue !== undefined ? \` • Default: \${v.defaultValue}\` : ''}
            </div>
            \${v.description ? \`<div style="margin-top: 0.5rem; font-size: 0.875rem; color: #64748b;">\${v.description}</div>\` : ''}
          </div>
        \`).join('')
        
        document.getElementById('variables').innerHTML = variablesHTML || '<div class="variable-item">No variables found</div>'
        
      } catch (error) {
        document.getElementById('stats').innerHTML = '<div class="error">Failed to load statistics</div>'
        document.getElementById('variables').innerHTML = '<div class="error">Failed to load variables</div>'
        console.error('Failed to load data:', error)
      }
    }

    loadData()
  </script>
</body>
</html>
    `
  }
}

/**
 * CLI 命令：启动依赖可视化服务器
 */
export async function startVisualizerCommand(
  options: {
    port?: number
    projectPath?: string
    open?: boolean
  } = {}
): Promise<void> {
  const { port = 3000, projectPath = process.cwd(), open = true } = options

  const server = new VisualizerServer(projectPath, port)

  try {
    await server.start()

    if (open) {
      // 尝试打开浏览器
      const { spawn } = await import('node:child_process')
      const url = `http://localhost:${port}`

      try {
        if (process.platform === 'darwin') {
          spawn('open', [url])
        } else if (process.platform === 'win32') {
          spawn('start', [url], { shell: true })
        } else {
          spawn('xdg-open', [url])
        }
        console.log(`🌐 Opening ${url} in your default browser...`)
      } catch (error) {
        console.log(`🌐 Please open ${url} in your browser`)
      }
    }

    // 处理退出信号
    process.on('SIGINT', async () => {
      console.log('\n👋 Shutting down...')
      await server.stop()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      await server.stop()
      process.exit(0)
    })
  } catch (error) {
    console.error('❌ Failed to start visualizer server:', error)
    process.exit(1)
  }
}
