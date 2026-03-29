import { resolve } from "node:path";

const DEFAULT_VIEWPORTS = [
  { label: "desktop", width: 1280, height: 720 },
  { label: "mobile", width: 375, height: 812 },
];

const BOOLEAN_FLAGS = new Set(["json", "no-full", "version"]);

export function parseArgs(argv) {
  const args = { positional: [], flags: {} };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (BOOLEAN_FLAGS.has(key)) {
        args.flags[key] = true;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        args.flags[key] = argv[++i];
      } else {
        console.error(`Error: --${key} requires a value`);
        process.exit(1);
      }
    } else {
      args.positional.push(arg);
    }
    i++;
  }
  return args;
}

export function parseViewports(spec) {
  if (!spec) return DEFAULT_VIEWPORTS;
  return spec.split(",").map((s) => {
    const [w, h] = s.trim().split("x").map(Number);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      console.error(`Error: invalid viewport spec "${s.trim()}". Use WxH format (e.g. 1280x720)`);
      process.exit(1);
    }
    const label = w <= 480 ? "mobile" : w <= 1024 ? "tablet" : "desktop";
    return { label: `${label}-${w}x${h}`, width: w, height: h };
  });
}

const VALID_WAIT_UNTIL = new Set(["networkidle", "load", "domcontentloaded"]);

export function resolveOpts(flags) {
  const threshold = parseFloat(flags.threshold ?? "0");
  if (isNaN(threshold) || threshold < 0 || threshold > 1) {
    console.error("Error: --threshold must be a number between 0 and 1");
    process.exit(1);
  }

  const delay = parseInt(flags.delay ?? "2000");
  if (isNaN(delay) || delay < 0) {
    console.error("Error: --delay must be a non-negative integer");
    process.exit(1);
  }

  const waitUntil = flags["wait-until"] ?? "networkidle";
  if (!VALID_WAIT_UNTIL.has(waitUntil)) {
    console.error(`Error: --wait-until must be one of: ${[...VALID_WAIT_UNTIL].join(", ")}`);
    process.exit(1);
  }

  return {
    viewports: parseViewports(flags.viewports),
    pages: (flags.pages ?? "/").split(",").map((p) => p.trim()),
    outDir: resolve(flags.out ?? "./vrt-output"),
    threshold,
    delay,
    waitUntil,
    full: !flags["no-full"],
    json: !!flags.json,
  };
}

export function pageName(page) {
  return page === "/" ? "index" : page.replace(/^\//, "").replace(/\//g, "-");
}
