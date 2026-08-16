import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const manifestPath = path.join(projectRoot, "manifest.json");
const errors = [];

async function fileExists(relativePath) {
  try {
    await access(path.join(projectRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

let manifest;
try {
  manifest = JSON.parse(await readFile(manifestPath, "utf8"));
} catch (error) {
  console.error(`Unable to parse manifest.json: ${error.message}`);
  process.exit(1);
}

assert(manifest.manifest_version === 3, "manifest_version must be 3.");
assert(typeof manifest.name === "string" && manifest.name.length > 0, "name is required.");
assert(typeof manifest.version === "string" && manifest.version.length > 0, "version is required.");
assert(manifest.background?.service_worker, "A background service worker is required.");
assert(manifest.action?.default_popup, "An action default_popup is required.");
assert(manifest.side_panel?.default_path, "A side_panel default_path is required.");
assert(manifest.options_ui?.page, "An options_ui page is required.");
assert(
  !Object.hasOwn(manifest, "host_permissions") || manifest.host_permissions.length === 0,
  "Initial website access must remain optional; do not add blanket host_permissions."
);
assert(
  Array.isArray(manifest.optional_host_permissions) && manifest.optional_host_permissions.includes("https://*/*"),
  "optional_host_permissions must permit consent-gated HTTPS provider and site access."
);
assert(
  Array.isArray(manifest.permissions) && manifest.permissions.includes("storage"),
  "storage permission is required for local settings."
);
assert(
  Array.isArray(manifest.permissions) && manifest.permissions.includes("sidePanel"),
  "sidePanel permission is required for the coding-agent workspace."
);
assert(
  Array.isArray(manifest.permissions) && manifest.permissions.includes("scripting"),
  "scripting permission is required for user-initiated context capture."
);
assert(
  Array.isArray(manifest.permissions) && manifest.permissions.includes("activeTab"),
  "activeTab permission is required for user-initiated active-page interaction."
);

const entrypoints = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.side_panel?.default_path,
  manifest.options_ui?.page,
  "src/providers/openai-compatible.js",
  "src/agent/run-agent.js",
  "src/agent/page-tools.js",
  "src/adapters/page-adapter.js"
].filter(Boolean);

for (const entrypoint of entrypoints) {
  assert(await fileExists(entrypoint), `Missing manifest entrypoint: ${entrypoint}`);
}

if (errors.length) {
  console.error("Manifest validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Manifest validation passed.");
console.log(`Validated ${entrypoints.length} extension entrypoints and execution modules from ${manifestPath}.`);
