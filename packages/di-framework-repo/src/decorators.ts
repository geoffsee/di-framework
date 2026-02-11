import { Container } from 'di-framework/decorators';

/**
 * Optional decorator to register a repository with di-framework.
 * If di-framework is not present, it will do nothing (but typically it will be present if this is used).
 * 
 * @param options Registration options
 */
export function Repository(options: { singleton?: boolean; container?: any } = {}) {
    try {
        // We try to use di-framework's @Container decorator if it's available
        return Container(options);
    } catch (e) {
        // If di-framework is not available or fails to load, we return a no-op decorator
        return (target: any) => target;
    }
}
