#!/usr/bin/env node

import { execSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const VIEWPORTS = [
  { label: "desktop", width: 1280, height: 720 },
  { label: "mobile", width: 375, height: 812 },
];

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: "pipe", timeout: opts.timeout ?? 60000, ...opts }).trim();
  } catch (e) {
    if (opts.ignoreError) return e.stdout?.trim() ?? "";
    throw e;
  }
}

function ab(args) {
  return run(`agent-browser ${args}`);
}

function screenshot(url, outDir, viewports, { waitUntil = "networkidle", delay = 2000, full = true } = {}) {
  mkdirSync(outDir, { recursive: true });
  const files = [];

  for (const vp of viewports) {
    ab(`set viewport ${vp.width} ${vp.height}`);
    ab(`open ${url}`);
    ab(`wait --load ${waitUntil}`);
    if (delay > 0) ab(`wait ${delay}`);

    const filename = `${vp.label}.png`;
    const filepath = join(outDir, filename);
    ab(`screenshot ${full ? "--full" : ""} ${filepath}`);
    files.push({ viewport: vp.label, path: filepath });
  }

  return files;
}

function snapshotDom(url1, url2, viewports, { waitUntil = "networkidle" } = {}) {
  const results = [];

  for (const vp of viewports) {
    try {
      ab(`set viewport ${vp.width} ${vp.height}`);
      const json = run(`agent-browser diff url ${url1} ${url2} --wait-until ${waitUntil} --json`, { ignoreError: true, timeout: 90000 });
      const parsed = JSON.parse(json);
      if (parsed.success) {
        results.push({ viewport: vp.label, ...parsed.data.diff });
      } else {
        results.push({ viewport: vp.label, error: parsed.error ?? "diff failed", skipped: true });
      }
    } catch {
      results.push({ viewport: vp.label, error: "DOM diff timed out", skipped: true });
    }
  }

  return results;
}

function compare(url1, url2, pages, outDir, viewports, opts = {}) {
  const results = [];

  for (const page of pages) {
    const fullUrl1 = new URL(page, url1).href;
    const fullUrl2 = new URL(page, url2).href;
    const pageName = page === "/" ? "index" : page.replace(/^\//, "").replace(/\//g, "-");

    console.log(`\n📄 Comparing: ${page}`);
    console.log(`   ${fullUrl1}`);
    console.log(`   ${fullUrl2}`);

    // DOM snapshot diff
    console.log("   🌲 DOM diff...");
    const domResults = snapshotDom(fullUrl1, fullUrl2, viewports, opts);

    // Screenshot comparison
    const baselineDir = join(outDir, "baseline", pageName);
    const currentDir = join(outDir, "current", pageName);
    const diffDir = join(outDir, "diff", pageName);

    console.log("   📸 Screenshots (baseline)...");
    screenshot(fullUrl1, baselineDir, viewports, opts);

    console.log("   📸 Screenshots (current)...");
    screenshot(fullUrl2, currentDir, viewports, opts);

    // Pixel diff via reg-cli
    console.log("   🔍 Pixel diff...");
    mkdirSync(diffDir, { recursive: true });
    const regJsonPath = join(outDir, `reg-${pageName}.json`);

    let pixelResult;
    try {
      run(
        `npx reg-cli ${currentDir} ${baselineDir} ${diffDir} --json ${regJsonPath} --matchingThreshold ${opts.threshold ?? 0}`,
        { ignoreError: true }
      );
      if (existsSync(regJsonPath)) {
        pixelResult = JSON.parse(readFileSync(regJsonPath, "utf8"));
      } else {
        pixelResult = { failedItems: [], newItems: [], deletedItems: [], passedItems: [] };
      }
    } catch {
      pixelResult = { error: "reg-cli failed" };
    }

    const pageResult = {
      page,
      dom: domResults,
      pixel: {
        passed: pixelResult.passedItems?.length ?? 0,
        failed: pixelResult.failedItems?.length ?? 0,
        new: pixelResult.newItems?.length ?? 0,
        deleted: pixelResult.deletedItems?.length ?? 0,
      },
      diffDir,
    };

    results.push(pageResult);

    // Print summary for this page
    for (const d of domResults) {
      if (d.skipped) {
        console.log(`   ⏭️  DOM [${d.viewport}]: skipped (${d.error})`);
        continue;
      }
      const status = d.identical ? "✅" : d.changed ? "⚠️" : "✅";
      console.log(`   ${status} DOM [${d.viewport}]: +${d.additions ?? 0} -${d.removals ?? 0} ~${d.unchanged ?? 0}`);
    }
    const pxStatus = pageResult.pixel.failed === 0 ? "✅" : "❌";
    console.log(`   ${pxStatus} Pixel: ${pageResult.pixel.passed} passed, ${pageResult.pixel.failed} failed`);
  }

  return results;
}

function printUsage() {
  console.log(`
vrt - Visual Regression Testing CLI for AI agents

Usage:
  vrt compare <url1> <url2> [options]    Compare two sites
  vrt snapshot <url> <outDir> [options]  Take baseline screenshots
  vrt diff <dir1> <dir2> [options]       Diff two screenshot directories
  vrt help                               Show this help

Options:
  --pages <paths>          Comma-separated page paths (default: /)
  --viewports <specs>      Comma-separated WxH specs (default: 1280x720,375x812)
  --threshold <0-1>        Pixel matching threshold (default: 0)
  --delay <ms>             Wait after load (default: 2000)
  --wait-until <strategy>  networkidle|load|domcontentloaded (default: networkidle)
  --out <dir>              Output directory (default: ./vrt-output)
  --json                   Output JSON results
  --no-full                Viewport-only screenshots (no full page)

Examples:
  vrt compare https://original.com https://new.com
  vrt compare https://prod.com https://staging.com --pages /,/about,/contact
  vrt compare https://v1.com https://v2.com --viewports 1280x720,768x1024,375x812
  vrt snapshot https://example.com ./baseline --pages /,/about
  vrt diff ./baseline ./current --threshold 0.05
`);
}

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (key === "json" || key === "no-full") {
        args.flags[key] = true;
      } else if (i + 1 < argv.length) {
        args.flags[key] = argv[++i];
      }
    } else {
      args._.push(arg);
    }
    i++;
  }
  return args;
}

