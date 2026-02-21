# @di-framework/di-framework

[Documentation](https://geoffsee.github.io/di-framework)

```
npm i @di-framework/di-framework
```

- `packages/di-framework` - core container
- `packages/di-framework-repo` - data access
- `packages/di-framework-http` - http handling
- `packages/examples` - usage examples

## Simple Example

```ts
import { Container, Publisher, Subscriber } from '@di-framework/di-framework';

@Container()
class UserService {
  @Publisher('user.created')
  createUser(name: string) {
    return { id: 1, name };
  }
}

@Container()
class AuditService {
  @Subscriber('user.created')
  onUserCreated(event: any) {
    console.log('User created:', event.result);
  }
}
```
