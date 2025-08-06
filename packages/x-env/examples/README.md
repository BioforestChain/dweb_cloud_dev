# 📚 x-env 示例集合

这个目录包含了 x-env 的各种使用示例，展示了从基础配置到高级功能的完整用法。

## 🚀 Workspace 集成示例

### 完整的 pnpm workspace 示例

- **`workspace-demo/`** - 完整的 pnpm workspace 示例，展示多项目环境变量管理
  - 包含两个相互依赖的项目：base-service 和 web-app
  - 演示环境变量配置共享和依赖管理
  - 提供完整的开发和部署工作流程

## 🏗️ 配置示例

### 基础配置

- **`standard-schema-demo.config.ts`** - 标准 Schema 配置示例
- **`dependency-example.config.ts`** - 依赖管理配置示例
- **`ui-demo.config.ts`** - UI 界面配置示例

### 高级配置

- **`typed-config-demo.config.ts`** - 类型安全配置示例
- **`builder-demo.config.ts`** - 使用配置构建器的示例

## 🧪 测试和验证

### 真实世界使用场景

- **`real-world-usage.ts`** - 真实世界使用场景示例

## 🚀 运行示例

### Workspace 集成示例

```bash
# 进入 workspace 示例目录
cd workspace-demo

# 运行设置脚本
./scripts/setup.sh

# 启动基础服务
pnpm run start --filter base-service

# 启动 Web 应用
pnpm run start --filter web-app

# 运行集成测试
./scripts/test.sh
```

### 构建配置

```bash
# 构建标准 Schema 示例
DATABASE_URL="postgresql://localhost:5432/test" pnpm run build examples/standard-schema-demo.config.ts

# 构建类型安全示例
pnpm run build examples/typed-config-demo.config.ts
```

### 运行测试

```bash
# 真实世界使用示例
node --experimental-strip-types examples/real-world-usage.ts
```

## 📋 示例说明

### 1. Workspace 集成示例 (`workspace-demo/`)

完整的 pnpm workspace 示例，展示如何在 monorepo 环境中使用 x-env：

- **Base Service**: 基础服务项目，定义数据库、Redis 和服务配置
- **Web App**: Web 应用项目，依赖基础服务并定义自己的配置
- **依赖管理**: 演示项目间配置共享和自动依赖发现
- **环境变量**: 展示多层级环境变量管理和优先级处理

### 2. 标准 Schema 配置 (`standard-schema-demo.config.ts`)

展示如何配置 x-env 生成符合 Standard Schema V1 规范的验证代码。

### 3. 类型安全配置 (`typed-config-demo.config.ts`)

演示新的类型安全配置系统，包括约束定义和验证器使用。

### 4. 配置构建器 (`builder-demo.config.ts`)

展示如何使用类型安全的配置构建器来创建复杂的配置。

### 5. 依赖管理示例 (`dependency-example.config.ts`)

演示如何在配置中定义和管理项目间的依赖关系。

### 6. 真实世界使用 (`real-world-usage.ts`)

展示在实际项目中如何使用不同的验证库来验证配置。

## 🎯 最佳实践

1. **使用 Workspace 集成** - 在 monorepo 环境中统一管理环境变量
2. **启用自动依赖发现** - 使用 `autoDependencies` 简化项目间配置共享
3. **使用类型安全的配置构建器** - 避免运行时错误
4. **利用约束系统** - 确保配置的有效性
5. **选择合适的验证库** - 根据项目需求选择 Zod、Valibot 或 ArkType
6. **遵循 Standard Schema 规范** - 确保生态兼容性
7. **提供环境变量模板** - 使用 `.env.example` 文件指导配置

## 📖 更多信息

- [类型系统升级文档](../TYPE_SYSTEM_UPGRADE.md)
- [类型问题修复文档](../TYPE_ISSUES_FIXED.md)
- [项目主文档](../README.md)