function parseViewports(spec) {
  if (!spec) return VIEWPORTS;
  return spec.split(",").map((s) => {
    const [w, h] = s.trim().split("x").map(Number);
    const label = w <= 480 ? "mobile" : w <= 1024 ? "tablet" : "desktop";
    return { label: `${label}-${w}x${h}`, width: w, height: h };
  });
}

// Main
const args = parseArgs(process.argv.slice(2));
const command = args._[0];

if (!command || command === "help") {
  printUsage();
  process.exit(0);
}

const viewports = parseViewports(args.flags.viewports);
const pages = (args.flags.pages ?? "/").split(",").map((p) => p.trim());
const outDir = resolve(args.flags.out ?? "./vrt-output");
const opts = {
  threshold: parseFloat(args.flags.threshold ?? "0"),
  delay: parseInt(args.flags.delay ?? "2000"),
  waitUntil: args.flags["wait-until"] ?? "networkidle",
  full: !args.flags["no-full"],
};

if (command === "compare") {
  const [, url1, url2] = args._;
  if (!url1 || !url2) {
    console.error("Error: vrt compare requires two URLs");
    process.exit(1);
  }

  console.log(`🔬 VRT Compare`);
  console.log(`   Baseline: ${url1}`);
  console.log(`   Current:  ${url2}`);
  console.log(`   Pages:    ${pages.join(", ")}`);
  console.log(`   Viewports: ${viewports.map((v) => `${v.width}x${v.height}`).join(", ")}`);
  console.log(`   Output:   ${outDir}`);

  if (existsSync(outDir)) rmSync(outDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const results = compare(url1, url2, pages, outDir, viewports, opts);

  // Generate HTML report
  const reportDir = join(outDir, "report");
  try {
    run(
      `npx reg-cli ${join(outDir, "current")} ${join(outDir, "baseline")} ${join(outDir, "diff")} --report ${reportDir} --json ${join(outDir, "reg.json")} --matchingThreshold ${opts.threshold}`,
      { ignoreError: true }
    );
  } catch {}

  // Summary
  const totalDom = results.flatMap((r) => r.dom);
  const domIssues = totalDom.filter((d) => d.changed && !d.identical);
  const pixelFails = results.reduce((sum, r) => sum + r.pixel.failed, 0);
  const pixelPasses = results.reduce((sum, r) => sum + r.pixel.passed, 0);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 VRT Summary`);
  console.log(`   Pages tested: ${results.length}`);
  console.log(`   DOM diffs:    ${domIssues.length} issues across ${totalDom.length} checks`);
  console.log(`   Pixel diffs:  ${pixelFails} failed, ${pixelPasses} passed`);
  if (existsSync(join(reportDir, "index.html"))) {
    console.log(`   Report:       ${join(reportDir, "index.html")}`);
  }
  console.log(`   Output:       ${outDir}`);

  const allPassed = domIssues.length === 0 && pixelFails === 0;
  console.log(`\n${allPassed ? "✅ All checks passed!" : "❌ Differences detected."}`);

  if (args.flags.json) {
    console.log(JSON.stringify(results, null, 2));
  }

  process.exit(allPassed ? 0 : 1);
} else if (command === "snapshot") {
  const [, url, dir] = args._;
  if (!url || !dir) {
    console.error("Error: vrt snapshot requires a URL and output directory");
    process.exit(1);
  }

  console.log(`📸 Taking snapshots of ${url}`);
  const resolvedDir = resolve(dir);

  for (const page of pages) {
    const fullUrl = new URL(page, url).href;
    const pageName = page === "/" ? "index" : page.replace(/^\//, "").replace(/\//g, "-");
    const pageDir = join(resolvedDir, pageName);
    console.log(`   ${page}...`);
    screenshot(fullUrl, pageDir, viewports, opts);
  }

  console.log(`✅ Snapshots saved to ${resolvedDir}`);
} else if (command === "diff") {
  const [, dir1, dir2] = args._;
  if (!dir1 || !dir2) {
    console.error("Error: vrt diff requires two directories");
    process.exit(1);
  }

  const diffDir = join(outDir, "diff");
  const reportDir = join(outDir, "report");
  mkdirSync(diffDir, { recursive: true });

  console.log(`🔍 Diffing ${dir1} vs ${dir2}`);
  const result = run(
    `npx reg-cli ${resolve(dir2)} ${resolve(dir1)} ${diffDir} --report ${reportDir} --json ${join(outDir, "reg.json")} --matchingThreshold ${opts.threshold}`,
    { ignoreError: true }
  );
  console.log(result);

  if (existsSync(join(reportDir, "index.html"))) {
    console.log(`📊 Report: ${join(reportDir, "index.html")}`);
  }
} else {
  console.error(`Unknown command: ${command}`);
  printUsage();
  process.exit(1);
}
