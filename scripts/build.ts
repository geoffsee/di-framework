import { $ } from "bun";
import { join } from "path";

const PACKAGES = ["packages/di-framework", "packages/di-framework-repo"];

async function build() {
  console.log("🚀 Starting build process...");

  for (const pkgDir of PACKAGES) {
    console.log(`\n📦 Building ${pkgDir}...`);
    const fullPath = join(process.cwd(), pkgDir);

    // 1. Clean dist
    await $`rm -rf ${join(fullPath, "dist")}`;

    // 2. Run tsc
    console.log("  Running tsc...");
    await $`cd ${fullPath} && bun x tsc -p tsconfig.build.json`;

    console.log(`  ✅ Finished building ${pkgDir}`);
  }

  console.log("\n✨ All builds completed successfully!");
}

build().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
