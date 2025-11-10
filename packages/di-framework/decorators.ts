/**
 * Dependency Injection Decorators
 *
 * @Container - Marks a class as injectable
 * @Component - Marks dependencies for injection (constructor parameters or properties)
 *
 * Works with SWC and TypeScript's native decorator support.
 * No external dependencies required (no reflect-metadata needed).
 */

import { useContainer, Container as DIContainer, defineMetadata, getOwnMetadata, getMetadata } from './container';

const INJECTABLE_METADATA_KEY = 'di:injectable';
const INJECT_METADATA_KEY = 'di:inject';

/**
 * Marks a class as injectable and registers it with the DI container
 *
 * @param options Configuration options for the injectable service
 *
 * @example
 * @Container()
 * class UserService {
 *   getUser(id: string) { ... }
 * }
 *
 * @example With options
 * @Container({ singleton: false })
 * class RequestScopedService {
 *   // New instance created for each resolution
 * }
 */
export function Container(
  options: { singleton?: boolean; container?: DIContainer } = {}
) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const container = options.container ?? useContainer();
    const singleton = options.singleton ?? true;

    // Mark as injectable using our metadata store
    defineMetadata(INJECTABLE_METADATA_KEY, true, constructor);

    // Register with container
    container.register(constructor, { singleton });

    return constructor;
  };
}

/**
 * Marks a constructor parameter or property for dependency injection
 *
 * Can be used on:
 * - Constructor parameters
 * - Class properties
 *
 * @param target The class to inject dependencies into. Can be a class constructor or a string identifier.
 *
 * @example Constructor parameter injection
 * @Container()
 * class UserController {
 *   constructor(@Component(UserService) userService: UserService) {}
 * }
 *
 * @example Property injection
 * @Container()
 * class UserService {
 *   @Component(DatabaseConnection)
 *   private db: DatabaseConnection;
 * }
 *
 * @example With string identifier
 * @Container()
 * class PaymentService {
 *   constructor(@Component('apiKey') apiKey: string) {}
 * }
 */
export function Component(target: any) {
  return function (
    targetClass: Object | any,
    propertyKey?: string | symbol,
    parameterIndex?: number
  ) {
    // Property injection
    if (propertyKey && parameterIndex === undefined) {
      // Store on both the class and its prototype to ensure it's accessible
      const metadata = getOwnMetadata(INJECT_METADATA_KEY, targetClass) || {};
      metadata[propertyKey as string] = target;
      defineMetadata(INJECT_METADATA_KEY, metadata, targetClass);

      // Also store on the constructor if we have it
      if (targetClass.constructor && targetClass.constructor !== Object) {
        const constructorMetadata = getOwnMetadata(INJECT_METADATA_KEY, targetClass.constructor) || {};
        constructorMetadata[propertyKey as string] = target;
        defineMetadata(INJECT_METADATA_KEY, constructorMetadata, targetClass.constructor);
      }
    }
    // Constructor parameter injection
    else if (parameterIndex !== undefined) {
      const metadata = getOwnMetadata(INJECT_METADATA_KEY, targetClass) || {};
      metadata[`param_${parameterIndex}`] = target;
      defineMetadata(INJECT_METADATA_KEY, metadata, targetClass);
    }
  };
}

/**
 * Check if a class is marked as injectable
 */
export function isInjectable(target: any): boolean {
  return getMetadata(INJECTABLE_METADATA_KEY, target) === true;
}

/**
 * Get the container instance used by decorators
 */
export function getInjectionContainer(): DIContainer {
  return useContainer();
}
