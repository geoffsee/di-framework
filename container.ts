/**
 * Dependency Injection Container
 *
 * Manages service registration, dependency resolution, and instance lifecycle.
 * Supports singleton pattern and automatic dependency injection via decorators.
 * Works with SWC and TypeScript's native decorator support.
 */

type Constructor<T = any> = new (...args: any[]) => T;
type ServiceFactory<T = any> = () => T;
type ServiceDefinition<T = any> = {
  type: Constructor<T> | ServiceFactory<T>;
  singleton: boolean;
  instance?: T;
};

const INJECTABLE_METADATA_KEY = 'di:injectable';
const INJECT_METADATA_KEY = 'di:inject';
const DESIGN_PARAM_TYPES_KEY = 'design:paramtypes';

/**
 * Simple metadata storage that doesn't require reflect-metadata
 * Works with SWC's native decorator support
 */
const metadataStore = new Map<any, Map<string | symbol, any>>();

function defineMetadata(
  key: string | symbol,
  value: any,
  target: any
): void {
  if (!metadataStore.has(target)) {
    metadataStore.set(target, new Map());
  }
  metadataStore.get(target)!.set(key, value);
}

function getMetadata(
  key: string | symbol,
  target: any
): any {
  return metadataStore.get(target)?.get(key);
}

function hasMetadata(
  key: string | symbol,
  target: any
): boolean {
  return metadataStore.has(target) && metadataStore.get(target)!.has(key);
}

function getOwnMetadata(
  key: string | symbol,
  target: any
): any {
  return getMetadata(key, target);
}

export class Container {
  private services = new Map<string | Constructor, ServiceDefinition>();
  private resolutionStack = new Set<string | Constructor>();

  /**
   * Register a service class as injectable
   */
  public register<T>(
    serviceClass: Constructor<T>,
    options: { singleton?: boolean } = { singleton: true }
  ): this {
    const name = serviceClass.name;
    this.services.set(name, {
      type: serviceClass,
      singleton: options.singleton ?? true,
    });
    this.services.set(serviceClass, {
      type: serviceClass,
      singleton: options.singleton ?? true,
    });
    return this;
  }

  /**
   * Register a service using a factory function
   */
  public registerFactory<T>(
    name: string,
    factory: ServiceFactory<T>,
    options: { singleton?: boolean } = { singleton: true }
  ): this {
    this.services.set(name, {
      type: factory,
      singleton: options.singleton ?? true,
    });
    return this;
  }

  /**
   * Get or create a service instance
   */
  public resolve<T>(serviceClass: Constructor<T> | string): T {
    const key = typeof serviceClass === 'string' ? serviceClass : serviceClass;
    const keyStr = typeof serviceClass === 'string' ? serviceClass : serviceClass.name;

    // Check for circular dependencies
    if (this.resolutionStack.has(key)) {
      throw new Error(
        `Circular dependency detected while resolving ${keyStr}. Stack: ${Array.from(this.resolutionStack).join(' -> ')} -> ${keyStr}`
      );
    }

    const definition = this.services.get(key);
    if (!definition) {
      throw new Error(`Service '${keyStr}' is not registered in the DI container`);
    }

    // Return cached singleton
    if (definition.singleton && definition.instance) {
      return definition.instance;
    }

    // Resolve dependencies
    this.resolutionStack.add(key);
    try {
      const instance = this.instantiate<T>(definition.type);

      // Cache singleton
      if (definition.singleton) {
        definition.instance = instance;
      }

      return instance;
    } finally {
      this.resolutionStack.delete(key);
    }
  }

  /**
   * Check if a service is registered
   */
  public has(serviceClass: Constructor | string): boolean {
    return this.services.has(serviceClass);
  }

  /**
   * Clear all registered services
   */
  public clear(): void {
    this.services.clear();
  }

  /**
   * Get all registered service names
   */
  public getServiceNames(): string[] {
    const names = new Set<string>();
    this.services.forEach((_, key) => {
      if (typeof key === 'string') {
        names.add(key);
      }
    });
    return Array.from(names);
  }

