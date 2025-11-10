# Getting Started with DI Framework

This package includes everything you need to set up and use the dependency injection framework in your TypeScript project.

## Package Contents

- **container.ts** - Core DI container implementation
- **decorators.ts** - `@Injectable()` and `@Inject()` decorators
- **types.ts** - TypeScript type definitions and utilities
- **services/** - Example service implementations
- **examples/** - Complete working examples

## Quick Setup

### 1. Install in Your Project

```bash
# Copy the framework files to your project
cp -r packages/di-framework/container.ts src/
cp -r packages/di-framework/decorators.ts src/
cp -r packages/di-framework/types.ts src/
```

### 2. Configure TypeScript

Update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true
  }
}
```

### 3. Create Your First Service

```typescript
import { Injectable } from './decorators';

@Injectable()
export class DatabaseService {
  connect(): void {
    console.log('Connected to database');
  }
}
```

### 4. Use the Service

```typescript
import { getContainer } from './container';
import { DatabaseService } from './DatabaseService';

const container = getContainer();
const db = container.resolve(DatabaseService);
db.connect(); // Output: "Connected to database"
```

## Complete Example

See `examples/index.ts` for a complete working example with:
- Multiple dependent services
- Service registration
- Automatic dependency resolution
- Singleton management

Run it with:
```bash
bun run examples/index.ts
# or
npx ts-node examples/index.ts
```

## Advanced Examples

- **examples/advanced-example.ts** - Multi-level dependencies, transient services, lifecycle methods
- **examples/test-example.ts** - Testing with mocked dependencies
- **services/** - Example service implementations

## Key Features

✨ **Zero Dependencies** - No external dependencies needed
🔗 **Automatic Injection** - Dependencies resolved automatically
📦 **Singleton Pattern** - Services are singletons by default
🎯 **Type-Safe** - Full TypeScript support
🚫 **Circular Dependency Detection** - Prevents circular dependency errors
📋 **Simple API** - Just two main decorators: `@Injectable()` and `@Inject()`

## Documentation

- **README.md** - Complete API documentation
- **MIGRATION_GUIDE.md** - Migrating from manual DI approaches
- **types.ts** - TypeScript interfaces and utilities

## Next Steps

1. Read the [README.md](./README.md) for complete API documentation
2. Check [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) if migrating from another approach
3. Review examples in `examples/` directory
4. Study service implementations in `services/` directory

## Support

For issues, questions, or contributions:
- GitHub: https://github.com/geoffsee/dependency-injection-framework
- Issues: https://github.com/geoffsee/dependency-injection-framework/issues
