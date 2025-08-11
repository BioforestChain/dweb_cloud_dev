# SafEnv Examples - 完整功能演示

本目录包含了 SafEnv 所有核心功能的完整演示和测试用例。

## 📁 文件说明

### 核心演示配置

- **`comprehensive-workspace.config.ts`** - 🌟 **全功能测试工作空间**  
  完整演示所有 SafEnv 功能的综合配置，包括:
  - 完整的插件生命周期系统
  - 声明式依赖关系感知
  - 所有 GenTsPlugin 输出模式
  - GenFilePlugin 多格式输出
  - 工作空间管理
  - 70+ 个环境变量示例

- **`genTs-plugin-demo.config.ts`** - GenTsPlugin 输出模式演示
  - Zod 风格验证器
  - Pure TypeScript 验证器
  - 所有导出模式 (process.env, static, file-based)
  - 自定义配置选项

- **`dependency-demo.config.ts`** - 声明式依赖配置演示
  - 多种依赖格式支持
  - 条件依赖加载
  - 冲突解决策略
  - 优先级管理

- **`web-ui-demo.config.ts`** - Web UI 功能演示
  - HTML Tools (本地文件操作)
  - Remote API (HTTP接口)
  - 导入导出功能

### 测试工具

- **`run-comprehensive-test.ts`** - 🧪 **全功能测试脚本**  
  自动化测试所有功能的完整性和正确性

## 🚀 快速开始

### 1. 运行综合测试

```bash
# 进入 examples 目录
cd examples

# 运行完整功能测试
node --experimental-strip-types run-comprehensive-test.ts
```

测试将验证:

- ✅ 插件生命周期系统
- ✅ 依赖关系解析
- ✅ TypeScript 代码生成
- ✅ 多格式文件输出
- ✅ Web UI 接口
- ✅ 服务器模式

### 2. 运行单个演示

```bash
# 测试 GenTsPlugin 所有输出模式
node --experimental-strip-types -e "import('./genTs-plugin-demo.config.ts').then(m => console.log('Config loaded:', m.default.name))"

# 启动 Web UI 演示
node --experimental-strip-types web-ui-demo.config.ts
```

### 3. 查看生成的文件

运行测试后，检查生成的文件:

```bash
# 查看生成的 TypeScript 文件
ls -la generated/

# 查看生成的配置文件
ls -la generated/files/

# 查看 HTML 工具文件
open generated/html-tools.html
```

## 🔧 功能特性演示

### 1. 插件生命周期系统

```typescript
// 完整的生命周期钩子
beforeLoad → afterLoad → beforeResolve → afterResolve → beforeGenerate → afterGenerate → cleanup
```

**特性:**

- 🔄 自动错误恢复和重试
- 🐛 调试追踪和性能监控
- 📊 插件执行结果统计
- 🔗 插件间通信和依赖

### 2. 声明式依赖关系

```typescript
dependencies: {
  explicit: [
    '@company/shared-config',        // NPM 包
    '../common/base.safenv.config',  // 相对路径
    'workspace:base-config',         // 工作空间依赖
    'npm:package@1.0.0',            // 版本约束
    'file:./config.json'            // 文件路径
  ],
  conditional: {
    development: {
      packages: ['workspace:dev-tools'],
      condition: 'NODE_ENV=development'
    }
  },
  conflictResolution: 'priority'
}
```

**特性:**

- 🎯 多种依赖格式支持
- 🔀 条件依赖加载
- ⚡ 并行依赖解析
- 🛡️ 冲突自动解决

### 3. GenTsPlugin 输出模式

| 模式                 | 描述             | 特性              |
| -------------------- | ---------------- | ----------------- |
| `process.env`        | 基础环境变量导出 | 运行时解析        |
| `process.env-static` | 静态导出         | Tree-shaking 友好 |
| `env-file`           | .env 文件加载    | 文件系统集成      |
| `json-file`          | JSON 文件加载    | 支持 JSON5/JSONC  |
| `yaml-file`          | YAML 文件加载    | 人类可读格式      |
| `toml-file`          | TOML 文件加载    | 配置友好格式      |

**验证器风格:**

- 🔍 **Zod** - 按需导入，tree-shaking 优化
- 🚀 **Pure** - 零依赖，纯 TypeScript
- 📝 **None** - 仅类型定义

### 4. Web UI 功能

**主要界面:**

- 📋 配置文件管理
- 🔍 实时变量查看
- 📤 多格式导出 (JSON/ENV/YAML)
- 🛠️ HTML Tools (本地文件操作)

**API 端点:**

```
GET  /api/v1/configs     - 获取配置列表
GET  /api/v1/variables   - 获取变量值
POST /api/v1/export      - 导出配置
```

## 📊 测试覆盖范围

### 核心功能测试

- ✅ 配置文件加载 (TS/JS/JSON/YAML)
- ✅ 变量类型转换和验证
- ✅ 插件系统完整性
- ✅ 依赖解析准确性
- ✅ 文件生成正确性

### 输出质量验证

- ✅ TypeScript 类型安全
- ✅ 生成代码语法正确
- ✅ Tree-shaking 兼容性
- ✅ 运行时功能性

### 服务功能测试

- ✅ Web UI 界面响应
- ✅ API 端点可访问性
- ✅ 文件导入导出功能
- ✅ 错误处理和恢复

## 🐛 调试模式

启用详细调试输出:

```bash
# 设置调试模式
export SAFENV_DEBUG=true

# 运行测试查看详细信息
node --experimental-strip-types run-comprehensive-test.ts
```

