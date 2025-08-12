import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { SafenvCore } from './core.ts'
import { HttpImportExportAdapter, FileImportExportAdapter } from './adapters.ts'

export interface WebUIOptions {
  port: number
  host: string
  configFile?: string
  root?: string
  enableHtmlTools: boolean
  enableRemoteAPI: boolean
}

export interface ConfigMetadata {
  name: string
  path: string
  variables: Record<string, any>
  description?: string
  lastModified: Date
}

/**
 * Web UI服务器 - 提供可视化配置管理界面
 * 支持两种模式：
 * 1. HTML Tools - 使用File System Access API的纯HTML工具
 * 2. Remote API - 提供HTTP API的Web界面
 */
export class WebUIServer {
  private server?: any
  private safenvCore: SafenvCore
  private options: WebUIOptions
  private httpAdapter: HttpImportExportAdapter
  private fileAdapter: FileImportExportAdapter
  private configs = new Map<string, ConfigMetadata>()
  private isRunning = false

  constructor(options: Partial<WebUIOptions> = {}) {
    this.options = {
      port: 3030,
      host: '0.0.0.0',
      enableHtmlTools: true,
      enableRemoteAPI: true,
      ...options,
    }

    this.safenvCore = new SafenvCore({
      configFile: this.options.configFile,
      root: this.options.root,
    })

    this.httpAdapter = new HttpImportExportAdapter()
    this.fileAdapter = new FileImportExportAdapter()
  }

  /**
   * 启动Web UI服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ WebUI Server is already running')
      return
    }

    await this.scanConfigurations()
    this.server = createServer((req, res) => this.handleRequest(req, res))

    return new Promise((resolve, reject) => {
      this.server.listen(this.options.port, this.options.host, (err: any) => {
        if (err) {
          reject(err)
        } else {
          this.isRunning = true
          console.log(`🌐 SafEnv WebUI Server started`)
          console.log(`   Local:    http://localhost:${this.options.port}`)
          console.log(
            `   Network:  http://${this.options.host}:${this.options.port}`
          )
          console.log(
            `   HTML Tools: ${this.options.enableHtmlTools ? 'Enabled' : 'Disabled'}`
          )
          console.log(
            `   Remote API: ${this.options.enableRemoteAPI ? 'Enabled' : 'Disabled'}`
          )
          resolve()
        }
      })
    })
  }

  /**
   * 停止Web UI服务器
   */
  async stop(): Promise<void> {
    if (!this.server || !this.isRunning) {
      return
    }

    return new Promise(resolve => {
      this.server.close(() => {
        this.isRunning = false
        console.log('🛑 SafEnv WebUI Server stopped')
        resolve()
      })
    })
  }

  /**
   * 扫描并加载所有配置文件
   */
  private async scanConfigurations(): Promise<void> {
    const rootDir = this.options.root || process.cwd()
    const configPatterns = [
      'safenv.config.ts',
      'safenv.config.js',
      'safenv.config.json',
      'safenv.config.yaml',
      'safenv.config.yml',
    ]

    this.configs.clear()

    // 扫描根目录
    await this.scanDirectory(rootDir, configPatterns)

    // 扫描子目录（最多2层深度）
    try {
      const dirs = readdirSync(rootDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => !name.startsWith('.') && name !== 'node_modules')

      for (const dir of dirs) {
        await this.scanDirectory(join(rootDir, dir), configPatterns)
      }
    } catch (error) {
      console.warn('Failed to scan subdirectories:', error)
    }

    console.log(`📋 Found ${this.configs.size} configuration files`)
  }

