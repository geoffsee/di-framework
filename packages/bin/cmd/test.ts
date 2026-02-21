import { $ } from "bun";
import { join } from "path";

export const SCRIPT_PATH = join(import.meta.dir, "..", "scripts", "e2e-test.sh");
export const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

export async function test() {
  await $`bash ${SCRIPT_PATH}`.cwd(REPO_ROOT).env(process.env);
}

if (import.meta.main || !Bun.isMainThread) {
  test().catch((err) => {
    console.error("❌ Tests failed:", err);
    process.exit(1);
  });
}
