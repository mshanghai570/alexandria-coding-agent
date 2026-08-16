import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const distributionDirectory = path.join(projectRoot, "dist");
const packagePath = path.join(distributionDirectory, "alexandria-coding-agent-v0.1.0.zip");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit"
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}.`));
      }
    });
  });
}

await run("node", ["scripts/validate-manifest.mjs"]);
await mkdir(distributionDirectory, { recursive: true });
await rm(packagePath, { force: true });

await run("zip", [
  "-r",
  packagePath,
  ".",
  "-x",
  "dist/*",
  "node_modules/*",
  ".git/*",
  ".env",
  ".env.*",
  "*.zip",
  ".DS_Store",
  "Thumbs.db"
]);

console.log(`Created ${packagePath}`);
