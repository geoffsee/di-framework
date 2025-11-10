# DI Framework Features

## Core Features

### 1. Automatic Service Registration

Mark classes with `@Injectable()` to automatically register them with the DI container.

```typescript
@Injectable()
export class UserService {
  getUser(id: string) { ... }
}
```

**No manual registry needed!** The decorator handles registration automatically.

### 2. Dependency Injection

Dependencies are automatically resolved and injected using the `@Inject()` decorator.

```typescript
@Injectable()
export class UserController {
  @Inject(UserService)
  private userService!: UserService;

  getUser(id: string) {
    return this.userService.getUser(id);
  }
}
```

**Type-safe and compile-time checked!**

### 3. Singleton Pattern

Services are singletons by default - the same instance is returned every time.

```typescript
const user1 = container.resolve(UserService);
const user2 = container.resolve(UserService);
console.log(user1 === user2); // true
```

**Configurable per service:**

```typescript
@Injectable({ singleton: false })
export class RequestContext {
  // New instance for each resolution
}
```

### 4. Circular Dependency Detection

The framework detects and reports circular dependencies, preventing infinite loops.

```typescript
@Injectable()
class ServiceA {
  @Inject(ServiceB)
  private b!: ServiceB;
}

@Injectable()
class ServiceB {
  @Inject(ServiceA)
  private a!: ServiceA;
}

// Error: Circular dependency detected!
```

### 5. Zero External Dependencies

Works with:
- TypeScript 5.0+
- SWC
- Standard TypeScript Compiler

**No reflect-metadata, no external libraries needed!**

### 6. Type-Safe Dependency Resolution

Full compile-time type checking for dependencies.

```typescript
@Injectable()
class OrderService {
  @Inject(DatabaseService)
  private db!: DatabaseService; // Type-safe!

  placeOrder(orderId: string) {
    // this.db is typed as DatabaseService
    this.db.query(...);
  }
}
```

### 7. Flexible Service Registration

Multiple ways to register services:

```typescript
// Auto-registration with @Container()
@Injectable()
class MyService { }

// Manual registration
container.register(MyService);

// Factory registration
container.registerFactory('config', () => ({
  apiKey: process.env.API_KEY
}), { singleton: true });
```

### 8. Custom Containers

Create separate containers for testing or different application contexts:

```typescript
// Production container
const prodContainer = getContainer();

// Test container with mocks
const testContainer = new Container();
testContainer.register(MockDatabaseService);
```

### 9. Property Injection

Dependencies can be injected into properties:

```typescript
@Injectable()
export class UserService {
  @Inject(DatabaseService)
  private db!: DatabaseService;

  @Inject(CacheService)
  private cache!: CacheService;

  constructor() {}
}
```

### 10. Service Lifecycle Hooks

Services can implement optional lifecycle methods:

```typescript
@Injectable()
export class DatabaseService {
  onInit(): void {
    // Called after service is created
  }

  onDestroy(): void {
    // Called before service is destroyed
  }

  setEnv(env: Record<string, any>): void {
    // Custom initialization
  }

  setCtx(context: any): void {
    // Set execution context
  }
}
```

### 11. Service Introspection

Query container state:

```typescript
// Check if service is registered
if (container.has(UserService)) {
  const service = container.resolve(UserService);
}

// Get all service names
const serviceNames = container.getServiceNames();
console.log(serviceNames); // ['DatabaseService', 'UserService', ...]
```

### 12. Error Handling

Clear error messages for common issues:

```typescript
// Service not registered
container.resolve('NonExistent');
// Error: Service 'NonExistent' is not registered in the DI container

// Circular dependency
container.resolve(ServiceA);
// Error: Circular dependency detected while resolving ServiceA
// Stack: ServiceA -> ServiceB -> ServiceA
```

## Advanced Features

### Multi-Level Dependencies

Automatically resolves chains of dependencies:

```typescript
@Injectable()
class EmailService { ... }

@Injectable()
class NotificationService {
  @Inject(EmailService)
  private email!: EmailService;
}

@Injectable()
class UserRegistration {
  @Inject(NotificationService)
  private notifications!: NotificationService;
}

// Automatically resolves: UserRegistration -> NotificationService -> EmailService
const registration = container.resolve(UserRegistration);
```

### Transient Services

Create new instances for each resolution:

```typescript
@Injectable({ singleton: false })
export class RequestLogger {
  id = generateId();

  log(msg: string) {
    console.log(`[${this.id}] ${msg}`);
  }
}

const logger1 = container.resolve(RequestLogger);
const logger2 = container.resolve(RequestLogger);
console.log(logger1 === logger2); // false
```

### Composite Services

Easily compose services with multiple dependencies:

```typescript
@Injectable()
export class SecureApiService {
  @Inject(ApiService)
  private api!: ApiService;

  @Inject(AuthService)
  private auth!: AuthService;

  @Inject(PermissionService)
  private permissions!: PermissionService;

  async secureCall(endpoint: string, user: User) {
    this.auth.verify(user);
    this.permissions.check(user, 'api:call');
    return this.api.call(endpoint);
  }
}
```

### Testing with Mocks

Easy to test with mocked dependencies:

```typescript
const testContainer = new Container();

class MockDatabaseService extends DatabaseService {
  query() { return { mock: true }; }
}

testContainer.register(MockDatabaseService);
testContainer.register(UserService);

const userService = testContainer.resolve(UserService);
// Uses MockDatabaseService automatically!
```

## Performance Characteristics

- **O(1)** singleton lookup and return
- **O(n)** dependency resolution where n = depth of dependency tree
- **O(1)** circular dependency detection per resolve
- **No reflection overhead** - metadata stored in simple Map

## Framework Size

- **container.ts**: ~3 KB
- **decorators.ts**: ~2 KB
- **types.ts**: ~4 KB
- **Total**: ~9 KB (uncompressed)

## Compatibility

- ✅ TypeScript 5.0+
- ✅ SWC compiler
- ✅ Node.js 18+
- ✅ Bun runtime
- ✅ Deno (with proper imports)
- ✅ Browser (with bundler support)
- ✅ ES2020 and later

## Why This Framework?

| Feature | This Framework | reflect-metadata | inversify |
|---------|---|---|---|
| Zero Dependencies | ✅ | ❌ | ❌ |
| SWC Support | ✅ | ⚠️ | ⚠️ |
| Size | 9 KB | 8 KB | 60+ KB |
| Circular Detection | ✅ | ❌ | ✅ |
| Type Safe | ✅ | ✅ | ✅ |
| Easy Setup | ✅ | ⚠️ | ❌ |
| Learn Curve | Minimal | Low | Steep |

## What You Get

- **Simplicity**: Two decorators, one container
- **Power**: Handles complex dependency graphs
- **Performance**: Optimized resolution and caching
- **Type Safety**: Full TypeScript support
- **Flexibility**: Multiple registration strategies
- **Testability**: Easy mocking and testing
- **No Surprises**: Clear error messages and behavior

## Next Steps

- Read the [README.md](./README.md) for complete API documentation
- Check [GETTING_STARTED.md](./GETTING_STARTED.md) for setup instructions
- Review [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) if migrating from another approach
- Explore `examples/` directory for working code
