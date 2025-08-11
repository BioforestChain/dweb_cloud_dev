# X-Env 综合演示项目

这个示例项目全面验证 X-Env 的 monorepo 和外部依赖包 `safenv.config.js` 解析能力。

## 目录结构

```
comprehensive-demo/
├── README.md                    # 本文档
├── package.json                 # 主项目配置
├── safenv.config.js             # 主项目环境变量配置
├── demo-script.js               # 演示脚本，用于解析和生成结果
├── comprehensive-demo-results.json # 脚本生成的结果文件
├── packages/                    # Monorepo 工作区
│   ├── web-frontend/            # 前端应用
│   ├── api-backend/             # 后端 API
│   └── shared-utils/            # 共享工具库
└── external-deps/               # 外部依赖包模拟
    ├── auth-service/            # 认证服务包
    ├── database-client/         # 数据库客户端包
    └── cache-redis/             # Redis 缓存包
```

_每个子目录中都包含自己的 `package.json` 和 `safenv.config.js`。_

## 核心功能验证

### 1. Monorepo 项目间依赖解析

- ✅ 自动发现工作区 (`packages/*`) 中的所有项目。
- ✅ 解析项目间的环境变量依赖关系。
- ✅ 类型安全的变量传递和验证。

### 2. 外部依赖包 `safenv.config` 解析

- ✅ 从 npm 包的 `exports.safenv` 字段自动发现配置。
- ✅ 支持多种 `exports` 格式 (direct, nested, conditional)。
- ✅ 类型安全的外部依赖环境变量解析。

### 3. 综合依赖分析

- ✅ 构建统一的依赖关系图。
- ✅ 提供环境变量冲突检测机制。
- ✅ 可视化依赖关系图展示。

## 使用方法

**重要提示：所有命令都应在 Monorepo 的根目录（即 `dweb_cloud_dev/` 目录）下执行。**

````bash
# 1. 安装所有依赖
#    在项目根目录运行，pnpm 会读取 pnpm-workspace.yaml 并处理整个 workspace 的依赖关系。
pnpm install

# 2. 构建 @dweb-cloud/safenv 包
## 🚀 Running the Examples

### 1. Main Demo Script (Simulated)
```bash
npm run demo
````

This runs the main demonstration script that simulates x-env functionality.

### 2. Real API Demo - Vite/Vitest Style (New!)

```bash
npm run demo:real
```

This runs a demonstration using the new Vite/Vitest style configuration API:

- **Core Instance**: `create({ root, configFile })`
- **Server Instance**: `create({ server: { port, host, cors } })`
- **Builder Instance**: `create({ build: { outDir, minify, sourcemap } })`
- **Workspace Instance**: `create({ projects: [...] })`

### 3. Vite-Style Config Demo

```bash
npm run demo:vite-style
```

This demonstrates the complete Vite/Vitest style configuration patterns.

# 5. (可选) 启动可视化UI

pnpm --filter x-env-comprehensive-demo visualize

````

### 🆕 新增：真实 API 演示

`real-api-demo.js` 脚本展示了新的配置驱动 API 的实际使用：

- ✅ 演示 `create()` 函数的各种使用方式
- ✅ 展示配置驱动的实例创建
- ✅ 验证 TypeScript 类型安全
- ✅ 符合前端工具标准（类似 Vite/Vitest）

```bash
# 直接运行真实 API 演示
cd packages/x-env/examples/comprehensive-demo
node real-api-demo.js
````

## 预期结果

运行 `pnpm demo` 后，您应该能在 `comprehensive-demo-results.json` 文件中看到：

- 来自 3 个 monorepo 项目的环境变量。
- 来自 3 个外部依赖包的环境变量。
- 总计约 12-15 个解析出的环境变量。
- 完整的依赖关系图（在 `pnpm visualize` 中查看）。
- 类型安全的变量解析结果。
