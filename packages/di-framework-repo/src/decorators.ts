import { Container as ContainerDecorator } from '@di-framework/di-framework/decorators';

/**
 * Repository decorator.
 *
 * This package requires `@di-framework/di-framework` as a peer dependency and
 * delegates to its `@Container` decorator to register repositories with the
 * same singleton/global container instance. Ensure you always import the DI
 * framework using the scoped package name (`@di-framework/di-framework/*`) to
 * avoid loading multiple copies and accidentally creating multiple containers.
 */
export function Repository(options: { singleton?: boolean; container?: any } = {}) {
  return ContainerDecorator(options);
}