  private async scanDirectory(dir: string, patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      const configPath = join(dir, pattern)
      if (existsSync(configPath)) {
        try {
          const metadata = await this.loadConfigMetadata(configPath)
          if (metadata) {
            this.configs.set(configPath, metadata)
          }
        } catch (error) {
          console.warn(`Failed to load config ${configPath}:`, error)
        }
      }
    }
  }

  private async loadConfigMetadata(
    configPath: string
  ): Promise<ConfigMetadata | null> {
    try {
      // 使用SafenvCore加载配置
      const core = new SafenvCore({
        configFile: configPath,
        root: resolve(configPath, '..'),
      })

      const config = await core.loadConfig()
      const stats = require('fs').statSync(configPath)

      return {
        name: config.name || 'Unknown',
        path: configPath,
        variables: config.variables,
        description: config.description,
        lastModified: stats.mtime,
      }
    } catch (error) {
      console.warn(`Failed to load metadata for ${configPath}:`, error)
      return null
    }
  }

  /**
   * 处理HTTP请求
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = new URL(req.url!, `http://${req.headers.host}`)
    const pathname = url.pathname

    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    )
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    try {
      // 路由处理
      if (pathname === '/' || pathname === '/index.html') {
        await this.serveWebUI(res)
      } else if (pathname === '/html-tools' || pathname === '/tools.html') {
        await this.serveHtmlTools(res)
      } else if (pathname.startsWith('/api/')) {
        await this.handleApiRequest(req, res, pathname)
      } else if (pathname.startsWith('/static/')) {
        await this.serveStaticFile(req, res, pathname)
      } else {
        this.send404(res, 'Page not found')
      }
    } catch (error) {
      this.send500(res, error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * 提供主Web UI界面
   */
  private async serveWebUI(res: ServerResponse): Promise<void> {
    const html = this.generateWebUIHTML()
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  }

  /**
   * 提供HTML Tools界面
   */
  private async serveHtmlTools(res: ServerResponse): Promise<void> {
    if (!this.options.enableHtmlTools) {
      this.send404(res, 'HTML Tools are disabled')
      return
    }

    const html = this.generateHtmlToolsHTML()
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)
  }

  /**
   * 处理API请求
   */
  private async handleApiRequest(
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string
  ): Promise<void> {
    if (!this.options.enableRemoteAPI) {
      this.sendJSON(res, { error: 'Remote API is disabled' }, 403)
      return
    }

    const segments = pathname.split('/').filter(Boolean)
    const apiVersion = segments[1] // api/v1/...
    const endpoint = segments.slice(2).join('/')

    if (apiVersion !== 'v1') {
      this.sendJSON(res, { error: 'Unsupported API version' }, 400)
      return
    }

    switch (req.method) {
      case 'GET':
        await this.handleGetRequest(res, endpoint)
        break
      case 'POST':
        await this.handlePostRequest(req, res, endpoint)
        break
      case 'PUT':
        await this.handlePutRequest(req, res, endpoint)
        break
      case 'DELETE':
        await this.handleDeleteRequest(res, endpoint)
        break
      default:
        this.sendJSON(res, { error: 'Method not allowed' }, 405)
    }
  }

  private async handleGetRequest(
    res: ServerResponse,
    endpoint: string
  ): Promise<void> {
    if (endpoint === 'configs') {
      // 获取所有配置列表
      const configList = Array.from(this.configs.values())
      this.sendJSON(res, { configs: configList })
    } else if (endpoint.startsWith('configs/')) {
      // 获取特定配置
      const configPath = decodeURIComponent(endpoint.substring(8))
      const metadata = this.configs.get(configPath)

      if (!metadata) {
        this.sendJSON(res, { error: 'Configuration not found' }, 404)
        return
      }

      this.sendJSON(res, { config: metadata })
    } else if (endpoint === 'variables') {
      // 获取当前解析的变量值
      try {
        const config = await this.safenvCore.loadConfig()
        const variables = await this.safenvCore.resolveVariables(config)
        this.sendJSON(res, { variables })
      } catch (error) {
        this.sendJSON(res, { error }, 500)
      }
    } else {
      this.sendJSON(res, { error: 'Endpoint not found' }, 404)
    }
  }

  private async handlePostRequest(
    req: IncomingMessage,
    res: ServerResponse,
    endpoint: string
  ): Promise<void> {
    const body = await this.readRequestBody(req)
    const data = JSON.parse(body)

    if (endpoint === 'variables') {
      // 更新变量值（通过环境变量）
      try {
        for (const [key, value] of Object.entries(data.variables || {})) {
          process.env[key] = String(value)
        }

        // 重新解析配置
        const config = await this.safenvCore.loadConfig()
        const variables = await this.safenvCore.resolveVariables(config)

        this.sendJSON(res, {
          message: 'Variables updated successfully',
          variables,
        })
      } catch (error) {
        this.sendJSON(res, { error }, 500)
      }
    } else if (endpoint === 'export') {
      // 导出配置
      try {
        const format = data.format || 'json'
        const config = await this.safenvCore.loadConfig()
        const variables = await this.safenvCore.resolveVariables(config)

        let content: string
        let contentType: string

        switch (format) {
          case 'json':
            content = JSON.stringify(variables, null, 2)
            contentType = 'application/json'
            break
          case 'env':
            content = Object.entries(variables)
              .map(([key, value]) => `${key}=${value}`)
              .join('\n')
            contentType = 'text/plain'
            break
          case 'yaml':
            // 简化的YAML输出
            content = Object.entries(variables)
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join('\n')
            contentType = 'text/yaml'
            break
          default:
            this.sendJSON(res, { error: 'Unsupported format' }, 400)
            return
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="safenv-export.${format}"`,
        })
        res.end(content)
      } catch (error) {
        this.sendJSON(res, { error }, 500)
      }
    } else {
      this.sendJSON(res, { error: 'Endpoint not found' }, 404)
    }
  }

  private async handlePutRequest(
    req: IncomingMessage,
    res: ServerResponse,
    _endpoint: string
  ): Promise<void> {
    // 预留用于更新配置文件
    this.sendJSON(res, { error: 'PUT operations not implemented yet' }, 501)
  }

  private async handleDeleteRequest(
    res: ServerResponse,
    _endpoint: string
  ): Promise<void> {
    // 预留用于删除配置
    this.sendJSON(res, { error: 'DELETE operations not implemented yet' }, 501)
  }

  private async readRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = ''
      req.on('data', chunk => (body += chunk))
      req.on('end', () => resolve(body))
      req.on('error', reject)
    })
  }

  private sendJSON(res: ServerResponse, data: any, status = 200): void {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data, null, 2))
  }

  private send404(res: ServerResponse, message = 'Not Found'): void {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end(message)
  }

  private send500(
    res: ServerResponse,
    message = 'Internal Server Error'
  ): void {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end(`Error: ${message}`)
  }

  private async serveStaticFile(
    req: IncomingMessage,
    res: ServerResponse,
    _pathname: string
  ): Promise<void> {
    // 简化的静态文件服务（实际应用中应该使用专门的静态文件服务器）
    this.send404(res, 'Static files not implemented')
  }

  /**
   * 生成Web UI的HTML
   */
  private generateWebUIHTML(): string {
    const configsJson = JSON.stringify(Array.from(this.configs.values()))

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SafEnv Configuration Manager</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: #2c3e50;
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.8;
            font-size: 1.1rem;
        }
        .main {
            padding: 30px;
        }
        .tabs {
            display: flex;
            border-bottom: 2px solid #ecf0f1;
            margin-bottom: 30px;
        }
        .tab {
            padding: 15px 30px;
            cursor: pointer;
            border: none;
            background: none;
            font-size: 1rem;
            color: #7f8c8d;
            border-bottom: 3px solid transparent;
            transition: all 0.3s;
        }
        .tab.active {
            color: #2c3e50;
            border-bottom-color: #3498db;
        }
        .tab:hover {
            background: #f8f9fa;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .config-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .config-card {
            border: 1px solid #ecf0f1;
            border-radius: 8px;
            padding: 20px;
            background: white;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .config-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        .config-card h3 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 1.3rem;
        }
        .config-path {
            color: #7f8c8d;
            font-size: 0.9rem;
            margin-bottom: 15px;
            word-break: break-all;
        }
        .variable-count {
            background: #3498db;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            display: inline-block;
            margin-bottom: 15px;
        }
        .config-actions {
            display: flex;
            gap: 10px;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background 0.2s;
        }
        .btn-primary {
            background: #3498db;
            color: white;
        }
        .btn-primary:hover {
            background: #2980b9;
        }
        .btn-success {
            background: #2ecc71;
            color: white;
        }
        .btn-success:hover {
            background: #27ae60;
        }
        .variables-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .variables-table th,
        .variables-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ecf0f1;
        }
        .variables-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
        }
        .variable-value {
            font-family: 'Monaco', 'Menlo', monospace;
            background: #f8f9fa;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 0.9rem;
        }
        .export-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .export-options {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        .export-options select {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 1rem;
        }
        .status {
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #7f8c8d;
        }
        @media (max-width: 768px) {
            .container {
                margin: 10px;
                border-radius: 5px;
            }
            .header {
                padding: 20px;
            }
            .header h1 {
                font-size: 2rem;
            }
            .main {
                padding: 20px;
            }
            .tabs {
                flex-wrap: wrap;
            }
            .config-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ SafEnv Configuration Manager</h1>
            <p>Universal environment variable and configuration management</p>
        </div>
        <div class="main">
            <div class="tabs">
                <button class="tab active" data-tab="configs">Configurations</button>
                <button class="tab" data-tab="variables">Variables</button>
                <button class="tab" data-tab="export">Export</button>
                <button class="tab" data-tab="tools">Tools</button>
            </div>
            
            <div id="configs" class="tab-content active">
                <h2>Configuration Files</h2>
                <div id="config-list" class="loading">Loading configurations...</div>
            </div>
            
            <div id="variables" class="tab-content">
                <h2>Environment Variables</h2>
                <div id="variables-list" class="loading">Loading variables...</div>
            </div>
            
            <div id="export" class="tab-content">
                <h2>Export Configuration</h2>
                <div class="export-section">
                    <div class="export-options">
                        <select id="export-format">
                            <option value="json">JSON</option>
                            <option value="env">.env</option>
                            <option value="yaml">YAML</option>
                        </select>
                        <button class="btn btn-success" onclick="exportConfig()">Export</button>
                    </div>
                    <div id="export-status"></div>
                </div>
            </div>
            
            <div id="tools" class="tab-content">
                <h2>Development Tools</h2>
                <div class="config-actions">
                    <a href="/html-tools" class="btn btn-primary" target="_blank">HTML Tools (Local File Access)</a>
                    <button class="btn btn-primary" onclick="refreshConfigs()">Refresh Configurations</button>
                </div>
                <p style="margin-top: 15px; color: #7f8c8d;">
                    <strong>HTML Tools:</strong> Use the File System Access API to import/export configuration files directly from your local file system.
                </p>
            </div>
        </div>
    </div>
    
    <script>
        const configs = ${configsJson};
        let variables = {};
        
        // Tab functionality
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                
                // Update active tab
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update active content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(tabId).classList.add('active');
                
                // Load content if needed
                if (tabId === 'variables' && Object.keys(variables).length === 0) {
                    loadVariables();
                }
            });
        });
        
        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            renderConfigs();
        });
        
        function renderConfigs() {
            const container = document.getElementById('config-list');
            
            if (configs.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No configuration files found</p>';
                return;
            }
            
            const html = \`
                <div class="config-grid">
                    \${configs.map(config => \`
                        <div class="config-card">
                            <h3>\${config.name}</h3>
                            <div class="config-path">\${config.path}</div>
                            <div class="variable-count">\${Object.keys(config.variables).length} variables</div>
                            \${config.description ? \`<p style="color: #7f8c8d; margin-bottom: 15px;">\${config.description}</p>\` : ''}
                            <div class="config-actions">
                                <button class="btn btn-primary" onclick="viewConfig('\${config.path}')">View Details</button>
                            </div>
                        </div>
                    \`).join('')}
                </div>
            \`;
            
            container.innerHTML = html;
        }
        
        async function loadVariables() {
            const container = document.getElementById('variables-list');
            container.innerHTML = '<div class="loading">Loading variables...</div>';
            
            try {
                const response = await fetch('/api/v1/variables');
                const data = await response.json();
                
                if (response.ok) {
                    variables = data.variables;
                    renderVariables();
                } else {
                    container.innerHTML = \`<div class="status error">Error: \${data.error}</div>\`;
                }
            } catch (error) {
                container.innerHTML = \`<div class="status error">Failed to load variables: \${error.message}</div>\`;
            }
        }
        
        function renderVariables() {
            const container = document.getElementById('variables-list');
            const entries = Object.entries(variables);
            
            if (entries.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No variables found</p>';
                return;
            }
            
            const html = \`
                <table class="variables-table">
                    <thead>
                        <tr>
                            <th>Variable</th>
                            <th>Value</th>
                            <th>Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${entries.map(([key, value]) => \`
                            <tr>
                                <td><strong>\${key}</strong></td>
                                <td><span class="variable-value">\${typeof value === 'object' ? JSON.stringify(value) : String(value)}</span></td>
                                <td>\${typeof value}</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
            
            container.innerHTML = html;
        }
        
        async function exportConfig() {
            const format = document.getElementById('export-format').value;
            const statusContainer = document.getElementById('export-status');
            
            statusContainer.innerHTML = '<div class="loading">Exporting...</div>';
            
            try {
                const response = await fetch('/api/v1/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ format })
                });
                
                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = \`safenv-export.\${format}\`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    statusContainer.innerHTML = '<div class="status success">Export successful!</div>';
                } else {
                    const data = await response.json();
                    statusContainer.innerHTML = \`<div class="status error">Export failed: \${data.error}</div>\`;
                }
            } catch (error) {
                statusContainer.innerHTML = \`<div class="status error">Export failed: \${error.message}</div>\`;
            }
        }
        
        function viewConfig(configPath) {
            const config = configs.find(c => c.path === configPath);
            if (!config) return;
            
            alert(\`Configuration: \${config.name}\\n\\nPath: \${config.path}\\n\\nVariables:\\n\${Object.keys(config.variables).map(key => \`- \${key}\`).join('\\n')}\`);
        }
        
        async function refreshConfigs() {
            window.location.reload();
        }
    </script>
</body>
</html>`
  }

  /**
   * 生成HTML Tools的HTML
   */
  private generateHtmlToolsHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SafEnv HTML Tools</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f6fa;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: #2c3e50;
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 2rem;
            margin-bottom: 10px;
        }
        .main {
            padding: 30px;
        }
        .tool-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .tool-section h2 {
            color: #2c3e50;
            margin-bottom: 15px;
        }
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1rem;
            margin-right: 10px;
            margin-bottom: 10px;
            transition: background 0.2s;
        }
        .btn-primary {
            background: #3498db;
            color: white;
        }
        .btn-primary:hover {
            background: #2980b9;
        }
        .btn-success {
            background: #2ecc71;
            color: white;
        }
        .btn-success:hover {
            background: #27ae60;
        }
        .btn:disabled {
            background: #bdc3c7;
            cursor: not-allowed;
        }
        .status {
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .status.info {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        .file-info {
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            padding: 15px;
            margin: 15px 0;
        }
        .file-info h4 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        pre {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 3px;
            padding: 10px;
            overflow-x: auto;
            font-size: 0.9rem;
        }
        .format-selector {
            margin: 15px 0;
        }
        .format-selector select {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 1rem;
            margin-left: 10px;
        }
        .browser-warning {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛠️ SafEnv HTML Tools</h1>
            <p>Local file import/export using File System Access API</p>
        </div>
        <div class="main">
            <div id="browser-check"></div>
            
            <div class="tool-section">
                <h2>Import Configuration</h2>
                <p style="margin-bottom: 15px; color: #6c757d;">
                    Select a configuration file from your local file system to import and preview.
                </p>
                <button id="import-btn" class="btn btn-primary" onclick="importFile()">Choose File to Import</button>
                <div id="import-status"></div>
                <div id="import-preview"></div>
            </div>
            
            <div class="tool-section">
                <h2>Export Configuration</h2>
                <p style="margin-bottom: 15px; color: #6c757d;">
                    Export your current configuration to a local file.
                </p>
                <div class="format-selector">
                    Export format:
                    <select id="export-format">
                        <option value="json">JSON</option>
                        <option value="env">.env</option>
                        <option value="yaml">YAML</option>
                        <option value="toml">TOML</option>
                    </select>
                </div>
                <button id="export-btn" class="btn btn-success" onclick="exportFile()">Export Configuration</button>
                <div id="export-status"></div>
            </div>
        </div>
    </div>
    
    <script>
        let currentConfig = null;
        
        // Check browser compatibility
        document.addEventListener('DOMContentLoaded', () => {
            checkBrowserSupport();
        });
        
        function checkBrowserSupport() {
            const container = document.getElementById('browser-check');
            
            if (!('showOpenFilePicker' in window) || !('showSaveFilePicker' in window)) {
                container.innerHTML = \`
                    <div class="browser-warning">
                        <strong>⚠️ Browser Compatibility Notice</strong><br>
                        This tool requires the File System Access API, which is currently supported in:
                        <ul style="margin: 10px 0 0 20px;">
                            <li>Google Chrome 86+</li>
                            <li>Microsoft Edge 86+</li>
                            <li>Opera 72+</li>
                        </ul>
                        For other browsers, please use the main Web UI interface.
                    </div>
                \`;
                
                // Disable buttons
                document.getElementById('import-btn').disabled = true;
                document.getElementById('export-btn').disabled = true;
                return;
            }
            
            container.innerHTML = \`
                <div class="status success">
                    ✅ Your browser supports the File System Access API. All features are available.
                </div>
            \`;
        }
        
        async function importFile() {
            const statusContainer = document.getElementById('import-status');
            const previewContainer = document.getElementById('import-preview');
            
            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'Configuration files',
                        accept: {
                            'application/json': ['.json'],
                            'application/x-yaml': ['.yaml', '.yml'],
                            'text/plain': ['.env', '.toml'],
                            'text/javascript': ['.js'],
                            'text/typescript': ['.ts']
                        }
                    }]
                });
                
                const file = await fileHandle.getFile();
                const content = await file.text();
                
                statusContainer.innerHTML = \`
                    <div class="status success">
                        ✅ Successfully imported: \${file.name} (\${(file.size / 1024).toFixed(1)} KB)
                    </div>
                \`;
                
                // Try to parse the content
                let parsed = null;
                let parseError = null;
                
                try {
                    if (file.name.endsWith('.json')) {
                        parsed = JSON.parse(content);
                    } else if (file.name.endsWith('.env')) {
                        parsed = parseEnvFile(content);
                    } else {
                        // For other formats, just show raw content
                        parsed = { raw: content };
                    }
                } catch (error) {
                    parseError = error.message;
                }
                
                const previewHtml = \`
                    <div class="file-info">
                        <h4>File Preview: \${file.name}</h4>
                        \${parseError ? 
                            \`<div class="status error">Parse Error: \${parseError}</div>\` :
                            \`<pre>\${typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : String(parsed)}</pre>\`
                        }
                    </div>
                \`;
                
                previewContainer.innerHTML = previewHtml;
                currentConfig = parsed;
                
            } catch (error) {
                if (error.name !== 'AbortError') {
                    statusContainer.innerHTML = \`
                        <div class="status error">
                            ❌ Import failed: \${error.message}
                        </div>
                    \`;
                }
            }
        }
        
        async function exportFile() {
            const statusContainer = document.getElementById('export-status');
            const format = document.getElementById('export-format').value;
            
            try {
                // Get current configuration from the server
                const response = await fetch('/api/v1/variables');
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error);
                }
                
                let content = '';
                let fileName = \`safenv-export.\${format}\`;
                let mimeType = 'text/plain';
                
                switch (format) {
                    case 'json':
                        content = JSON.stringify(data.variables, null, 2);
                        mimeType = 'application/json';
                        break;
                    case 'env':
                        content = Object.entries(data.variables)
                            .map(([key, value]) => \`\${key}=\${value}\`)
                            .join('\\n');
                        break;
                    case 'yaml':
                        content = Object.entries(data.variables)
                            .map(([key, value]) => \`\${key}: \${JSON.stringify(value)}\`)
                            .join('\\n');
                        break;
                    case 'toml':
                        content = Object.entries(data.variables)
                            .map(([key, value]) => \`\${key} = \${JSON.stringify(value)}\`)
                            .join('\\n');
                        break;
                }
                
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: \`\${format.toUpperCase()} files\`,
                        accept: { [mimeType]: [\`.\${format}\`] }
                    }]
                });
                
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
                
                statusContainer.innerHTML = \`
                    <div class="status success">
                        ✅ Configuration exported successfully to \${fileName}
                    </div>
                \`;
                
            } catch (error) {
                if (error.name !== 'AbortError') {
                    statusContainer.innerHTML = \`
                        <div class="status error">
                            ❌ Export failed: \${error.message}
                        </div>
                    \`;
                }
            }
        }
        
        function parseEnvFile(content) {
            const result = {};
            content.split('\\n').forEach(line => {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    const [key, ...valueParts] = line.split('=');
                    if (key && valueParts.length > 0) {
                        result[key] = valueParts.join('=');
                    }
                }
            });
            return result;
        }
    </script>
</body>
</html>`
  }
}
