import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { SafenvCore } from './core.ts'
import type { SafenvConfig, SafenvContext } from './types.ts'
import type { GenFilePluginOptions } from './plugins/types.ts'

export type UIMode = 'remote' | 'local' | 'auto'

export interface UIServerOptions {
  port?: number
  host?: string
  configFile?: string
  outputDir?: string
  mode?: UIMode
}

export class UIServer {
  private server?: any
  private safenvCore: SafenvCore
  private config?: SafenvConfig
  private context?: SafenvContext
  private availableConfigs: string[] = []
  private uiMode: UIMode

  constructor(private options: UIServerOptions = {}) {
    this.safenvCore = new SafenvCore({
      configFile: options.configFile,
      outputDir: options.outputDir,
      mode: 'serve',
    })
    this.uiMode = this.determineUIMode(options.mode || 'auto')
  }

  private determineUIMode(requestedMode: UIMode): UIMode {
    if (requestedMode === 'remote' || requestedMode === 'local') {
      return requestedMode
    }

    // Auto-detect mode based on environment
    // In a server environment, prefer remote mode
    // In a development environment with modern browser support, prefer local mode
    return 'remote' // Default to remote for now, can be made smarter later
  }

  private async findAvailableConfigs(): Promise<string[]> {
    const fs = require('node:fs')
    const path = require('node:path')

    const configPatterns = [
      'safenv.config.ts',
      'safenv.config.js',
      'safenv.config.json',
      'safenv.config.yaml',
      'safenv.config.yml',
    ]

    const configs: string[] = []

    // Check current directory
    for (const pattern of configPatterns) {
      if (fs.existsSync(pattern)) {
        configs.push(pattern)
      }
    }

    // Check examples directory if it exists
    if (fs.existsSync('examples')) {
      const exampleFiles = fs.readdirSync('examples')
      for (const file of exampleFiles) {
        if (
          file.includes('config') &&
          (file.endsWith('.ts') ||
            file.endsWith('.js') ||
            file.endsWith('.json'))
        ) {
          configs.push(`examples/${file}`)
        }
      }
    }

    return configs
  }

  async start(): Promise<void> {
    // Find available configurations
    this.availableConfigs = await this.findAvailableConfigs()

    // Try to load configuration if specified or found
    if (this.options.configFile || this.availableConfigs.length > 0) {
      try {
        this.config = await this.safenvCore.loadConfig()
        const resolvedVariables = await this.safenvCore.resolveVariables(
          this.config
        )

        this.context = {
          config: this.config,
          resolvedVariables,
          mode: 'serve',
          outputDir: resolve(this.options.outputDir || './dist'),
        }
      } catch (error) {
        console.warn(
          'Failed to load initial config:',
          error instanceof Error ? error.message : String(error)
        )
      }
    }

    const port = this.options.port || 3000
    const host = this.options.host || 'localhost'

    this.server = createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }

      const url = new URL(req.url!, `http://${host}:${port}`)

