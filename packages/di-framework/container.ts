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

type ContainerEventName =
  | "registered"
  | "resolved"
  | "cleared"
  | "constructed"
  | "telemetry";
type ContainerEventPayloads = {
  registered: {
    key: string | Constructor;
    singleton: boolean;
    kind: "class" | "factory";
  };
  resolved: {
    key: string | Constructor;
    instance: any;
    singleton: boolean;
    fromCache: boolean;
  };
  constructed: {
    key: Constructor;
    instance: any;
    overrides: Record<number, any>;
  };
  cleared: {
    count: number;
  };
  telemetry: {
    className: string;
    methodName: string;
    args: any[];
    startTime: number;
    endTime?: number;
    result?: any;
    error?: any;
  };
};
type Listener<T> = (payload: T) => void;

const INJECTABLE_METADATA_KEY = "di:injectable";
const INJECT_METADATA_KEY = "di:inject";
const DESIGN_PARAM_TYPES_KEY = "design:paramtypes";
export const TELEMETRY_METADATA_KEY = "di:telemetry";
export const TELEMETRY_LISTENER_METADATA_KEY = "di:telemetry-listener";

/**
 * Simple metadata storage that doesn't require reflect-metadata
 * Works with SWC's native decorator support
 */
const metadataStore = new Map<any, Map<string | symbol, any>>();

function defineMetadata(key: string | symbol, value: any, target: any): void {
  if (!metadataStore.has(target)) {
    metadataStore.set(target, new Map());
  }
  metadataStore.get(target)!.set(key, value);
}

function getMetadata(key: string | symbol, target: any): any {
  return metadataStore.get(target)?.get(key);
}

function hasMetadata(key: string | symbol, target: any): boolean {
  return metadataStore.has(target) && metadataStore.get(target)!.has(key);
}

function getOwnMetadata(key: string | symbol, target: any): any {
  return getMetadata(key, target);
}

export class Container {
  private services = new Map<string | Constructor, ServiceDefinition>();
  private resolutionStack = new Set<string | Constructor>();
  private listeners = new Map<ContainerEventName, Set<Listener<any>>>();

  /**
   * Register a service class as injectable
   */
  public register<T>(
    serviceClass: Constructor<T>,
    options: { singleton?: boolean } = { singleton: true },
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

    this.emit("registered", {
      key: serviceClass,
      singleton: options.singleton ?? true,
      kind: "class",
    });
    return this;
  }

  /**
   * Register a service using a factory function
   */
  public registerFactory<T>(
    name: string,
    factory: ServiceFactory<T>,
    options: { singleton?: boolean } = { singleton: true },
  ): this {
    this.services.set(name, {
      type: factory,
      singleton: options.singleton ?? true,
    });
    this.emit("registered", {
      key: name,
      singleton: options.singleton ?? true,
      kind: "factory",
    });
    return this;
  }

  /**
   * Get or create a service instance
   */
  public resolve<T>(serviceClass: Constructor<T> | string): T {
    const key = typeof serviceClass === "string" ? serviceClass : serviceClass;
    const keyStr =
      typeof serviceClass === "string" ? serviceClass : serviceClass.name;

    // Check for circular dependencies
    if (this.resolutionStack.has(key)) {
      throw new Error(
        `Circular dependency detected while resolving ${keyStr}. Stack: ${Array.from(this.resolutionStack).join(" -> ")} -> ${keyStr}`,
      );
    }

    const definition = this.services.get(key);
    if (!definition) {
      throw new Error(
        `Service '${keyStr}' is not registered in the DI container`,
      );
    }

    const wasCached = definition.singleton && !!definition.instance;

    // Return cached singleton
    if (definition.singleton && definition.instance) {
      this.emit("resolved", {
        key,
        instance: definition.instance,
        singleton: true,
        fromCache: true,
      });
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

      this.emit("resolved", {
        key,
        instance,
        singleton: definition.singleton,
        fromCache: wasCached,
      });

      return instance;
    } finally {
      this.resolutionStack.delete(key);
    }
  }

