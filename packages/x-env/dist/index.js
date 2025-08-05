const require_genFile = require('./genFile-4dGlZMQ4.js');
const require_base = require('./base-D_Eton5p.js');
const require_genTs = require('./genTs-CBxWNa1k.js');
const unconfig = require_genFile.__toESM(require("unconfig"));
const node_path = require_genFile.__toESM(require("node:path"));
const chokidar = require_genFile.__toESM(require("chokidar"));

//#region src/core.ts
var SafenvCore = class {
	config = null;
	options;
	constructor(options = {}) {
		this.options = {
			mode: "serve",
			configFile: "safenv.config",
			outputDir: "./dist",
			watch: true,
			...options
		};
	}
	async loadConfig() {
		const { config } = await (0, unconfig.loadConfig)({
			sources: [{ files: [
				`${this.options.configFile}.ts`,
				`${this.options.configFile}.js`,
				`${this.options.configFile}.json`,
				`${this.options.configFile}.yaml`,
				`${this.options.configFile}.yml`
			] }],
			defaults: {
				name: "safenv",
				variables: {},
				plugins: []
			}
		});
		if (!config) throw new Error("No safenv config found");
		this.config = config;
		return config;
	}
	async loadPlugin(pluginConfig) {
		const { GenFilePlugin: GenFilePlugin$1 } = await Promise.resolve().then(() => require("./genFile-CVJxKrEG.js"));
		const { GenTsPlugin: GenTsPlugin$1 } = await Promise.resolve().then(() => require("./genTs-CajlNbTF.js"));
		const pluginMap = {
			genFilePlugin: GenFilePlugin$1,
			genTsPlugin: GenTsPlugin$1
		};
		const PluginClass = pluginMap[pluginConfig.name];
		if (!PluginClass) throw new Error(`Unknown plugin: ${pluginConfig.name}`);
		return new PluginClass(pluginConfig.options);
	}
	async resolvePlugins(plugins) {
		const resolvedPlugins = [];
		for (const plugin of plugins) if ("apply" in plugin) resolvedPlugins.push(plugin);
		else {
			const resolvedPlugin = await this.loadPlugin(plugin);
			resolvedPlugins.push(resolvedPlugin);
		}
		return resolvedPlugins;
	}
	async resolveVariables(config) {
		const resolved = {};
		for (const [key, variable] of Object.entries(config.variables)) {
			let value = process.env[key] ?? variable.default;
			if (variable.required && value === void 0) throw new Error(`Required variable ${key} is not set`);
			if (value !== void 0) {
				value = this.parseValue(value, variable.type);
				if (variable.validate) {
					const result = variable.validate(value);
					if (result !== true) throw new Error(`Validation failed for ${key}: ${result}`);
				}
			}
			resolved[key] = value;
		}
		return resolved;
	}
	parseValue(value, type) {
		if (typeof value === "string") switch (type) {
			case "number": return Number(value);
			case "boolean": return value.toLowerCase() === "true";
			case "array": return value.split(",").map((v) => v.trim());
			case "object": return JSON.parse(value);
			default: return value;
		}
		return value;
	}
	async run() {
		const config = await this.loadConfig();
		const resolvedVariables = await this.resolveVariables(config);
		const resolvedPlugins = await this.resolvePlugins(config.plugins || []);
		const context = {
			config,
			resolvedVariables,
			mode: this.options.mode,
			outputDir: (0, node_path.resolve)(this.options.outputDir)
		};
		for (const plugin of resolvedPlugins) await plugin.apply(context);
	}
};

//#endregion
//#region src/server.ts
var SafenvServer = class extends SafenvCore {
	watcher = null;
	constructor(options = {}) {
		super({
			...options,
			mode: "serve"
		});
	}
	async start() {
		await this.run();
		if (this.options.watch) this.startWatching();
	}
	startWatching() {
		const watchPatterns = [`${this.options.configFile}.*`, "**/*.safenv.*"];
		this.watcher = (0, chokidar.watch)(watchPatterns, {
			ignored: ["node_modules/**", ".git/**"],
			persistent: true
		});
		this.watcher.on("change", async (path) => {
			console.log(`Config changed: ${path}`);
			try {
				await this.run();
				console.log("Safenv updated successfully");
			} catch (error) {
				console.error("Error updating safenv:", error);
			}
		});
		console.log("Watching for config changes...");
	}
	async stop() {
		if (this.watcher) {
			await this.watcher.close();
			this.watcher = null;
		}
	}
};

//#endregion
//#region src/builder.ts
var SafenvBuilder = class extends SafenvCore {
	constructor(options = {}) {
		super({
			...options,
			mode: "build",
			watch: false
		});
	}
	async build() {
		console.log("Building safenv configuration...");
		try {
			await this.run();
			console.log("Safenv build completed successfully");
		} catch (error) {
			console.error("Error building safenv:", error);
			throw error;
		}
	}
};

