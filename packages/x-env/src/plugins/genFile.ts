import { resolve } from 'node:path'
import { BasePlugin } from './base.ts'
import type { GenFilePluginOptions } from './types.ts'
import type { SafenvContext } from '../types.ts'

export class GenFilePlugin extends BasePlugin {
  name = 'genFilePlugin'

  constructor(private options: GenFilePluginOptions) {
    super()
  }

  async apply(context: SafenvContext): Promise<void> {
    const outputDir = this.options.outputDir || context.outputDir
    console.log(
      `GenFilePlugin: Generating files in ${outputDir} with formats:`,
      this.options.formats
    )

    // Generate config files
    for (const format of this.options.formats) {
      const fileName = `${this.options.name}.safenv.${format}`
      const filePath = resolve(outputDir, fileName)

      let content: string

      switch (format) {
        case 'env':
          content = this.generateEnvFile(context.resolvedVariables)
          break
        case 'json':
          content = this.generateJsonFile(context.resolvedVariables)
          break
        case 'yaml':
          content = this.generateYamlFile(context.resolvedVariables)
          break
        case 'toml':
          content = this.generateTomlFile(context.resolvedVariables)
          break
        default:
          throw new Error(`Unsupported format: ${format}`)
      }

      this.writeFile(filePath, content)
      console.log(`GenFilePlugin: Generated ${filePath}`)
    }

    // Web-ui functionality has been moved to a separate command

    // Generate HTML tools if enabled
    if (this.options.htmlTools?.enabled) {
      await this.generateHtmlTools(context)
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
      // Check if the string needs quoting (contains spaces, quotes, or special chars)
      const needsQuoting =
        value.includes(' ') ||
        value.includes('"') ||
        value.includes('\n') ||
        value.includes('\t') ||
        value.includes('&') ||
        value.includes('|')

      if (needsQuoting) {
        // Escape existing quotes and wrap in quotes
        return `"${value.replace(/"/g, '\\"')}"`
      }
      return value
    }
    if (Array.isArray(value)) {
      return value.join(',')
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value)
    }
    return String(value)
  }

  private async generateHtmlTools(context: SafenvContext): Promise<void> {
    const outputPath =
      this.options.htmlTools?.outputPath ||
      resolve(context.outputDir, 'safenv-tools.html')

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Safenv Tools - ${context.config.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .variable { margin: 10px 0; padding: 10px; border: 1px solid #eee; border-radius: 4px; }
        input[type="text"], textarea { width: 100%; padding: 8px; margin: 4px 0; box-sizing: border-box; }
        button { padding: 10px 20px; margin: 8px 4px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #005a87; }
        .description { color: #666; font-size: 0.9em; margin: 4px 0; }
        .file-ops { display: flex; gap: 10px; flex-wrap: wrap; }
    </style>
</head>
<body>
    <h1>Safenv Configuration Tools</h1>
    <h2>Project: ${context.config.name}</h2>
    
    <div class="section">
        <h3>Configuration Variables</h3>
        <div id="variables"></div>
        <div class="file-ops">
            <button onclick="importConfig()">📁 Import Configuration</button>
            <button onclick="exportConfig('json')">💾 Export as JSON</button>
            <button onclick="exportConfig('yaml')">💾 Export as YAML</button>
            <button onclick="exportConfig('env')">💾 Export as ENV</button>
            <button onclick="exportConfig('toml')">💾 Export as TOML</button>
        </div>
    </div>
    
    <script>
        const config = ${JSON.stringify(context.config)};
        const resolvedVariables = ${JSON.stringify(context.resolvedVariables)};
        
        function renderVariables() {
            const container = document.getElementById('variables');
            container.innerHTML = '';
            
            Object.entries(config.variables).forEach(([key, variable]) => {
                const div = document.createElement('div');
                div.className = 'variable';
                
                const value = resolvedVariables[key] || variable.default || '';
                
                div.innerHTML = \`
                    <label><strong>\${key}</strong> (\${variable.type})\${variable.required ? ' <span style="color: red">*</span>' : ''}</label>
                    \${variable.description ? \`<div class="description">\${variable.description}</div>\` : ''}
                    <input type="text" id="var_\${key}" value="\${String(value)}" placeholder="\${variable.default ? 'Default: ' + variable.default : 'No default value'}" />
                \`;
                
                container.appendChild(div);
            });
        }
        
        function getCurrentVariables() {
            const variables = {};
            Object.keys(config.variables).forEach(key => {
                const input = document.getElementById('var_' + key);
                if (input && input.value.trim()) {
                    variables[key] = input.value.trim();
                }
            });
            return variables;
        }
        
        async function importConfig() {
            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'Configuration files',
                        accept: {
                            'application/json': ['.json'],
                            'application/x-yaml': ['.yaml', '.yml'],
                            'text/plain': ['.env', '.toml']
                        }
                    }]
                });
                
                const file = await fileHandle.getFile();
                const content = await file.text();
                
                let importedData = {};
                if (file.name.endsWith('.json')) {
                    importedData = JSON.parse(content);
                } else if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
                    // Note: Would need js-yaml loaded for this to work
                    importedData = jsyaml.load(content);
                } else if (file.name.endsWith('.env')) {
                    importedData = parseEnvFile(content);
                }
                
                // Update form with imported data
                Object.entries(importedData).forEach(([key, value]) => {
                    const input = document.getElementById('var_' + key);
                    if (input) {
                        input.value = String(value);
                    }
                });
                
                alert('Configuration imported successfully!');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    alert('Error importing file: ' + error.message);
                }
            }
        }
        
        async function exportConfig(format) {
            const variables = getCurrentVariables();
            let content, fileName, mimeType;
            
            switch (format) {
                case 'json':
                    content = JSON.stringify(variables, null, 2);
                    fileName = \`\${config.name}.safenv.json\`;
                    mimeType = 'application/json';
                    break;
                case 'yaml':
                    // Simple YAML export (basic implementation)
                    content = Object.entries(variables).map(([k, v]) => \`\${k}: \${JSON.stringify(v)}\`).join('\\n');
                    fileName = \`\${config.name}.safenv.yaml\`;
                    mimeType = 'application/x-yaml';
                    break;
                case 'env':
                    content = Object.entries(variables).map(([k, v]) => \`\${k}=\${String(v).includes(' ') ? '"' + v + '"' : v}\`).join('\\n');
                    fileName = \`\${config.name}.safenv.env\`;
                    mimeType = 'text/plain';
                    break;
                case 'toml':
                    // Simple TOML export (basic implementation)
                    content = Object.entries(variables).map(([k, v]) => \`\${k} = \${JSON.stringify(v)}\`).join('\\n');
                    fileName = \`\${config.name}.safenv.toml\`;
                    mimeType = 'application/toml';
                    break;
            }
            
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: \`\${format.toUpperCase()} files\`,
                        accept: { [mimeType]: [fileName.substring(fileName.lastIndexOf('.'))] }
                    }]
                });
                
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
                
                alert('Configuration exported successfully!');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    // Fallback to download
                    const blob = new Blob([content], { type: mimeType });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    a.click();
                    URL.revokeObjectURL(url);
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
                        let value = valueParts.join('=');
                        if ((value.startsWith('"') && value.endsWith('"')) || 
                            (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.slice(1, -1);
                        }
                        result[key.trim()] = value;
                    }
                }
            });
            return result;
        }
        
        renderVariables();
    </script>
</body>
</html>`

    this.writeFile(outputPath, htmlContent)
  }

  async cleanup(): Promise<void> {
    // Cleanup logic if needed
  }
}