  /**
   * Construct a new instance without registering it in the container.
   * Supports constructor overrides for primitives/config (constructor pattern).
   * Always returns a fresh instance (no caching).
   */
  public construct<T>(
    serviceClass: Constructor<T>,
    overrides: Record<number, any> = {},
  ): T {
    const keyStr = serviceClass.name;
    if (this.resolutionStack.has(serviceClass)) {
      throw new Error(
        `Circular dependency detected while constructing ${keyStr}. Stack: ${Array.from(this.resolutionStack).join(" -> ")} -> ${keyStr}`,
      );
    }

    this.resolutionStack.add(serviceClass);
    try {
      const instance = this.instantiate<T>(serviceClass, overrides);
      this.emit("constructed", { key: serviceClass, instance, overrides });
      return instance;
    } finally {
      this.resolutionStack.delete(serviceClass);
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
    const count = this.services.size;
    this.services.clear();
    this.emit("cleared", { count });
  }

  /**
   * Get all registered service names
   */
  public getServiceNames(): string[] {
    const names = new Set<string>();
    this.services.forEach((_, key) => {
      if (typeof key === "string") {
        names.add(key);
      }
    });
    return Array.from(names);
  }

  /**
   * Fork the container (prototype pattern): clone registrations into a new container.
   * Optionally carry over existing singleton instances.
   */
  public fork(options: { carrySingletons?: boolean } = {}): Container {
    const clone = new Container();

    this.services.forEach((def, key) => {
      clone.services.set(key, {
        ...def,
        instance: options.carrySingletons ? def.instance : undefined,
      });
    });

    return clone;
  }

  /**
   * Subscribe to container lifecycle events (observer pattern).
   * Returns an unsubscribe function.
   */
  public on<K extends keyof ContainerEventPayloads>(
    event: K,
    listener: Listener<ContainerEventPayloads[K]>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(listener as Listener<any>);
    return () => this.off(event, listener);
  }

  /**
   * Remove a previously registered listener
   */
  public off<K extends keyof ContainerEventPayloads>(
    event: K,
    listener: Listener<ContainerEventPayloads[K]>,
  ): void {
    this.listeners.get(event)?.delete(listener as Listener<any>);
  }

  private emit<K extends keyof ContainerEventPayloads>(
    event: K,
    payload: ContainerEventPayloads[K],
  ): void {
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.size === 0) return;

    listeners.forEach((listener) => {
      try {
        (listener as Listener<any>)(payload);
      } catch (err) {
        console.error(`[Container] listener for '${event}' threw`, err);
      }
    });
  }