//#endregion
//#region src/workspace.ts
var SafenvWorkspace = class {
	workspaceConfig = null;
	constructor(options = {}) {
		this.options = options;
	}
	async loadWorkspace() {
		const { loadConfig: loadConfig$1 } = await import("unconfig");
		const { config } = await loadConfig$1({ sources: [{ files: [
			`${this.options.configFile || "safenv.config"}.ts`,
			`${this.options.configFile || "safenv.config"}.js`,
			`${this.options.configFile || "safenv.config"}.json`,
			`${this.options.configFile || "safenv.config"}.yaml`,
			`${this.options.configFile || "safenv.config"}.yml`
		] }] });
		if (!config || !config.workspace) throw new Error("No workspace configuration found");
		this.workspaceConfig = config;
		const configs = [];
		for (const workspacePath of config.workspace) {
			const fullPath = (0, node_path.resolve)(workspacePath);
			const safenv = new SafenvCore({
				...this.options,
				configFile: (0, node_path.resolve)(fullPath, "safenv.config")
			});
			try {
				const workspaceConfig = await safenv.loadConfig();
				configs.push(workspaceConfig);
			} catch (error) {
				console.warn(`Failed to load workspace config at ${fullPath}:`, error);
			}
		}
		return configs;
	}
	async runWorkspace() {
		const configs = await this.loadWorkspace();
		for (const config of configs) {
			const safenv = new SafenvCore({
				...this.options,
				configFile: (0, node_path.resolve)((0, node_path.dirname)(config.name), "safenv.config")
			});
			await safenv.run();
		}
	}
};

//#endregion
//#region src/adapters.ts
var HttpImportExportAdapter = class {
	async import(url) {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Failed to import from ${url}: ${response.statusText}`);
		return response.json();
	}
	async export(filePath, data) {
		const response = await fetch(filePath, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data)
		});
		if (!response.ok) throw new Error(`Failed to export to ${filePath}: ${response.statusText}`);
	}
};
var FileImportExportAdapter = class {
	async import(filePath) {
		const hasWindow = typeof globalThis !== "undefined" && "window" in globalThis;
		const window = hasWindow ? globalThis.window : void 0;
		if (window && "showOpenFilePicker" in window) {
			const [fileHandle] = await window.showOpenFilePicker({ types: [{
				description: "Configuration files",
				accept: {
					"application/json": [".json"],
					"application/x-yaml": [".yaml", ".yml"],
					"text/plain": [".env", ".toml"]
				}
			}] });
			const file = await fileHandle.getFile();
			const content = await file.text();
			if (file.name.endsWith(".json")) return JSON.parse(content);
			else if (file.name.endsWith(".yaml") || file.name.endsWith(".yml")) {
				const yaml = await import("js-yaml");
				return yaml.load(content);
			} else if (file.name.endsWith(".toml")) {
				const TOML = await import("@iarna/toml");
				return TOML.parse(content);
			} else return this.parseEnvFile(content);
		} else {
			const fs = await import("fs");
			const content = fs.readFileSync(filePath, "utf8");
			if (filePath.endsWith(".json")) return JSON.parse(content);
			else if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
				const yaml = await import("js-yaml");
				return yaml.load(content);
			} else if (filePath.endsWith(".toml")) {
				const TOML = await import("@iarna/toml");
				return TOML.parse(content);
			} else return this.parseEnvFile(content);
		}
	}
	async export(filePath, data) {
		let content;
		let mimeType;
		if (filePath.endsWith(".json")) {
			content = JSON.stringify(data, null, 2);
			mimeType = "application/json";
		} else if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
			const yaml = await import("js-yaml");
			content = yaml.dump(data);
			mimeType = "application/x-yaml";
		} else if (filePath.endsWith(".toml")) {
			const TOML = await import("@iarna/toml");
			content = TOML.stringify(data);
			mimeType = "application/toml";
		} else {
			content = this.generateEnvFile(data);
			mimeType = "text/plain";
		}
		const hasWindow = typeof globalThis !== "undefined" && "window" in globalThis;
		const window = hasWindow ? globalThis.window : void 0;
		if (window && "showSaveFilePicker" in window) {
			const fileHandle = await window.showSaveFilePicker({
				suggestedName: filePath,
				types: [{
					description: "Configuration file",
					accept: { [mimeType]: [filePath.substring(filePath.lastIndexOf("."))] }
				}]
			});
			const writable = await fileHandle.createWritable();
			await writable.write(content);
			await writable.close();
		} else {
			const fs = await import("fs");
			fs.writeFileSync(filePath, content, "utf8");
		}
	}
	parseEnvFile(content) {
		const result = {};
		content.split("\n").forEach((line) => {
			line = line.trim();
			if (line && !line.startsWith("#")) {
				const [key, ...valueParts] = line.split("=");
				if (key && valueParts.length > 0) {
					let value = valueParts.join("=");
					if (value.startsWith("\"") && value.endsWith("\"")) value = value.slice(1, -1);
					result[key.trim()] = value;
				}
			}
		});
		return result;
	}
	generateEnvFile(data) {
		return Object.entries(data).map(([key, value]) => {
			const stringValue = String(value);
			return `${key}=${stringValue.includes(" ") ? `"${stringValue}"` : stringValue}`;
		}).join("\n");
	}
};

//#endregion
//#region src/index.ts
function createSafenv(options = {}) {
	return new SafenvCore(options);
}
function createServer(options = {}) {
	return new SafenvServer(options);
}
function createBuilder(options = {}) {
	return new SafenvBuilder(options);
}
function createWorkspace(options = {}) {
	return new SafenvWorkspace(options);
}

//#endregion
exports.BasePlugin = require_base.BasePlugin;
exports.FileImportExportAdapter = FileImportExportAdapter;
exports.GenFilePlugin = require_genFile.GenFilePlugin;
exports.GenTsPlugin = require_genTs.GenTsPlugin;
exports.HttpImportExportAdapter = HttpImportExportAdapter;
exports.SafenvBuilder = SafenvBuilder;
exports.SafenvCore = SafenvCore;
exports.SafenvServer = SafenvServer;
exports.SafenvWorkspace = SafenvWorkspace;
exports.createBuilder = createBuilder;
exports.createSafenv = createSafenv;
exports.createServer = createServer;
exports.createWorkspace = createWorkspace;