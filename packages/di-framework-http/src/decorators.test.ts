import { describe, it, expect } from "bun:test";
import { Controller, Endpoint } from "./decorators.ts";
import registry from "./registry.ts";

describe("Decorators", () => {
  it("should register a controller and its endpoints", () => {
    const initialSize = registry.getTargets().size;

    @Controller()
    class TestController {
      @Endpoint({ summary: "Test endpoint" })
      static test = { isEndpoint: true, path: "/test", method: "get" };
    }

    expect(registry.getTargets().has(TestController)).toBe(true);
    // @ts-ignore
    expect(TestController.isController).toBe(true);
    // @ts-ignore
    expect(TestController.test.isEndpoint).toBe(true);
    // @ts-ignore
    expect(TestController.test.metadata.summary).toBe("Test endpoint");

    expect(registry.getTargets().size).toBeGreaterThan(initialSize);
  });

  it("should work as a class decorator for Endpoint", () => {
    @Endpoint({ summary: "Class level" })
    class ClassEndpoint {}

    expect(registry.getTargets().has(ClassEndpoint)).toBe(true);
    // @ts-ignore
    expect(ClassEndpoint.isEndpoint).toBe(true);
    // @ts-ignore
    expect(ClassEndpoint.metadata.summary).toBe("Class level");
  });

  it("should work on instance methods (via prototype)", () => {
    class InstanceController {
      @Endpoint({ summary: "Instance method" })
      method() {}
    }

    expect(registry.getTargets().has(InstanceController)).toBe(true);
    // @ts-ignore
    expect(InstanceController.prototype.method.isEndpoint).toBe(true);
  });
});
