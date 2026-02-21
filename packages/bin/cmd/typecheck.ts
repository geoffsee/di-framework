import { $ } from "bun";
import { join } from "path";
import { existsSync } from "fs";

export const PACKAGES = ["packages/di-framework", "packages/di-framework-repo", "packages/di-framework-http", "packages/bin"];

export async function typecheck() {
  console.log("🚀 Starting typecheck process...");

  let hasError = false;

  for (const pkgDir of PACKAGES) {
    console.log(`\n📦 Typechecking ${pkgDir}...`);
    const fullPath = join(process.cwd(), pkgDir);

    if (existsSync(join(fullPath, "tsconfig.build.json"))) {
      try {
        console.log("  Running typecheck...");
        await $`cd ${fullPath} && bun x tsc -p tsconfig.build.json --noEmit`;
        console.log(`  ✅ Passed typecheck for ${pkgDir}`);
      } catch (err) {
        console.error(`  ❌ Typecheck failed for ${pkgDir}`);
        hasError = true;
      }
    } else if (existsSync(join(fullPath, "tsconfig.json"))) {
      try {
        console.log("  Running typecheck...");
        await $`cd ${fullPath} && bun x tsc --noEmit`;
        console.log(`  ✅ Passed typecheck for ${pkgDir}`);
      } catch (err) {
        console.error(`  ❌ Typecheck failed for ${pkgDir}`);
        hasError = true;
      }
    } else {
      console.warn(`  ⚠️ No tsconfig.json found in ${pkgDir}`);
    }
  }

  if (hasError) {
    console.log("\n❌ Typecheck failed for some packages!");
    process.exit(1);
  } else {
    console.log("\n✨ All packages passed typecheck successfully!");
  }
}

if (import.meta.main || !Bun.isMainThread) {
  typecheck().catch((err) => {
    console.error("❌ Typecheck failed with an unexpected error:", err);
    process.exit(1);
  });
}
