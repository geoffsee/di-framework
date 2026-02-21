#!/usr/bin/env bun
import { $ } from "bun";
import { join } from "path";
import { existsSync, readdirSync } from "fs";

const COMMAND_DESCRIPTIONS: Record<string, string> = {
  build: "Builds the packages in the monorepo",
  typecheck: "Runs TypeScript type checking across the packages",
  publish: "Publishes the built packages to the npm registry",
};

async function main() {
  const args = process.argv.slice(2);
  const cmdName = args[0];

  if (!cmdName) {
    console.error("❌ Please provide a command\n");
    console.error("Available commands:");
    
    const cmdDir = join(import.meta.dir, "cmd");
    if (existsSync(cmdDir)) {
      const files = readdirSync(cmdDir);
      for (const file of files) {
        if (file.endsWith(".ts")) {
          const name = file.replace(".ts", "");
          const desc = COMMAND_DESCRIPTIONS[name] || "No description available";
          console.error(`  ${name.padEnd(10)} - ${desc}`);
        }
      }
    }
    
    process.exit(1);
  }

  const cmdFile = join(import.meta.dir, "cmd", `${cmdName}.ts`);

  if (!existsSync(cmdFile)) {
    console.error(`❌ Command not found: ${cmdName}`);
    process.exit(1);
  }

  // Forward the rest of the arguments to the script
  const scriptArgs = args.slice(1);
  
  if (scriptArgs.length > 0) {
    await $`bun run ${cmdFile} ${scriptArgs}`.env(process.env);
  } else {
    await $`bun run ${cmdFile}`.env(process.env);
  }
}

main().catch((err) => {
  console.error("❌ Failed to execute command:", err);
  process.exit(1);
});