  /**
   * Private method to instantiate a service
   */
  private instantiate<T>(
    type: Constructor<T> | ServiceFactory<T>,
    overrides: Record<number, any> = {},
  ): T {
    if (typeof type !== "function") {
      throw new Error("Service type must be a constructor or factory function");
    }

    // If it's a factory function (not a class), just call it
    if (!this.isClass(type)) {
      return (type as ServiceFactory<T>)();
    }

    // Get constructor parameter types from metadata
    const paramTypes = getMetadata(DESIGN_PARAM_TYPES_KEY, type) || [];
    const paramNames = this.getConstructorParamNames(type as Constructor<T>);

    // Resolve dependencies
    const dependencies: any[] = [];
    const injectMetadata = getOwnMetadata(INJECT_METADATA_KEY, type) || {};
    const paramCount = Math.max(paramTypes.length, paramNames.length);
    for (let i = 0; i < paramCount; i++) {
      if (Object.prototype.hasOwnProperty.call(overrides, i)) {
        dependencies.push(overrides[i]);
        continue;
      }

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
            `Cannot resolve dependency of type ${paramType.name} for parameter '${paramName}' in ${type.name}`,
          );
        }
      } else {
        // No information available for this parameter; leave undefined (constructor may provide default)
      }
    }

    // Create instance
    const instance = new (type as Constructor<T>)(...dependencies);

    // Apply Telemetry and TelemetryListener
    this.applyTelemetry(instance, type as Constructor<T>);

    // Call @Component() decorators on properties
    // Check both the instance and the constructor prototype for metadata
    const injectProperties = getMetadata(INJECT_METADATA_KEY, type) || {};
    const protoInjectProperties =
      getMetadata(INJECT_METADATA_KEY, (type as Constructor<T>).prototype) ||
      {};

    const allInjectProperties = {
      ...injectProperties,
      ...protoInjectProperties,
    };

    Object.entries(allInjectProperties).forEach(
      ([propName, targetType]: [string, any]) => {
        if (!propName.startsWith("param_") && targetType) {
          try {
            (instance as any)[propName] = this.resolve(targetType);
          } catch (error) {
            console.warn(
              `Failed to inject property '${propName}' on ${type.name}:`,
              error,
            );
          }
        }
      },
    );

    return instance;
  }

  /**
   * Apply telemetry tracking and listeners to an instance
   */
  private applyTelemetry<T>(instance: T, constructor: Constructor<T>): void {
    const className = constructor.name;

    // Handle @TelemetryListener
    const listenerMethods: string[] =
      getMetadata(TELEMETRY_LISTENER_METADATA_KEY, constructor.prototype) || [];
    listenerMethods.forEach((methodName) => {
      const method = (instance as any)[methodName];
      if (typeof method === "function") {
        this.on("telemetry", (payload) => {
          try {
            method.call(instance, payload);
          } catch (err) {
            console.error(
              `[Container] TelemetryListener '${className}.${methodName}' threw`,
              err,
            );
          }
        });
      }
    });

    // Handle @Telemetry
    const telemetryMethods: Record<string, any> =
      getMetadata(TELEMETRY_METADATA_KEY, constructor.prototype) || {};
    Object.entries(telemetryMethods).forEach(([methodName, options]) => {
      const originalMethod = (instance as any)[methodName];
      if (typeof originalMethod === "function") {
        const self = this;
        (instance as any)[methodName] = function (...args: any[]) {
          const startTime = Date.now();
          const emit = (result?: any, error?: any) => {
            const payload = {
              className,
              methodName,
              args,
              startTime,
              endTime: Date.now(),
              result,
              error,
            };

            if (options.logging) {
              const duration = payload.endTime - payload.startTime;
              const status = error
                ? `ERROR: ${error.message || error}`
                : "SUCCESS";
              console.log(
                `[Telemetry] ${className}.${methodName} - ${status} (${duration}ms)`,
              );
            }

            self.emit("telemetry", payload);
          };

          try {
            const result = originalMethod.apply(this, args);

            if (result instanceof Promise) {
              return result
                .then((val) => {
                  emit(val);
                  return val;
                })
                .catch((err) => {
                  emit(undefined, err);
                  throw err;
                });
            }

            emit(result);
            return result;
          } catch (err) {
            emit(undefined, err);
            throw err;
          }
        };
      }
    });
  }

  /**
   * Check if a function is a class constructor
   */
  private isClass(func: Function): boolean {
    return (
      typeof func === "function" &&
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
    if (!match || !match[1]) return [];

    const paramsStr = match[1];
    return paramsStr
      .split(",")
      .map((param) => {
        const trimmed = param.trim();
        const withoutDefault = trimmed.split("=")[0] || "";
        const withoutType = withoutDefault.split(":")[0] || "";
        return withoutType.trim();
      })
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
    const decoratorMatch = funcStr.match(
      /__decorate\(\[\s*(?:\w+\s*\([^)]*\),?\s*)*__param\((\d+),\s*(\w+)\([^)]*\)\)/g,
    );

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
export function useContainer(): Container {
  return container;
}

/**
 * Export metadata functions for use in decorators
 * These provide a simple, reflect-metadata-free way to store and access metadata
 */
export { defineMetadata, getMetadata, hasMetadata, getOwnMetadata };
