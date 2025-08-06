# 📚 x-env 示例集合

这个目录包含了 x-env 的各种使用示例，展示了从基础配置到高级功能的完整用法。

## 🏗️ 配置示例

### 基础配置

- **`standard-schema-demo.config.ts`** - 标准 Schema 配置示例
- **`dependency-example.config.ts`** - 依赖管理配置示例
- **`ui-demo.config.ts`** - UI 界面配置示例

### 高级配置

- **`typed-config-demo.config.ts`** - 类型安全配置示例
- **`builder-demo.config.ts`** - 使用配置构建器的示例

## 🧪 测试和验证

### 类型安全测试

- **`type-safety-test.ts`** - 类型系统功能测试
- **`simple-validation-test.ts`** - 基础验证库兼容性测试
- **`real-world-usage.ts`** - 真实世界使用场景示例

## 📄 生成文件

- **`generated-standard-schema.ts`** - 自动生成的 Standard Schema 文件

## 🚀 运行示例

### 构建配置

```bash
# 构建标准 Schema 示例
DATABASE_URL="postgresql://localhost:5432/test" pnpm run build examples/standard-schema-demo.config.ts

# 构建类型安全示例
pnpm run build examples/typed-config-demo.config.ts
```

### 运行测试

```bash
# 类型安全测试
node --experimental-strip-types examples/type-safety-test.ts

# 验证库兼容性测试
node --experimental-strip-types examples/simple-validation-test.ts

# 真实世界使用示例
node --experimental-strip-types examples/real-world-usage.ts
```

## 📋 示例说明

### 1. 标准 Schema 配置 (`standard-schema-demo.config.ts`)

展示如何配置 x-env 生成符合 Standard Schema V1 规范的验证代码。

### 2. 类型安全配置 (`typed-config-demo.config.ts`)

演示新的类型安全配置系统，包括约束定义和验证器使用。

### 3. 配置构建器 (`builder-demo.config.ts`)

展示如何使用类型安全的配置构建器来创建复杂的配置。

### 4. 验证库兼容性 (`simple-validation-test.ts`)

测试生成的 Standard Schema 与 Zod、Valibot、ArkType 的兼容性。

### 5. 真实世界使用 (`real-world-usage.ts`)

展示在实际项目中如何使用不同的验证库来验证配置。

## 🎯 最佳实践

1. **使用类型安全的配置构建器** - 避免运行时错误
2. **利用约束系统** - 确保配置的有效性
3. **选择合适的验证库** - 根据项目需求选择 Zod、Valibot 或 ArkType
4. **遵循 Standard Schema 规范** - 确保生态兼容性

## 📖 更多信息

- [类型系统升级文档](../TYPE_SYSTEM_UPGRADE.md)
- [类型问题修复文档](../TYPE_ISSUES_FIXED.md)
- [项目主文档](../README.md)
