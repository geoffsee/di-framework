#!/usr/bin/env bun
import { join } from "path";

const COMMANDS: Record<string, string> = {
  build: "Builds the packages in the monorepo",
  test: "Runs the E2E test suite",
  typecheck: "Runs TypeScript type checking across the packages",
  publish: "Publishes the built packages to the npm registry",
};

async function main() {
  const args = process.argv.slice(2);
  const cmdName = args[0];

  if (!cmdName) {
    console.error("Please provide a command\n");
    console.error("Available commands:");
    for (const [name, desc] of Object.entries(COMMANDS)) {
      console.error(`  ${name.padEnd(12)} ${desc}`);
    }
    process.exit(1);
  }

  if (!(cmdName in COMMANDS)) {
    console.error(`Unknown command: ${cmdName}`);
    process.exit(1);
  }

  const cmdFile = join(import.meta.dir, "cmd", `${cmdName}.ts`);

  const worker = new Worker(cmdFile, { env: process.env });

  await new Promise<void>((resolve, reject) => {
    worker.addEventListener("close", () => resolve());
    worker.addEventListener("error", (e) => reject(e));
  });
}

main().catch((err) => {
  console.error("Failed to execute command:", err.message ?? err);
  process.exit(1);
});
