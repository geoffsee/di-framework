import { $ } from "bun";
import { join } from "path";

const PACKAGES = ["packages/di-framework", "packages/di-framework-repo",  "packages/di-framework-http"];

async function publish() {
  // 1. Run tests first
  console.log("🧪 Running tests...");
  await $`bun test`;

  // 2. Build
  console.log("🏗️  Building packages...");
  await $`bun run scripts/build.ts`;

  // 3. Publish
  for (const pkgDir of PACKAGES) {
    const fullPath = join(process.cwd(), pkgDir);
    const pkgJson = await import(join(fullPath, "package.json"));

    console.log(`\n🚢 Publishing ${pkgJson.name}@${pkgJson.version}...`);

    // Using --access public for scoped packages
    // We use npm publish or bun publish. Bun publish is fine.
    try {
      await $`cd ${fullPath} && bun publish --access public`;
      console.log(`  ✅ Published ${pkgJson.name}`);
    } catch (err) {
      console.error(`  ❌ Failed to publish ${pkgJson.name}:`, err);
      // Depending on needs, we might want to continue or stop
    }
  }

  console.log("\n🏁 Publish process finished!");
}

publish().catch((err) => {
  console.error("❌ Publish script failed:", err);
  process.exit(1);
});
