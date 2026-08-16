import { access, cp, mkdir, readFile, rename, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const distributionDirectory = path.join(projectRoot, "dist");
const stageDirectory = path.join(tmpdir(), "alexandria-coding-agent-gear-stage");
const generatedKeyPath = `${stageDirectory}.pem`;
const localKeyPath = path.join(projectRoot, ".gear-local-signing-key.pem");
const ignoredDirectoryNames = new Set([".git", "dist", "node_modules", ".idea", ".vscode"]);
const ignoredFileNames = new Set([".env", ".gear-local-signing-key.pem"]);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) => {
      code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}.`));
    });
  });
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const manifest = JSON.parse(await readFile(path.join(projectRoot, "manifest.json"), "utf8"));
const artifactBaseName = `alexandria-coding-agent-gear-v${manifest.version}`;
const crxPath = path.join(distributionDirectory, `${artifactBaseName}.crx`);

await run("node", ["scripts/validate-manifest.mjs"]);
await run("node", ["scripts/smoke-test.mjs"]);
await mkdir(distributionDirectory, { recursive: true });
await rm(stageDirectory, { recursive: true, force: true });
await rm(`${stageDirectory}.crx`, { force: true });
await rm(generatedKeyPath, { force: true });
await rm(crxPath, { force: true });

await cp(projectRoot, stageDirectory, {
  recursive: true,
  filter: (source) => {
    const relative = path.relative(projectRoot, source);
    if (!relative) return true;
    const segments = relative.split(path.sep);
    if (segments.some((segment) => ignoredDirectoryNames.has(segment))) return false;
    const name = path.basename(source);
    if (ignoredFileNames.has(name) || name.endsWith(".pem") || name.endsWith(".crx")) return false;
    return true;
  }
});

const chromiumArguments = [`--pack-extension=${stageDirectory}`];
const configuredKeyPath = process.env.GEAR_EXTENSION_KEY;
const keyPath = configuredKeyPath ? path.resolve(configuredKeyPath) : localKeyPath;
if (await exists(keyPath)) {
  chromiumArguments.push(`--pack-extension-key=${keyPath}`);
}

try {
  await run("chromium", chromiumArguments);
  await rename(`${stageDirectory}.crx`, crxPath);

  if (!(await exists(keyPath)) && await exists(generatedKeyPath)) {
    await rename(generatedKeyPath, localKeyPath);
    console.log(`Created a local signing key at ${localKeyPath}. Keep it private and reuse it for future Gear updates.`);
  }
} finally {
  await rm(stageDirectory, { recursive: true, force: true });
  await rm(generatedKeyPath, { force: true });
}

console.log(`Created Gear direct-install package: ${crxPath}`);
