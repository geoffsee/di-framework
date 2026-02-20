import registry from "./registry.ts";
import { Container as ContainerDecorator } from "@di-framework/di-framework/decorators";

export function Controller(
  options: { singleton?: boolean; container?: any } = {},
) {
  // Compose DI registration with OpenAPI registry marking
  const container = ContainerDecorator(options);
  return function (target: any) {
    // Mark for HTTP/OpenAPI purposes
    target.isController = true;
    registry.addTarget(target);

    // Also register with the DI container (same instance as core framework)
    container(target);
  };
}

export function Endpoint(metadata?: {
  summary?: string;
  description?: string;
  requestBody?: any;
  responses?: Record<string, any>;
}) {
  return function (target: any, propertyKey?: string) {
    if (propertyKey) {
      const property = target[propertyKey];

      // For static methods on a class, target is the constructor.
      // If it's a static method, target itself is the constructor.
      const constructor =
        typeof target === "function" ? target : target.constructor;
      registry.addTarget(constructor);

      // We'll let the generator discover the details from the property for now,
      // or we could register it explicitly here if we had path/method info.
      // Since TypedRouter adds path/method to the handler, we keep it as is
      // but we can ensure the metadata is attached.
      property.isEndpoint = true;
      if (metadata) {
        property.metadata = metadata;
      }
    } else {
      target.isEndpoint = true;
      if (metadata) {
        target.metadata = metadata;
      }
      registry.addTarget(target);
    }
  };
}
