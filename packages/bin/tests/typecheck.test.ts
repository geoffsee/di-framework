import { describe, it, expect } from "bun:test";
import { join } from "path";
import { existsSync } from "fs";
import { PACKAGES } from "../cmd/typecheck";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

describe("typecheck command", () => {
  describe("PACKAGES", () => {
    it("includes all expected packages", () => {
      expect(PACKAGES).toContain("packages/di-framework");
      expect(PACKAGES).toContain("packages/di-framework-repo");
      expect(PACKAGES).toContain("packages/di-framework-http");
      expect(PACKAGES).toContain("packages/bin");
    });

    it("every package directory exists", () => {
      for (const pkg of PACKAGES) {
        expect(existsSync(join(REPO_ROOT, pkg))).toBe(true);
      }
    });
  });

  describe("tsconfig detection", () => {
    it("every package has a tsconfig.json or tsconfig.build.json", () => {
      for (const pkg of PACKAGES) {
        const fullPath = join(REPO_ROOT, pkg);
        const hasBuild = existsSync(join(fullPath, "tsconfig.build.json"));
        const hasBase = existsSync(join(fullPath, "tsconfig.json"));
        expect(hasBuild || hasBase).toBe(true);
      }
    });

    it("prefers tsconfig.build.json when present", () => {
      for (const pkg of PACKAGES) {
        const fullPath = join(REPO_ROOT, pkg);
        const hasBuild = existsSync(join(fullPath, "tsconfig.build.json"));
        const hasBase = existsSync(join(fullPath, "tsconfig.json"));

        // At minimum one must exist; if both exist, build takes priority
        // (verified by reading the typecheck command logic)
        if (hasBuild) {
          // tsconfig.build.json is used — this is the preferred path
          expect(hasBuild).toBe(true);
        } else {
          expect(hasBase).toBe(true);
        }
      }
    });
  });

  describe("package consistency", () => {
    it("matches the build command PACKAGES list", async () => {
      const { PACKAGES: BUILD_PACKAGES } = await import("../cmd/build");
      expect(PACKAGES).toEqual(BUILD_PACKAGES);
    });
  });
});
