export interface EndpointMetadata {
  summary?: string;
  description?: string;
  requestBody?: any;
  responses?: Record<string, any>;
  [key: string]: any;
}

export interface RegisteredEndpoint {
  target: any;
  propertyKey: string;
  path: string;
  method: string;
  metadata: EndpointMetadata;
}

export class Registry {
  private targets = new Set<any>();

  addTarget(target: any) {
    this.targets.add(target);
  }

  getTargets() {
    return this.targets;
  }
}

const GLOBAL_KEY = Symbol.for('@di-framework/http-registry');

const registry: Registry =
  (globalThis as any)[GLOBAL_KEY] ?? ((globalThis as any)[GLOBAL_KEY] = new Registry());

export default registry;