      if (url.pathname === '/api/config') {
        await this.handleConfigApi(req, res)
      } else if (url.pathname === '/api/configs') {
        await this.handleConfigsApi(req, res)
      } else if (url.pathname === '/api/switch-config') {
        await this.handleSwitchConfigApi(req, res)
      } else if (url.pathname === '/api/import-config') {
        await this.handleImportConfigApi(req, res)
      } else if (url.pathname === '/api/export-config') {
        await this.handleExportConfigApi(req, res)
      } else if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(this.generateWebUiHtml())
      } else if (url.pathname === '/favicon.ico') {
        res.writeHead(204)
        res.end()
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
    })

    this.server.listen(port, host, () => {
      console.log(`🎨 Safenv Web UI running at http://${host}:${port}`)
      console.log(
        `📝 Editing configuration: ${this.config?.name || 'No config loaded'}`
      )
      console.log(
        `🔧 UI Mode: ${this.uiMode} (${this.uiMode === 'local' ? 'File System Access API' : 'HTTP-based'})`
      )
    })
  }

  private async handleConfigApi(req: any, res: any): Promise<void> {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          config: this.context?.config,
          resolvedVariables: this.context?.resolvedVariables,
          currentConfigFile: this.options.configFile || 'No config loaded',
        })
      )
    } else if (req.method === 'POST') {
      let body = ''
      req.on('data', (chunk: any) => {
        body += chunk
      })
      req.on('end', async () => {
        try {
          const { variables } = JSON.parse(body)
          await this.updateConfigFiles(variables)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            })
          )
        }
      })
    }
  }

  private async handleConfigsApi(req: any, res: any): Promise<void> {
    if (req.method === 'GET') {
      // Refresh available configs
      this.availableConfigs = await this.findAvailableConfigs()

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          availableConfigs: this.availableConfigs,
          currentConfig: this.options.configFile,
        })
      )
    }
  }

  private async handleSwitchConfigApi(req: any, res: any): Promise<void> {
    if (req.method === 'POST') {
      let body = ''
      req.on('data', (chunk: any) => {
        body += chunk
      })
      req.on('end', async () => {
        try {
          const { configFile } = JSON.parse(body)

          // Update the config file option
          this.options.configFile = configFile

          // Create new SafenvCore with the new config
          this.safenvCore = new SafenvCore({
            configFile: configFile,
            outputDir: this.options.outputDir,
            mode: 'serve',
          })

          // Load the new configuration
          this.config = await this.safenvCore.loadConfig()

          // Try to resolve variables, but don't fail if some are missing
          let resolvedVariables: Record<string, any> = {}
          try {
            resolvedVariables = await this.safenvCore.resolveVariables(
              this.config
            )
          } catch (error) {
            // If variable resolution fails, use defaults
            console.warn(
              'Variable resolution failed, using defaults:',
              error instanceof Error ? error.message : String(error)
            )
            Object.entries(this.config.variables || {}).forEach(
              ([key, variable]) => {
                resolvedVariables[key] = variable.default || ''
              }
            )
          }

          this.context = {
            config: this.config,
            resolvedVariables,
            mode: 'serve',
            outputDir: resolve(this.options.outputDir || './dist'),
          }

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              success: true,
              config: this.config,
              resolvedVariables: resolvedVariables,
            })
          )
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            })
          )
        }
      })
    }
  }

  private async handleImportConfigApi(req: any, res: any): Promise<void> {
    if (req.method === 'GET') {
      try {
        if (!this.context?.resolvedVariables) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'No configuration loaded' }))
          return
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            variables: this.context.resolvedVariables,
          })
        )
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          })
        )
      }
    }
  }

  private async handleExportConfigApi(req: any, res: any): Promise<void> {
    if (req.method === 'POST') {
      let body = ''
      req.on('data', (chunk: any) => {
        body += chunk
      })
      req.on('end', async () => {
        try {
          const { variables, format = 'json', filename } = JSON.parse(body)

          let content: string
          let contentType: string
          let fileExtension: string

          switch (format) {
            case 'env':
              content = this.generateEnvFile(variables)
              contentType = 'text/plain'
              fileExtension = 'env'
              break
            case 'json':
              content = this.generateJsonFile(variables)
              contentType = 'application/json'
              fileExtension = 'json'
              break
            case 'yaml':
              content = this.generateYamlFile(variables)
              contentType = 'application/x-yaml'
              fileExtension = 'yaml'
              break
            case 'toml':
              content = this.generateTomlFile(variables)
              contentType = 'application/toml'
              fileExtension = 'toml'
              break
            default:
              throw new Error(`Unsupported format: ${format}`)
          }

          const finalFilename = filename || `safenv-config.${fileExtension}`

          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${finalFilename}"`,
          })
          res.end(content)
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            })
          )
        }
      })
    }
  }

  private async updateConfigFiles(
    variables: Record<string, any>
  ): Promise<void> {
    if (!this.config || !this.context) return

    // Find GenFilePlugin configurations
    const genFilePlugins = this.config.plugins?.filter(plugin => {
      if (typeof plugin === 'object' && 'name' in plugin) {
        return plugin.name === 'genFilePlugin'
      }
      return false
    }) as Array<{ name: string; options: GenFilePluginOptions }>

    // Update files for each GenFilePlugin
    for (const pluginConfig of genFilePlugins) {
      const options = pluginConfig.options
      const outputDir = options.outputDir || this.context.outputDir

      for (const format of options.formats) {
        const fileName = `${options.name}.safenv.${format}`
        const filePath = resolve(outputDir, fileName)

        let content: string
        switch (format) {
          case 'env':
            content = this.generateEnvFile(variables)
            break
          case 'json':
            content = this.generateJsonFile(variables)
            break
          case 'yaml':
            content = this.generateYamlFile(variables)
            break
          case 'toml':
            content = this.generateTomlFile(variables)
            break
          default:
            continue
        }

        this.writeFile(filePath, content)
      }
    }
  }

  private generateEnvFile(variables: Record<string, any>): string {
    return Object.entries(variables)
      .map(([key, value]) => `${key}=${this.stringifyValue(value)}`)
      .join('\n')
  }

  private generateJsonFile(variables: Record<string, any>): string {
    return JSON.stringify(variables, null, 2)
  }

  private generateYamlFile(variables: Record<string, any>): string {
    const yaml = require('js-yaml')
    return yaml.dump(variables)
  }

  private generateTomlFile(variables: Record<string, any>): string {
    const TOML = require('@iarna/toml')
    return TOML.stringify(variables)
  }

  private stringifyValue(value: any): string {
    if (typeof value === 'string') {
      return value.includes(' ') || value.includes('"')
        ? `"${value.replace(/"/g, '\\"')}"`
        : value
    }
    if (Array.isArray(value)) {
      return value.join(',')
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value)
    }
    return String(value)
  }

  private writeFile(filePath: string, content: string): void {
    const fs = require('node:fs')
    const path = require('node:path')

    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content, 'utf8')
  }

  private generateWebUiHtml(): string {
    // Always generate HTML, even without context

    return `<!DOCTYPE html>
<html>
<head>
    <title>Safenv Configuration Editor</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5;
            line-height: 1.6;
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center;
        }
        .header h1 { margin: 0; font-size: 2em; }
        .header p { margin: 10px 0; opacity: 0.9; }
        .config-selector { 
            display: flex; 
            gap: 10px; 
            align-items: center; 
            margin-top: 15px;
        }
        .config-selector select { 
            padding: 8px 12px; 
            border: 2px solid rgba(255,255,255,0.3); 
            border-radius: 4px; 
            background: rgba(255,255,255,0.1); 
            color: white; 
            font-size: 14px;
            min-width: 250px;
        }
        .config-selector select option { 
            background: #333; 
            color: white; 
        }
        .btn-refresh { 
            padding: 8px 12px; 
            background: rgba(255,255,255,0.2); 
            border: 2px solid rgba(255,255,255,0.3); 
            color: white; 
            border-radius: 4px; 
            cursor: pointer;
            font-size: 14px;
        }
        .btn-refresh:hover { 
            background: rgba(255,255,255,0.3); 
        }
        .content { padding: 30px; }
        .variable { 
            margin: 20px 0; 
            padding: 20px; 
            border: 1px solid #e1e5e9; 
            border-radius: 6px; 
            background: #fafbfc;
        }
        .variable-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 10px;
        }
        .variable-name { 
            font-weight: 600; 
            color: #24292e; 
            font-size: 1.1em;
        }
        .variable-type { 
            background: #f1f8ff; 
            color: #0366d6; 
            padding: 2px 8px; 
            border-radius: 12px; 
            font-size: 0.8em;
            font-weight: 500;
        }
        .required { 
            background: #fff5f5; 
            color: #d73a49; 
        }
        .description { 
            color: #586069; 
            font-size: 0.9em; 
            margin-bottom: 10px;
            font-style: italic;
        }
        input[type="text"], textarea { 
            width: 100%; 
            padding: 12px; 
            border: 2px solid #e1e5e9; 
            border-radius: 6px; 
            font-size: 14px;
            transition: border-color 0.2s;
        }
        input[type="text"]:focus, textarea:focus { 
            outline: none; 
            border-color: #0366d6; 
        }
        .actions { 
            padding: 20px 30px; 
            background: #f6f8fa; 
            border-top: 1px solid #e1e5e9;
            display: flex;
            gap: 10px;
            justify-content: center;
        }
        button { 
            padding: 12px 24px; 
            border: none; 
            border-radius: 6px; 
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary { 
            background: #28a745; 
            color: white; 
        }
        .btn-primary:hover { 
            background: #218838; 
        }
        .btn-secondary { 
            background: #6c757d; 
            color: white; 
        }
        .btn-secondary:hover { 
            background: #5a6268; 
        }
        .status { 
            padding: 10px; 
            border-radius: 4px; 
            margin: 10px 0;
            display: none;
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
        .import-export { 
            padding: 20px 30px; 
            background: #f8f9fa; 
            border-top: 1px solid #e1e5e9;
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .btn-info { 
            background: #17a2b8; 
            color: white; 
        }
        .btn-info:hover { 
            background: #138496; 
        }
        .format-selector {
            display: inline-block;
            margin-left: 10px;
        }
        .format-selector select {
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 12px;
        }
        .mode-indicator {
            margin: 10px 0;
        }
        .mode-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 500;
        }
        .mode-local {
            background: #e3f2fd;
            color: #1565c0;
            border: 1px solid #bbdefb;
        }
        .mode-remote {
            background: #f3e5f5;
            color: #7b1fa2;
            border: 1px solid #e1bee7;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎨 Safenv Configuration Editor</h1>
            <p id="projectName">Project: ${this.context?.config?.name || 'No configuration loaded'}</p>
            <div class="mode-indicator">
                <span class="mode-badge mode-${this.uiMode}">
                    ${this.uiMode === 'local' ? '💻 Local Mode' : '🌐 Remote Mode'}
                </span>
            </div>
            <div class="config-selector">
                <select id="configSelect" onchange="switchConfig()">
                    <option value="">Select a configuration file...</option>
                </select>
                <button onclick="refreshConfigs()" class="btn-refresh">🔄 Refresh</button>
            </div>
        </div>
        
        <div class="content">
            <div id="status" class="status"></div>
            <div id="variables"></div>
        </div>
        
        <div class="actions">
            <button class="btn-primary" onclick="saveConfig()">💾 Save Configuration</button>
            <button class="btn-secondary" onclick="resetConfig()">🔄 Reset</button>
        </div>
        
        <div class="import-export">
            <button class="btn-info" onclick="importConfig()">📥 Import Config</button>
            <button class="btn-info" onclick="exportConfig()">📤 Export Config
                <span class="format-selector">
                    <select id="exportFormat">
                        <option value="json">JSON</option>
                        <option value="env">ENV</option>
                        <option value="yaml">YAML</option>
                        <option value="toml">TOML</option>
                    </select>
                </span>
            </button>
        </div>
    </div>
    
    <script>
        let config = ${JSON.stringify(this.context?.config || null)};
        let resolvedVariables = ${JSON.stringify(this.context?.resolvedVariables || {})};
        let originalVariables = {...resolvedVariables};
        let availableConfigs = [];
        
        async function loadAvailableConfigs() {
            try {
                const response = await fetch('/api/configs');
                const data = await response.json();
                availableConfigs = data.availableConfigs;
                updateConfigSelector();
            } catch (error) {
                console.error('Failed to load available configs:', error);
            }
        }
        
        function updateConfigSelector() {
            const select = document.getElementById('configSelect');
            const currentConfig = '${this.options.configFile || ''}';
            
            select.innerHTML = '<option value="">Select a configuration file...</option>';
            
            availableConfigs.forEach(configFile => {
                const option = document.createElement('option');
                option.value = configFile;
                option.textContent = configFile;
                if (configFile === currentConfig) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
        
        async function switchConfig() {
            const select = document.getElementById('configSelect');
            const selectedConfig = select.value;
            
            if (!selectedConfig) return;
            
            try {
                showStatus('🔄 Loading configuration...', 'info');
                
                const response = await fetch('/api/switch-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ configFile: selectedConfig })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    config = data.config;
                    resolvedVariables = data.resolvedVariables;
                    originalVariables = {...resolvedVariables};
                    
                    renderVariables();
                    showStatus('✅ Configuration loaded successfully!', 'success');
                    
                    // Update project name in header
                    document.getElementById('projectName').textContent = \`Project: \${config.name}\`;
                } else {
                    const error = await response.json();
                    showStatus('❌ Failed to load config: ' + (error.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                showStatus('❌ Network error: ' + error.message, 'error');
            }
        }
        
        async function refreshConfigs() {
            await loadAvailableConfigs();
            showStatus('🔄 Configuration list refreshed', 'success');
        }

        function renderVariables() {
            const container = document.getElementById('variables');
            container.innerHTML = '';
            
            if (!config || !config.variables) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No configuration loaded. Please select a configuration file above.</div>';
                return;
            }
            
            Object.entries(config.variables).forEach(([key, variable]) => {
                const div = document.createElement('div');
                div.className = 'variable';
                
                const value = resolvedVariables[key] || variable.default || '';
                
                div.innerHTML = \`
                    <div class="variable-header">
                        <span class="variable-name">\${key}</span>
                        <span class="variable-type \${variable.required ? 'required' : ''}">\${variable.type}\${variable.required ? ' *' : ''}</span>
                    </div>
                    \${variable.description ? \`<div class="description">\${variable.description}</div>\` : ''}
                    <input type="text" id="var_\${key}" value="\${String(value)}" placeholder="\${variable.default ? 'Default: ' + variable.default : 'No default value'}" />
                \`;
                
                container.appendChild(div);
            });
        }
        
        function showStatus(message, type) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = \`status \${type}\`;
            status.style.display = 'block';
            
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }
        
        // Add missing CSS for info status
        const style = document.createElement('style');
        style.textContent = \`
            .status.info { 
                background: #d1ecf1; 
                color: #0c5460; 
                border: 1px solid #bee5eb;
            }
        \`;
        document.head.appendChild(style);
        
        async function saveConfig() {
            if (!config || !config.variables) {
                showStatus('❌ No configuration loaded. Please select a configuration file first.', 'error');
                return;
            }
            
            const variables = {};
            Object.keys(config.variables).forEach(key => {
                const input = document.getElementById('var_' + key);
                if (input) {
                    variables[key] = input.value;
                }
            });
            
            try {
                const response = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ variables })
                });
                
                if (response.ok) {
                    showStatus('✅ Configuration saved successfully!', 'success');
                    Object.assign(resolvedVariables, variables);
                } else {
                    const error = await response.json();
                    showStatus('❌ Failed to save: ' + (error.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                showStatus('❌ Network error: ' + error.message, 'error');
            }
        }
        
        function resetConfig() {
            if (!config || !config.variables) {
                showStatus('❌ No configuration loaded. Please select a configuration file first.', 'error');
                return;
            }
            
            Object.keys(config.variables).forEach(key => {
                const input = document.getElementById('var_' + key);
                if (input) {
                    input.value = originalVariables[key] || config.variables[key].default || '';
                }
            });
            showStatus('🔄 Configuration reset to original values', 'success');
        }
        
        // Import/Export functionality
        const UI_MODE = '${this.uiMode}';
        
        async function importConfig() {
            try {
                if (UI_MODE === 'local' && typeof globalThis !== 'undefined' && 'showOpenFilePicker' in globalThis) {
                    // Use File System Access API (local mode)
                    await importConfigFromFile();
                } else if (UI_MODE === 'remote' || UI_MODE === 'auto') {
                    // Use HTTP import (remote mode)
                    await importConfigFromHttp();
                } else {
                    // Fallback: try File System Access API first, then HTTP
                    if (typeof globalThis !== 'undefined' && 'showOpenFilePicker' in globalThis) {
                        await importConfigFromFile();
                    } else {
                        await importConfigFromHttp();
                    }
                }
            } catch (error) {
                showStatus('❌ Import failed: ' + error.message, 'error');
            }
        }
        
        async function importConfigFromFile() {
            const [fileHandle] = await globalThis.showOpenFilePicker({
                types: [
                    {
                        description: 'Configuration files',
                        accept: {
                            'application/json': ['.json'],
                            'text/plain': ['.env'],
                            'application/x-yaml': ['.yaml', '.yml'],
                            'application/toml': ['.toml']
                        }
                    }
                ]
            });

            const file = await fileHandle.getFile();
            const content = await file.text();
            
            // Parse based on file extension
            const extension = file.name.split('.').pop()?.toLowerCase();
            let variables;
            
            switch (extension) {
                case 'json':
                    variables = JSON.parse(content);
                    break;
                case 'env':
                    variables = {};
                    content.split('\\n').forEach(line => {
                        line = line.trim();
                        if (line && !line.startsWith('#')) {
                            const [key, ...valueParts] = line.split('=');
                            if (key && valueParts.length > 0) {
                                let value = valueParts.join('=');
                                if ((value.startsWith('"') && value.endsWith('"')) || 
                                    (value.startsWith("'") && value.endsWith("'"))) {
                                    value = value.slice(1, -1);
                                }
                                variables[key.trim()] = value;
                            }
                        }
                    });
                    break;
                default:
                    throw new Error('Unsupported file format. Please use JSON or ENV files.');
            }
            
            // Update the UI with imported variables
            if (config && config.variables) {
                Object.keys(config.variables).forEach(key => {
                    const input = document.getElementById('var_' + key);
                    if (input && variables[key] !== undefined) {
                        input.value = variables[key];
                    }
                });
                showStatus('✅ Configuration imported successfully!', 'success');
            } else {
                showStatus('❌ No configuration loaded. Please select a configuration file first.', 'error');
            }
        }
        
        async function importConfigFromHttp() {
            const response = await fetch('/api/import-config');
            if (response.ok) {
                const data = await response.json();
                // This is mainly for demonstration - in practice, you might want to 
                // implement a different HTTP import mechanism
                showStatus('ℹ️ HTTP import not fully implemented in this demo', 'info');
            } else {
                throw new Error('Failed to import from server');
            }
        }
        
        async function exportConfig() {
            if (!config || !config.variables) {
                showStatus('❌ No configuration loaded. Please select a configuration file first.', 'error');
                return;
            }
            
            const variables = {};
            Object.keys(config.variables).forEach(key => {
                const input = document.getElementById('var_' + key);
                if (input) {
                    variables[key] = input.value;
                }
            });
            
            const format = document.getElementById('exportFormat').value;
            
            try {
                if (UI_MODE === 'local' && typeof globalThis !== 'undefined' && 'showSaveFilePicker' in globalThis) {
                    // Use File System Access API (local mode)
                    await exportConfigToFile(variables, format);
                } else if (UI_MODE === 'remote' || UI_MODE === 'auto') {
                    // Use HTTP export (remote mode)
                    await exportConfigViaHttp(variables, format);
                } else {
                    // Fallback: try File System Access API first, then HTTP
                    if (typeof globalThis !== 'undefined' && 'showSaveFilePicker' in globalThis) {
                        await exportConfigToFile(variables, format);
                    } else {
                        await exportConfigViaHttp(variables, format);
                    }
                }
            } catch (error) {
                showStatus('❌ Export failed: ' + error.message, 'error');
            }
        }
        
        async function exportConfigToFile(variables, format) {
            const filename = \`safenv-config.\${format}\`;
            
            let content;
            switch (format) {
                case 'json':
                    content = JSON.stringify(variables, null, 2);
                    break;
                case 'env':
                    content = Object.entries(variables)
                        .map(([key, value]) => {
                            const stringValue = String(value);
                            const needsQuotes = stringValue.includes(' ') || stringValue.includes('"');
                            return \`\${key}=\${needsQuotes ? \`"\${stringValue.replace(/"/g, '\\\\\\"')}"\` : stringValue}\`;
                        })
                        .join('\\n');
                    break;
                case 'yaml':
                    content = Object.entries(variables)
                        .map(([key, value]) => \`\${key}: \${JSON.stringify(value)}\`)
                        .join('\\n');
                    break;
                case 'toml':
                    content = Object.entries(variables)
                        .map(([key, value]) => \`\${key} = \${JSON.stringify(value)}\`)
                        .join('\\n');
                    break;
                default:
                    throw new Error(\`Unsupported format: \${format}\`);
            }
            
            const fileHandle = await globalThis.showSaveFilePicker({
                suggestedName: filename,
                types: [
                    {
                        description: 'Configuration files',
                        accept: {
                            'application/json': ['.json'],
                            'text/plain': ['.env'],
                            'application/x-yaml': ['.yaml', '.yml'],
                            'application/toml': ['.toml']
                        }
                    }
                ]
            });

            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            
            showStatus('✅ Configuration exported successfully!', 'success');
        }
        
        async function exportConfigViaHttp(variables, format) {
            const response = await fetch('/api/export-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ variables, format })
            });
            
            if (response.ok) {
                // Trigger download
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`safenv-config.\${format}\`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                showStatus('✅ Configuration exported successfully!', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Export failed');
            }
        }

        // Initialize the page
        async function init() {
            await loadAvailableConfigs();
            renderVariables();
        }
        
        init();
    </script>
</body>
</html>`
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close()
      this.server = undefined
      console.log('🛑 Safenv Web UI stopped')
    }
  }
}
