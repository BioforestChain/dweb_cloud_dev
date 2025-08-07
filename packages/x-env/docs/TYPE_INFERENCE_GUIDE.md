# X-Env TypeScript 类型推导指南

## 问题描述

在使用 x-env 时，当直接在配置对象中定义环境变量时，`validate` 函数的 `value` 参数类型推导不正确：

```typescript
// ❌ 问题：value 参数被推导为 any 类型
const config = {
  variables: {
    NODE_ENV: {
      type: 'string',
      default: 'development',
      validate: value => value === 'development' || value === 'production', // value: any
    },
  },
}
```

## 解决方案

我们提供了三种解决方案来获得正确的类型推导：

### 方案 1：使用 `defineVariable` 辅助函数（推荐）

```typescript
import { defineConfig, defineVariable } from 'x-env/config-builder'

const config = defineConfig({
  variables: {
    NODE_ENV: defineVariable('string', {
      default: 'development',
      description: 'Application environment',
      validate: value => value === 'development' || value === 'production', // value: string ✅
    }),

    PORT: defineVariable('number', {
      default: 3000,
      validate: value => value > 1000 && value < 65536, // value: number ✅
    }),

    DEBUG: defineVariable('boolean', {
      default: false,
      validate: value => typeof value === 'boolean', // value: boolean ✅
    }),
  },
})
```

### 方案 2：使用类型特定的辅助函数（最推荐）

```typescript
import {
  defineConfig,
  stringVar,
  numberVar,
  booleanVar,
  arrayVar,
  objectVar,
} from 'x-env/config-builder'

const config = defineConfig({
  variables: {
    NODE_ENV: stringVar({
      default: 'development',
      description: 'Application environment',
      validate: value => {
        // value: string ✅
        const validEnvs = ['development', 'production', 'test']
        return (
          validEnvs.includes(value) || `Must be one of: ${validEnvs.join(', ')}`
        )
      },
    }),

    PORT: numberVar({
      default: 3000,
      description: 'Server port',
      validate: value => {
        // value: number ✅
        if (value < 1000) return 'Port must be greater than 1000'
        if (value > 65535) return 'Port must be less than 65536'
        return true
      },
    }),

    FEATURES: arrayVar({
      default: ['auth', 'api'],
      description: 'Enabled features',
      validate: value => {
        // value: unknown[] ✅
        return (
          Array.isArray(value) && value.every(item => typeof item === 'string')
        )
      },
    }),

    DATABASE_CONFIG: objectVar({
      default: { host: 'localhost', port: 5432 },
      description: 'Database configuration',
      validate: value => {
        // value: Record<string, unknown> ✅
        return typeof value === 'object' && value !== null && 'host' in value
      },
    }),
  },
})
```

### 方案 3：显式类型注解（备选方案）

```typescript
const config = defineConfig({
  variables: {
    NODE_ENV: {
      type: 'string' as const,
      default: 'development',
      validate: (value: string) =>
        value === 'development' || value === 'production',
    },
  },
})
```

## 技术原理

### 问题根因

TypeScript 在对象字面量中无法很好地处理泛型类型推导。当我们写：

```typescript
{
  type: 'string',
  validate: (value) => { /* ... */ }
}
```

TypeScript 无法将 `type: 'string'` 与 `validate` 函数的参数类型关联起来。

### 解决原理

我们的解决方案通过以下方式工作：

1. **函数重载**：`defineVariable` 使用函数重载为每种类型提供精确的类型定义
2. **类型断言**：使用 `as const` 确保类型字面量不被扩展
3. **泛型约束**：通过泛型参数 `T extends SafenvPrimitiveType` 确保类型安全

```typescript
// defineVariable 的实现
export function defineVariable(
  type: 'string',
  options: Omit<SafenvVariable<'string'>, 'type'>
): SafenvVariable<'string'>
export function defineVariable(
  type: 'number',
  options: Omit<SafenvVariable<'number'>, 'type'>
): SafenvVariable<'number'>
// ... 其他重载
export function defineVariable<T extends SafenvPrimitiveType>(
  type: T,
  options: Omit<SafenvVariable<T>, 'type'>
): SafenvVariable<T> {
  return { type, ...options } as SafenvVariable<T>
}
```

## 最佳实践

### 1. 优先使用类型特定函数

```typescript
// ✅ 推荐
const config = defineConfig({
  variables: {
    API_URL: stringVar({
      required: true,
      validate: value => {
        try {
          new URL(value)
          return true
        } catch {
          return 'Must be a valid URL'
        }
      },
    }),
  },
})
```

### 2. 复杂验证逻辑

```typescript
const config = defineConfig({
  variables: {
    NODE_ENV: stringVar({
      default: 'development',
      validate: value => {
        const validEnvs = ['development', 'production', 'test'] as const
        if (!validEnvs.includes(value as any)) {
          return `Environment must be one of: ${validEnvs.join(', ')}`
        }
        return true
      },
    }),

    PORT: numberVar({
      default: 3000,
      constraints: {
        min: 1000,
        max: 65535,
        integer: true,
      },
      validate: value => {
        // 约束已经处理了基本验证，这里可以添加额外逻辑
        if (value === 3000) {
          console.warn(
            'Using default port 3000, consider using a different port in production'
          )
        }
        return true
      },
    }),
  },
})
```

### 3. 与约束系统结合

```typescript
const config = defineConfig({
  variables: {
    EMAIL: stringVar({
      required: true,
      constraints: {
        format: 'email',
        minLength: 5,
        maxLength: 100,
      },
      validate: value => {
        // 约束已经验证了基本格式，这里可以添加业务逻辑
        const blockedDomains = ['tempmail.com', 'guerrillamail.com']
        const domain = value.split('@')[1]
        if (blockedDomains.includes(domain)) {
          return 'Temporary email addresses are not allowed'
        }
        return true
      },
    }),
  },
})
```

## 迁移指南

如果你已经有现有的配置，可以按以下步骤迁移：

### 步骤 1：导入辅助函数

```typescript
import {
  defineConfig,
  stringVar,
  numberVar,
  booleanVar,
} from 'x-env/config-builder'
```

### 步骤 2：替换变量定义

```typescript
// 之前
const config = {
  variables: {
    NODE_ENV: {
      type: 'string',
      default: 'development',
      validate: value => value === 'development' || value === 'production',
    },
  },
}

// 之后
const config = defineConfig({
  variables: {
    NODE_ENV: stringVar({
      default: 'development',
      validate: value => value === 'development' || value === 'production',
    }),
  },
})
```

### 步骤 3：验证类型推导

确保在 IDE 中 `validate` 函数的 `value` 参数显示正确的类型，而不是 `any`。

## 常见问题

### Q: 为什么不直接修复 SafenvVariable 接口？

A: TypeScript 的类型推导限制使得在对象字面量中无法很好地处理条件类型。我们的解决方案通过函数重载提供了更好的开发体验。

### Q: 这些辅助函数会影响运行时性能吗？

A: 不会。这些函数在编译时被内联，运行时开销几乎为零。

### Q: 可以混合使用不同的定义方式吗？

A: 可以，但建议在同一个项目中保持一致的风格。

## 示例项目

查看 `examples/type-inference-demo.ts` 获取完整的使用示例。

## 相关文档

- [配置构建器 API](./CONFIG_BUILDER.md)
- [类型系统概览](./TYPE_SYSTEM.md)
- [验证系统指南](./VALIDATION_GUIDE.md)
