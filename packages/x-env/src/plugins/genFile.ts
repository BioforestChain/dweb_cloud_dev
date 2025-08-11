import { resolve } from 'node:path'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { GenFilePluginOptions } from './types.ts'
import type { SafenvContext, SafenvPlugin } from '../types.ts'

/**
 * Generate environment configuration files in multiple formats
 * @param options Plugin configuration options
 * @returns SafenvPlugin instance
 */
export function genFilePlugin(options: GenFilePluginOptions): SafenvPlugin {
  return {
    name: 'genFilePlugin',

    async afterGenerate(context: SafenvContext): Promise<void> {
      const outputDir = options.outputDir || context.root
      console.log(
        `genFilePlugin: Generating files in ${outputDir} with formats:`,
        options.formats
      )

      // Generate config files
      for (const format of options.formats) {
        const fileName = `${options.name}.safenv.${format}`
        const filePath = resolve(outputDir, fileName)

        let content: string

        switch (format) {
          case 'env':
            content = generateEnvFile(context.resolvedVariables)
            break
          case 'json':
            content = generateJsonFile(context.resolvedVariables)
            break
          case 'yaml':
            content = generateYamlFile(context.resolvedVariables)
            break
          case 'toml':
            content = generateTomlFile(context.resolvedVariables)
            break
          default:
            throw new Error(`Unsupported format: ${format}`)
        }

        writeFile(filePath, content)
        console.log(`genFilePlugin: Generated ${filePath}`)
      }

      // Generate HTML tools if enabled
      if (options.htmlTools?.enabled) {
        await generateHtmlTools(context, options)
      }
    },

    async cleanup(): Promise<void> {
      // Cleanup logic if needed
    },
  }
}

// Helper function to ensure directory exists and write file
function writeFile(filePath: string, content: string): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(filePath, content, 'utf8')
}

// Generate .env file content
function generateEnvFile(variables: Record<string, any>): string {
  return Object.entries(variables)
    .map(([key, value]) => `${key}=${stringifyValue(value)}`)
    .join('\n')
}

// Generate JSON file content
function generateJsonFile(variables: Record<string, any>): string {
  return JSON.stringify(variables, null, 2)
}

// Generate YAML file content
function generateYamlFile(variables: Record<string, any>): string {
  const yaml = require('js-yaml')
  return yaml.dump(variables)
}

// Generate TOML file content
function generateTomlFile(variables: Record<string, any>): string {
  const TOML = require('@iarna/toml')
  return TOML.stringify(variables)
}

// Stringify value for .env format
function stringifyValue(value: any): string {
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

// Generate HTML tools
async function generateHtmlTools(
  context: SafenvContext,
  options: GenFilePluginOptions
): Promise<void> {
  const outputPath =
    options.htmlTools?.outputPath || resolve(context.root, 'safenv-tools.html')

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
        <h3>Environment Variables</h3>
        <div id="variables"></div>
    </div>
    
    <div class="section">
        <h3>File Operations</h3>
        <div class="file-ops">
            <button onclick="importConfig('env')">Import .env</button>
            <button onclick="importConfig('json')">Import JSON</button>
            <button onclick="importConfig('yaml')">Import YAML</button>
            <button onclick="importConfig('toml')">Import TOML</button>
            <button onclick="exportConfig('env')">Export .env</button>
            <button onclick="exportConfig('json')">Export JSON</button>
            <button onclick="exportConfig('yaml')">Export YAML</button>
            <button onclick="exportConfig('toml')">Export TOML</button>
        </div>
    </div>

    <script>
        const config = ${JSON.stringify(context.config, null, 2)};
        const resolvedVariables = ${JSON.stringify(context.resolvedVariables, null, 2)};
        
        function renderVariables() {
            const container = document.getElementById('variables');
            container.innerHTML = '';
            
            Object.entries(config.variables).forEach(([key, variable]) => {
                const div = document.createElement('div');
                div.className = 'variable';
                
                const currentValue = resolvedVariables[key] || variable.default || '';
                
                div.innerHTML = \`
                    <label><strong>\${key}</strong></label>
                    \${variable.description ? \`<div class="description">\${variable.description}</div>\` : ''}
                    <input type="text" id="var_\${key}" value="\${String(currentValue)}" />
                \`;
                
                container.appendChild(div);
            });
        }
        
        function getCurrentVariables() {
            const variables = {};
            Object.keys(config.variables).forEach(key => {
                const input = document.getElementById('var_' + key);
                if (input) {
                    variables[key] = input.value;
                }
            });
            return variables;
        }
        
        async function importConfig(format) {
            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{
                        description: \`\${format.toUpperCase()} files\`,
                        accept: { 'text/plain': ['.env', '.json', '.yaml', '.yml', '.toml'] }
                    }]
                });
                
                const file = await fileHandle.getFile();
                const content = await file.text();
                
                let variables = {};
                
                switch (format) {
                    case 'env':
                        variables = parseEnvFile(content);
                        break;
                    case 'json':
                        variables = JSON.parse(content);
                        break;
                    case 'yaml':
                        // Simple YAML parsing (basic implementation)
                        content.split('\\n').forEach(line => {
                            const match = line.match(/^([^:]+):\\s*(.+)$/);
                            if (match) {
                                const [, key, value] = match;
                                variables[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
                            }
                        });
                        break;
                    case 'toml':
                        // Simple TOML parsing (basic implementation)
                        content.split('\\n').forEach(line => {
                            const match = line.match(/^([^=]+)\\s*=\\s*(.+)$/);
                            if (match) {
                                const [, key, value] = match;
                                variables[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
                            }
                        });
                        break;
                }
                
                // Update form fields
                Object.entries(variables).forEach(([key, value]) => {
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

  writeFile(outputPath, htmlContent)
}
