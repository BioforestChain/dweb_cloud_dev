//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
const require_base = require('./base-D_Eton5p.js');
const node_path = __toESM(require("node:path"));
const node_http = __toESM(require("node:http"));

//#region src/plugins/genFile.ts
var GenFilePlugin = class extends require_base.BasePlugin {
	name = "genFilePlugin";
	server;
	constructor(options) {
		super();
		this.options = options;
	}
	async apply(context) {
		const outputDir = this.options.outputDir || context.outputDir;
		for (const format of this.options.formats) {
			const fileName = `${this.options.name}.safenv.${format}`;
			const filePath = (0, node_path.resolve)(outputDir, fileName);
			let content;
			switch (format) {
				case "env":
					content = this.generateEnvFile(context.resolvedVariables);
					break;
				case "json":
					content = this.generateJsonFile(context.resolvedVariables);
					break;
				case "yaml":
					content = this.generateYamlFile(context.resolvedVariables);
					break;
				case "toml":
					content = this.generateTomlFile(context.resolvedVariables);
					break;
				default: throw new Error(`Unsupported format: ${format}`);
			}
			this.writeFile(filePath, content);
		}
		if (this.options.webUi?.enabled && context.mode === "serve") await this.startWebUi(context);
		if (this.options.htmlTools?.enabled) await this.generateHtmlTools(context);
	}
	generateEnvFile(variables) {
		return Object.entries(variables).map(([key, value]) => `${key}=${this.stringifyValue(value)}`).join("\n");
	}
	generateJsonFile(variables) {
		return JSON.stringify(variables, null, 2);
	}
	generateYamlFile(variables) {
		const yaml = require("js-yaml");
		return yaml.dump(variables);
	}
	generateTomlFile(variables) {
		const TOML = require("@iarna/toml");
		return TOML.stringify(variables);
	}
	stringifyValue(value) {
		if (typeof value === "string") return value.includes(" ") || value.includes("\"") ? `"${value.replace(/"/g, "\\\"")}"` : value;
		if (Array.isArray(value)) return value.join(",");
		if (typeof value === "object" && value !== null) return JSON.stringify(value);
		return String(value);
	}
	async startWebUi(context) {
		const port = this.options.webUi?.port || 3e3;
		const host = this.options.webUi?.host || "localhost";
		this.server = (0, node_http.createServer)(async (req, res) => {
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
			res.setHeader("Access-Control-Allow-Headers", "Content-Type");
			if (req.method === "OPTIONS") {
				res.writeHead(200);
				res.end();
				return;
			}
			const url = new URL(req.url, `http://${host}:${port}`);
			if (url.pathname === "/api/config") {
				if (req.method === "GET") {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({
						config: context.config,
						resolvedVariables: context.resolvedVariables
					}));
				} else if (req.method === "POST") {
					let body = "";
					req.on("data", (chunk) => {
						body += chunk;
					});
					req.on("end", async () => {
						try {
							const { variables } = JSON.parse(body);
							for (const format of this.options.formats) {
								const fileName = `${this.options.name}.safenv.${format}`;
								const filePath = (0, node_path.resolve)(context.outputDir, fileName);
								let content;
								switch (format) {
									case "env":
										content = this.generateEnvFile(variables);
										break;
									case "json":
										content = this.generateJsonFile(variables);
										break;
									case "yaml":
										content = this.generateYamlFile(variables);
										break;
									case "toml":
										content = this.generateTomlFile(variables);
										break;
								}
								this.writeFile(filePath, content);
							}
							res.writeHead(200, { "Content-Type": "application/json" });
							res.end(JSON.stringify({ success: true }));
						} catch (error) {
							res.writeHead(400, { "Content-Type": "application/json" });
							res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
						}
					});
				}
			} else if (url.pathname === "/") {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(this.generateWebUiHtml(context));
			} else {
				res.writeHead(404);
				res.end("Not Found");
			}
		});
		this.server.listen(port, host, () => {
			console.log(`Safenv Web UI running at http://${host}:${port}`);
		});
	}
	generateWebUiHtml(context) {
		return `<!DOCTYPE html>
<html>
<head>
    <title>Safenv Configuration</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .variable { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        input[type="text"], textarea { width: 100%; padding: 8px; margin: 4px 0; }
        button { padding: 8px 16px; margin: 4px; }
        .description { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <h1>Safenv Configuration: ${context.config.name}</h1>
    <div id="variables"></div>
    <button onclick="saveConfig()">Save Configuration</button>
    <button onclick="importConfig()">Import</button>
    <button onclick="exportConfig()">Export</button>
    
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
                    <label><strong>\${key}</strong> (\${variable.type})\${variable.required ? ' *' : ''}</label>
                    \${variable.description ? \`<div class="description">\${variable.description}</div>\` : ''}
                    <input type="text" id="\${key}" value="\${value}" />
                \`;
                
                container.appendChild(div);
            });
        }
        
        async function saveConfig() {
            const variables = {};
            Object.keys(config.variables).forEach(key => {
                variables[key] = document.getElementById(key).value;
            });
            
            try {
                const response = await fetch('/api/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ variables })
                });
                
                if (response.ok) {
                    alert('Configuration saved!');
                } else {
                    alert('Failed to save configuration');
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }
        
        function importConfig() {
            // Use file input for importing
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.yaml,.yml,.env,.toml';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const text = await file.text();
                    // Parse and update form based on file content
                    // Implementation would depend on file format
                }
            };
            input.click();
        }
        
        function exportConfig() {
            const variables = {};
            Object.keys(config.variables).forEach(key => {
                variables[key] = document.getElementById(key).value;
            });
            
            const blob = new Blob([JSON.stringify(variables, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`\${config.name}.safenv.json\`;
            a.click();
            URL.revokeObjectURL(url);
        }
        
        renderVariables();
    <\/script>
</body>
</html>`;
	}
	async generateHtmlTools(context) {
		const outputPath = this.options.htmlTools?.outputPath || (0, node_path.resolve)(context.outputDir, "safenv-tools.html");
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
    <\/script>
</body>
</html>`;
		this.writeFile(outputPath, htmlContent);
	}
	async cleanup() {
		if (this.server) {
			this.server.close();
			this.server = void 0;
		}
	}
};

//#endregion
Object.defineProperty(exports, 'GenFilePlugin', {
  enumerable: true,
  get: function () {
    return GenFilePlugin;
  }
});
Object.defineProperty(exports, '__toESM', {
  enumerable: true,
  get: function () {
    return __toESM;
  }
});