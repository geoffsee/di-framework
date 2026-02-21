import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { SCRIPT_PATH, REPO_ROOT } from "../cmd/test";

describe("test command", () => {
  describe("paths", () => {
    it("e2e script exists at the resolved path", () => {
      expect(existsSync(SCRIPT_PATH)).toBe(true);
    });

    it("e2e script is a bash script", () => {
      const content = readFileSync(SCRIPT_PATH, "utf-8");
      expect(content.startsWith("#!/bin/bash")).toBe(true);
    });

    it("repo root contains package.json", () => {
      expect(existsSync(join(REPO_ROOT, "package.json"))).toBe(true);
    });

    it("repo root contains the packages directory", () => {
      expect(existsSync(join(REPO_ROOT, "packages"))).toBe(true);
    });
  });

  describe("e2e script content", () => {
    it("runs type checks", () => {
      const content = readFileSync(SCRIPT_PATH, "utf-8");
      expect(content).toContain("TypeScript type check");
    });

    it("runs unit tests", () => {
      const content = readFileSync(SCRIPT_PATH, "utf-8");
      expect(content).toContain("bun test");
    });

    it("validates examples", () => {
      const content = readFileSync(SCRIPT_PATH, "utf-8");
      expect(content).toContain("Validating example code");
    });

    it("reports a summary", () => {
      const content = readFileSync(SCRIPT_PATH, "utf-8");
      expect(content).toContain("Test Summary");
    });
  });
});
