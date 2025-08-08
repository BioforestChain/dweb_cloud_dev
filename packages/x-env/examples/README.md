# 📚 x-env 示例集合

这个目录包含了 x-env 的核心使用示例，展示了从基础配置到高级功能的完整用法。

## 🎯 核心示例

### 1. 综合演示项目

- **`comprehensive-demo/`** - 完整的 monorepo + 外部依赖包示例
  - 包含 3 个 monorepo 项目：`web-frontend`、`api-backend`、`shared-utils`
  - 包含 3 个外部依赖包：`auth-service`、`database-client`、`cache-redis`
  - 演示 `safenv.config.js` 自动发现、类型安全解析、依赖关系图生成
  - 支持 3 种 `exports.safenv` 格式：direct, nested, conditional
  - 提供完整的演示脚本和验证工具 (`demo-script.js`)

### 2. TypeScript 类型推导示例

- **`type-inference-demo.ts`** - TypeScript 类型推导功能演示
  - 展示 `defineVariable` 和类型特定辅助函数的使用
  - 演示 `validate` 函数参数的正确类型推导
  - 提供同步和异步验证器的使用示例

- **`test-type-inference.js`** - 类型推导功能运行时验证脚本
  - 用于验证 `type-inference-demo.ts` 中定义的类型辅助函数的正确性。

## 🚀 运行示例

### 1. 综合演示项目

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

### 2. TypeScript 类型推导示例

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

1.  **利用 Monorepo优势** - 在 `comprehensive-demo` 中查看如何在 pnpm workspace 中统一管理环境变量。
2.  **类型安全优先** - 使用 `defineVariable` 和类型辅助函数来确保配置的健壮性，避免运行时错误。
3.  **提供环境变量模板** - 使用 `.env.example` 文件指导用户进行项目配置。

## 📖 更多信息

- [类型推导指南](../docs/TYPE_INFERENCE_GUIDE.md)
- [项目主文档](../README.md)