调试输出包含:

- 🔍 插件执行时间统计
- 📋 依赖解析过程详情
- ⚠️ 警告和错误建议
- 📊 生成文件统计信息

## 📝 自定义配置

基于示例创建你自己的配置:

```typescript
import { defineConfig } from '@dweb-cloud/safenv'
import { genTsPlugin } from '@dweb-cloud/safenv/plugins'

export default defineConfig({
  name: 'my-project',
  variables: {
    // 你的环境变量定义
  },
  plugins: [
    genTsPlugin({
      outputPath: './src/config.ts',
      validatorStyle: 'zod',
      exportMode: 'process.env',
    }),
  ],
})
```

## 🤝 贡献指南

添加新的演示配置:

1. 创建新的 `.config.ts` 文件
2. 在 `run-comprehensive-test.ts` 中添加测试用例
3. 更新本 README 文档
4. 运行完整测试确保功能正常

## 📄 许可证

本项目采用 MIT 许可证。详情请见 [LICENSE](../LICENSE) 文件。

- 提供完整的演示脚本和验证工具 (`demo-script.js`)

### 3. TypeScript 类型推导示例

- **`type-inference-demo.ts`** - TypeScript 类型推导功能演示
  - 展示 `defineVariable` 和类型特定辅助函数的使用
  - 演示 `validate` 函数参数的正确类型推导
  - 提供同步和异步验证器的使用示例

- **`test-type-inference.js`** - 类型推导功能运行时验证脚本
  - 用于验证 `type-inference-demo.ts` 中定义的类型辅助函数的正确性。

## 🚀 运行示例

### 1. 配置驱动 API 演示 ⭐ **推荐先运行**

这个示例展示了新的配置驱动 API，符合前端工具的标准做法：

```bash
# 在 examples 目录下运行
node --experimental-strip-types config-driven-api-demo.ts
```

该演示将展示：

- 如何通过配置对象创建不同类型的 x-env 实例
- `create()` 函数的各种使用模式
- TypeScript 类型安全验证
- 与 Vite/Vitest 类似的 API 设计

### 2. 综合演示项目

首先，请确保您已经在项目根目录安装了 `pnpm`.

```bash
# 1. 构建 @dweb-cloud/safenv 包
#    这将编译 TypeScript 源码并生成 dist 目录，可视化工具等需要依赖它
pnpm --filter @dweb-cloud/safenv build

# 2. 进入综合演示项目目录
cd packages/x-env/examples/comprehensive-demo

# 3. 安装依赖
pnpm install

# 4. 运行演示脚本
pnpm demo
```

该脚本将执行 `demo-script.js`，它会：

1.  **解析依赖**: 分析 `workspace` 中的所有包及其外部依赖。
2.  **收集变量**: 汇总所有 `safenv.config.js` 文件中定义的变量。
3.  **生成结果**: 输出一个 `comprehensive-demo-results.json` 文件，其中包含所有解析出的环境变量及其来源。

### 3. TypeScript 类型推导示例

这个示例可以直接使用 Node.js 的 `experimental-strip-types` 标志运行，它会在执行前移除 TypeScript 类型注解。

```bash
# 在 examples 目录下运行
node --experimental-strip-types type-inference-demo.ts

# 运行验证脚本
node test-type-inference.js
```

## 📋 示例说明

### 1. 综合演示项目 (`comprehensive-demo/`)

这是一个功能完备的 pnpm workspace 示例，用于演示 `x-env` 如何在复杂的 monorepo 环境中自动管理环境变量：

- **依赖解析**: 自动发现并解析 `packages/*` 和 `external-deps/*` 中的所有 `safenv.config.js` 文件。
- **变量收集**: 递归地收集所有依赖项暴露出的环境变量。
- **多格式支持**: 正确处理 `direct`、`nested` 和 `conditional` 导出格式。
- **可视化**: 提供了 `pnpm visualize` 命令，可以启动一个服务来可视化依赖关系图。

### 2. 类型推导示例 (`type-inference-demo.ts` & `test-type-inference.js`)

这两个文件共同演示了 `x-env` 的类型系统：

- `type-inference-demo.ts` 定义了一系列环境变量，并使用了 `defineVariable` 和辅助函数（如 `string`, `number`）来附加类型和验证规则。
- `test-type-inference.js` 导入并执行在 `type-inference-demo.ts` 中定义的函数，以在运行时验证类型推导的正确性。

## 🎯 最佳实践

1.  **使用配置驱动 API** - 采用新的 `create()` 函数，通过配置对象来决定行为，符合前端工具标准。
2.  **利用 Monorepo优势** - 在 `comprehensive-demo` 中查看如何在 pnpm workspace 中统一管理环境变量。
3.  **类型安全优先** - 使用 `defineVariable` 和类型辅助函数来确保配置的健壮性，避免运行时错误。
4.  **提供环境变量模板** - 使用 `.env.example` 文件指导用户进行项目配置。

### 🆕 新 API 使用模式

```typescript
// ✅ 推荐：配置驱动的方式
import { create } from '@dweb-cloud/x-env'

// 服务器模式
const server = create({
  server: true,
  mode: 'serve',
})

// 构建器模式
const builder = create({
  builder: { minify: true },
  mode: 'build',
})

// 工作空间模式
const workspace = create({
  workspace: { projects: ['./apps/*'] },
})

// 默认核心模式
const core = create()
```

## 📖 更多信息

- [类型推导指南](../docs/TYPE_INFERENCE_GUIDE.md)
- [项目主文档](../README.md)
