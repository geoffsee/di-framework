import {
  type AggregatedRequirement,
  aggregateRequirements,
  parsePackageId,
  WASI_HTTP_INTERFACE,
  WASI_HTTP_PACKAGE,
  type WitRequirement,
} from './wit.js';

export type HostInterface = {
  name?: string;
  namespace: string;
  package: string;
  version: string;
  interfaces: string[];
  config?: Record<string, string>;
};

export type HostInterfaceOptions = {
  httpHost?: string;
};

function hostInterfaceFromRequirement(
  requirement: AggregatedRequirement,
  options: HostInterfaceOptions,
): HostInterface {
  const { namespace, name } = parsePackageId(requirement.package);
  const entry: HostInterface = {
    namespace,
    package: name,
    version: requirement.version,
    interfaces: [...requirement.interfaces],
  };
  if (requirement.instanceName !== undefined) entry.name = requirement.instanceName;
  if (
    requirement.package === WASI_HTTP_PACKAGE &&
    requirement.interfaces.includes(WASI_HTTP_INTERFACE) &&
    options.httpHost !== undefined
  ) {
    entry.config = { host: options.httpHost };
  }
  return entry;
}

export function hostInterfacesFromRequirements(
  requirements: readonly WitRequirement[],
  options: HostInterfaceOptions = {},
): HostInterface[] {
  return aggregateRequirements(requirements).map((requirement) =>
    hostInterfaceFromRequirement(requirement, options),
  );
}

export function renderHostInterfacesYaml(interfaces: readonly HostInterface[]): string {
  if (interfaces.length === 0) return '';
  const lines = ['      hostInterfaces:'];
  for (const entry of interfaces) {
    if (entry.name !== undefined) {
      lines.push(`        - name: ${yamlQuote(entry.name)}`);
      lines.push(`          namespace: ${entry.namespace}`);
    } else {
      lines.push(`        - namespace: ${entry.namespace}`);
    }
    lines.push(`          package: ${entry.package}`);
    lines.push(`          version: ${yamlQuote(entry.version)}`);
    lines.push('          interfaces:');
    for (const iface of entry.interfaces) lines.push(`            - ${iface}`);
    if (entry.config !== undefined) {
      lines.push('          config:');
      for (const [key, value] of Object.entries(entry.config)) {
        lines.push(`            ${key}: ${yamlQuote(value)}`);
      }
    }
  }
  return lines.join('\n');
}

function yamlQuote(value: string): string {
  return JSON.stringify(value);
}
