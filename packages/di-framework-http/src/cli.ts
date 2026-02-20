#!/usr/bin/env bun
import fs from "fs";
import path from "path";
import { generateOpenAPI } from "./openapi.ts";

const args = process.argv.slice(2);
const command = args[0];

if (command === "generate") {
  const outputArg = args.indexOf("--output");
  const outputPath = outputArg !== -1 ? args[outputArg + 1] : "openapi.json";

  const controllersArg = args.indexOf("--controllers");
  if (controllersArg === -1) {
    console.error("Error: --controllers path is required");
    process.exit(1);
  }

  const controllersPath = path.resolve(
    process.cwd(),
    args[controllersArg + 1]!,
  );

  async function run() {
    try {
      // Import the user's controllers to trigger registration
      const controllersPathResolved = path.resolve(
        process.cwd(),
        args[controllersArg + 1]!,
      );
      const imported = await import(controllersPathResolved);

      // Try to find if they exported the registry, otherwise use our internal one
      let registryToUse = imported.default || imported.registry;

      if (!registryToUse || typeof registryToUse.getTargets !== "function") {
        try {
          // Try to import from @di-framework/di-framework-http if it exists in node_modules
          // @ts-ignore - this may not exist in development but will in a user project
          const dfHttp = await import("@di-framework/di-framework-http");
          registryToUse = dfHttp.default || dfHttp.registry;
        } catch {
          // Fallback to local import if running from source/bundle
          const regModule = await import("./registry.ts");
          registryToUse = regModule.default;
        }
      }

      const spec = generateOpenAPI(
        {
          title: "API Documentation",
        },
        registryToUse,
      );

      fs.writeFileSync(outputPath!, JSON.stringify(spec, null, 2));
      console.log(`Successfully generated OpenAPI spec at ${outputPath}`);
    } catch (error: any) {
      console.error(`Error generating OpenAPI spec: ${error.message}`);
      process.exit(1);
    }
  }

  run();
} else {
  console.log(`
Usage: di-framework-http generate --controllers <path-to-controllers> [options]

Options:
  --controllers <path>  Path to a file that imports all your decorated controllers
  --output <path>       Path to save the generated JSON (default: openapi.json)
    `);
}
