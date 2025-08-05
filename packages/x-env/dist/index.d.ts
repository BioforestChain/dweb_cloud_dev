//#region src/types.d.ts
interface SafenvVariable {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: any;
  required?: boolean;
  validate?: (value: any) => boolean | string;
}
interface SafenvConfig {
  name: string;
  description?: string;
  variables: Record<string, SafenvVariable>;
  dependencies?: string[];
  plugins?: (SafenvPlugin | SafenvPluginConfig)[];
  workspace?: string[];
}
interface SafenvPlugin {
  name: string;
  apply: (context: SafenvContext) => Promise<void> | void;
  cleanup?: () => Promise<void> | void;
}
interface SafenvPluginConfig {
  name: string;
  options?: any;
}
interface SafenvContext {
  config: SafenvConfig;
  resolvedVariables: Record<string, any>;
  mode: 'serve' | 'build';
  outputDir: string;
}
interface GenFilePluginOptions {
  name: string;
  formats: Array<'env' | 'json' | 'yaml' | 'toml'>;
  outputDir?: string;
  webUi?: {
    enabled: boolean;
    port?: number;
    host?: string;
  };
  htmlTools?: {
    enabled: boolean;
    outputPath?: string;
  };
}
interface ImportExportAdapter {
  import: (filePath: string) => Promise<Record<string, any>>;
  export: (filePath: string, data: Record<string, any>) => Promise<void>;
}
interface WebUiOptions {
  enabled: boolean;
  port?: number;
  host?: string;
}
interface HtmlToolsOptions {
  enabled: boolean;
  outputPath?: string;
}
interface GenTsPluginOptions {
  outputPath: string;
  validatorName?: string;
  exportValidator?: boolean;
  validatorStyle: 'zod' | 'pure' | 'none';
  exportMode?: 'process.env' | 'process.env-static' | 'env-file' | 'json-file' | 'yaml-file' | 'toml-file';
  exportType?: 'named' | 'default' | 'object';
  exportName?: string;
  customDeps?: string[];
  customInjectCode?: string[];
}
interface SafenvOptions {
  mode?: 'serve' | 'build';
  configFile?: string;
  outputDir?: string;
  watch?: boolean;
}
//#endregion
//#region src/core.d.ts
declare class SafenvCore {
  private config;
  protected options: SafenvOptions;
  constructor(options?: SafenvOptions);
  loadConfig(): Promise<SafenvConfig>;
  private loadPlugin;
  private resolvePlugins;
  resolveVariables(config: SafenvConfig): Promise<Record<string, any>>;
  private parseValue;
  run(): Promise<void>;
}
//#endregion
//#region src/server.d.ts
declare class SafenvServer extends SafenvCore {
  private watcher;
  constructor(options?: SafenvOptions);
  start(): Promise<void>;
  private startWatching;
  stop(): Promise<void>;
}
//#endregion
//#region src/builder.d.ts
declare class SafenvBuilder extends SafenvCore {
  constructor(options?: SafenvOptions);
  build(): Promise<void>;
}
//#endregion
//#region src/workspace.d.ts
declare class SafenvWorkspace {
  private options;
  private workspaceConfig;
  constructor(options?: SafenvOptions);
  loadWorkspace(): Promise<SafenvConfig[]>;
  runWorkspace(): Promise<void>;
}
//#endregion
//#region src/plugins/base.d.ts
declare abstract class BasePlugin implements SafenvPlugin {
  abstract name: string;
  abstract apply(context: SafenvContext): Promise<void> | void;
  protected ensureDir(dir: string): void;
  protected writeFile(filePath: string, content: string): void;
}
//#endregion
//#region src/plugins/genFile.d.ts
declare class GenFilePlugin extends BasePlugin {
  private options;
  name: string;
  private server?;
  constructor(options: GenFilePluginOptions);
  apply(context: SafenvContext): Promise<void>;
  private generateEnvFile;
  private generateJsonFile;
  private generateYamlFile;
  private generateTomlFile;
  private stringifyValue;
  private startWebUi;
  private generateWebUiHtml;
  private generateHtmlTools;
  cleanup(): Promise<void>;
}
//#endregion
//#region src/plugins/genTs.d.ts
declare class GenTsPlugin extends BasePlugin {
  private options;
  name: string;
  constructor(options: GenTsPluginOptions);
  apply(context: SafenvContext): Promise<void>;
  private generateTsContent;
  private generateZodImports;
  private generateValidator;
  private generateZodValidator;
  private generatePureValidator;
  private getZodType;
  private getPureParser;
  private generateExport;
  private generateStaticExport;
  private generateEnvFileExport;
  private generateFileExport;
  private getDefaultDeps;
  private getDefaultInjectCode;
  private getParseFunction;
  private generateNamedExports;
  private generateDefaultExport;
}
//#endregion
//#region src/adapters.d.ts
declare global {
  interface Window {
    showOpenFilePicker?: (options?: any) => Promise<any[]>;
    showSaveFilePicker?: (options?: any) => Promise<any>;
  }
}
declare class HttpImportExportAdapter implements ImportExportAdapter {
  import(url: string): Promise<Record<string, any>>;
  export(filePath: string, data: Record<string, any>): Promise<void>;
}
declare class FileImportExportAdapter implements ImportExportAdapter {
  import(filePath: string): Promise<Record<string, any>>;
  export(filePath: string, data: Record<string, any>): Promise<void>;
  private parseEnvFile;
  private generateEnvFile;
}
//#endregion
//#region src/index.d.ts
declare function createSafenv(options?: SafenvOptions): SafenvCore;
declare function createServer(options?: SafenvOptions): SafenvServer;
declare function createBuilder(options?: SafenvOptions): SafenvBuilder;
declare function createWorkspace(options?: SafenvOptions): SafenvWorkspace;
//#endregion
export { BasePlugin, FileImportExportAdapter, GenFilePlugin, GenFilePluginOptions, GenTsPlugin, GenTsPluginOptions, HtmlToolsOptions, HttpImportExportAdapter, ImportExportAdapter, SafenvBuilder, SafenvConfig, SafenvContext, SafenvCore, SafenvOptions, SafenvPlugin, SafenvPluginConfig, SafenvServer, SafenvVariable, SafenvWorkspace, WebUiOptions, createBuilder, createSafenv, createServer, createWorkspace };
//# sourceMappingURL=index.d.ts.map