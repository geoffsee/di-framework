# @di-framework/di-framework-repo

A coherent abstraction of repositories and storage adapters for TypeScript, with optional integration for `di-framework`.

## Features

- **Storage Agnostic**: Decouples your business logic from the underlying storage technology (SQL, NoSQL, In-Memory, etc.).
- **Standardized Patterns**: Provides `BaseRepository`, `EntityRepository`, and `SoftDeleteRepository` to handle common data access patterns.
- **Built-in Pagination**: Standardized `Page` and `PaginatedResult` types with built-in support in adapters and repositories.
- **In-Memory Implementation**: Includes a fully functional `InMemoryRepository` for prototyping and testing.
- **DI Integration**: Seamlessly integrates with `di-framework` via the `@Repository` decorator.

## Installation

```bash
bun add @di-framework/di-framework-repo
```

Required for DI integration: If you want to use the `@Repository` decorator for dependency injection, install the DI framework peer dependency.

```bash
bun add @di-framework/di-framework
```

Important: Always import from the scoped package name `@di-framework/di-framework/*`.

Mixing different import IDs (e.g., `di-framework/*` or relative paths to sources) can load a second copy of the library and create a second global container instance.

Correct:

```ts
import { useContainer } from "@di-framework/di-framework/container";
import { Container, Component } from "@di-framework/di-framework/decorators";
```

Avoid:

```ts
import { useContainer } from "di-framework/container"; // Wrong: unscoped id
import { Container } from "../../di-framework/decorators"; // Wrong: relative id
```

## Basic Usage

### 1. Define your Entity

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}
```

### 2. Implement a Repository

You can extend `InMemoryRepository` for quick prototyping:

```typescript
import { InMemoryRepository } from "@di-framework/di-framework-repo";

class UserRepository extends InMemoryRepository<User, number> {
  async findByEmail(email: string): Promise<User | null> {
    const all = await this.findAll();
    return all.find((u) => u.email === email) || null;
  }
}
```

### 3. Use with di-framework

Use the `@Repository` decorator to automatically register your repository with the `di-framework` container.

```typescript
import { Repository } from "@di-framework/di-framework-repo";

@Repository()
class UserRepository extends InMemoryRepository<User, number> {
  // ...
}

// In another service
@Container()
class UserService {
  constructor(@Component(UserRepository) private users: UserRepository) {}

  async listUsers() {
    return this.users.findAll();
  }
}
```

## Storage Adapters

The `StorageAdapter` interface allows you to implement custom backends.

```typescript
import { StorageAdapter, BaseRepository } from "@di-framework/di-framework-repo";

class MyCustomAdapter<E, ID> implements StorageAdapter<E, ID> {
  // Implement findById, save, delete, findPaginated, etc.
}

class MyRepository extends BaseRepository<User, number> {
  constructor(adapter: MyCustomAdapter<User, number>) {
    super(adapter);
  }
}
```

## API Overview

### Repository Classes

- `BaseRepository<E, ID>`: The foundational repository class.
- `EntityRepository<E, ID>`: Standard entity-aware repository.
- `SoftDeleteRepository<E, ID>`: Repository with soft-delete capabilities.
- `InMemoryRepository<E, ID>`: Ready-to-use in-memory implementation.

### Decorators

- `@Repository(options)`: Registers the class as a singleton in `di-framework`.

### Types

- `StorageAdapter<E, ID>`: Interface for storage implementations.
- `Page<T>` / `PaginatedResult<T>`: Standardized pagination metadata.
- `EntityId`: Type alias for `string | number`.