  /**
   * Private method to instantiate a service
   */
  private instantiate<T>(type: Constructor<T> | ServiceFactory<T>): T {
    if (typeof type !== 'function') {
      throw new Error('Service type must be a constructor or factory function');
    }

    // If it's a factory function (not a class), just call it
    if (!this.isClass(type)) {
      return (type as ServiceFactory<T>)();
    }

    // Get constructor parameter types from metadata
    const paramTypes = getMetadata(DESIGN_PARAM_TYPES_KEY, type) || [];
    const paramNames = this.getConstructorParamNames(type);

    // Resolve dependencies
    const dependencies: any[] = [];
    const injectMetadata = getOwnMetadata(INJECT_METADATA_KEY, type) || {};
    const paramCount = Math.max(paramTypes.length, paramNames.length);
    for (let i = 0; i < paramCount; i++) {
      const paramType = paramTypes[i];
      const paramName = paramNames[i];

      // Prefer explicit @Component() decorator when present
      const paramInjectTarget = injectMetadata[`param_${i}`];

      if (paramInjectTarget) {
        // Use explicit injection target (can be class or string token)
        dependencies.push(this.resolve(paramInjectTarget));
      } else if (paramType && paramType !== Object) {
        // Try to resolve by type when metadata is available
        if (this.has(paramType)) {
          dependencies.push(this.resolve(paramType));
        } else if (this.has(paramType.name)) {
          dependencies.push(this.resolve(paramType.name));
        } else {
          throw new Error(
            `Cannot resolve dependency of type ${paramType.name} for parameter '${paramName}' in ${type.name}`
          );
        }
      } else {
        // No information available for this parameter; leave undefined (constructor may provide default)
      }
    }

    // Create instance
    const instance = new (type as Constructor<T>)(...dependencies);

    // Call @Component() decorators on properties
    // Check both the instance and the constructor prototype for metadata
    const injectProperties = getMetadata(INJECT_METADATA_KEY, type) || {};
    const protoInjectProperties = getMetadata(INJECT_METADATA_KEY, (type as Constructor<T>).prototype) || {};

    const allInjectProperties = { ...injectProperties, ...protoInjectProperties };

    Object.entries(allInjectProperties).forEach(([propName, targetType]: [string, any]) => {
      if (!propName.startsWith('param_') && targetType) {
        try {
          (instance as any)[propName] = this.resolve(targetType);
        } catch (error) {
          console.warn(`Failed to inject property '${propName}' on ${type.name}:`, error);
        }
      }
    });

    return instance;
  }

  /**
   * Check if a function is a class constructor
   */
  private isClass(func: Function): boolean {
    return (
      typeof func === 'function' &&
      func.prototype &&
      func.prototype.constructor === func
    );
  }

  /**
   * Extract parameter names from constructor
   */
  private getConstructorParamNames(target: Constructor): string[] {
    const funcStr = target.toString();
    const match = funcStr.match(/constructor\s*\(([^)]*)\)/);
    if (!match) return [];

    return match[1]
      .split(',')
      .map((param) => param.trim().split('=')[0].split(':')[0].trim())
      .filter((param) => param);
  }

  /**
   * Extract parameter types from TypeScript compiled code
   * Looks for type annotations in the compiled constructor signature
   */
  private extractParamTypesFromSource(target: Constructor): any[] {
    const funcStr = target.toString();

    // Try to extract types from decorated constructor
    // In compiled TypeScript with emitDecoratorMetadata, types appear in decorator calls
    const decoratorMatch = funcStr.match(/__decorate\(\[\s*(?:\w+\s*\([^)]*\),?\s*)*__param\((\d+),\s*(\w+)\([^)]*\)\)/g);

    if (decoratorMatch) {
      // Found decorator-based metadata
      return [];
    }

    // Return empty array - will fall back to type annotations or @Component decorators
    return [];
  }
}

/**
 * Global DI container instance
 */
export const container = new Container();

/**
 * Get the global DI container
 */
export function getContainer(): Container {
  return container;
}

/**
 * Export metadata functions for use in decorators
 * These provide a simple, reflect-metadata-free way to store and access metadata
 */
export { defineMetadata, getMetadata, hasMetadata, getOwnMetadata };
