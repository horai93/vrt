import { execSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REG_CLI = join(__dirname, "..", "node_modules", ".bin", "reg-cli");

export function exec(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: "pipe",
      timeout: opts.timeout ?? 60000,
      ...opts,
    }).trim();
  } catch (e) {
    if (opts.ignoreError) return e.stdout?.trim() ?? "";
    throw e;
  }
}

export function ab(args) {
  return exec(`agent-browser ${args}`);
}

export function regCli(args) {
  return exec(`"${REG_CLI}" ${args}`);
}

export function checkAgentBrowser() {
  try {
    exec("agent-browser --version", { timeout: 5000 });
  } catch {
    console.error("Error: agent-browser is not installed or not in PATH.");
    console.error("Install it first: npm i -g agent-browser");
    process.exit(1);
  }
}
