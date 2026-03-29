import { existsSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, resolveOpts, pageName } from "./args.js";
import { checkAgentBrowser, regCli } from "./shell.js";
import { screenshot } from "./screenshot.js";
import { comparePage } from "./diff.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PKG = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

function printUsage() {
  console.log(`
vrt v${PKG.version} - Visual Regression Testing CLI for AI agents

Usage:
  vrt compare <url1> <url2> [options]    Compare two sites
  vrt snapshot <url> <outDir> [options]  Take baseline screenshots
  vrt diff <dir1> <dir2> [options]       Diff two screenshot directories
  vrt help                               Show this help
  vrt --version                          Show version

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

function safeClearDir(dir) {
  const critical = ["/", resolve(process.env.HOME ?? "/"), resolve(process.env.HOME ?? "/", "Desktop")];
  if (critical.includes(dir)) {
    console.error(`Error: refusing to delete ${dir}`);
    process.exit(1);
  }
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
}

function printDomResult(d) {
  if (d.skipped) {
    console.log(`   ⏭️  DOM [${d.viewport}]: skipped (${d.error})`);
    return;
  }
  const hasDiff = (d.additions ?? 0) > 0 || (d.removals ?? 0) > 0;
  const status = d.identical || !hasDiff ? "✅" : "⚠️";
  console.log(`   ${status} DOM [${d.viewport}]: +${d.additions ?? 0} -${d.removals ?? 0} ~${d.unchanged ?? 0}`);
}

function cmdCompare(args, opts) {
  const [, url1, url2] = args.positional;
  if (!url1 || !url2) {
    console.error("Error: vrt compare requires two URLs");
    process.exit(1);
  }

  checkAgentBrowser();

  console.log(`🔬 VRT Compare`);
  console.log(`   Baseline: ${url1}`);
  console.log(`   Current:  ${url2}`);
  console.log(`   Pages:    ${opts.pages.join(", ")}`);
  console.log(`   Viewports: ${opts.viewports.map((v) => `${v.width}x${v.height}`).join(", ")}`);
  console.log(`   Output:   ${opts.outDir}`);

  safeClearDir(opts.outDir);

  const results = [];

  for (const page of opts.pages) {
    const fullUrl1 = new URL(page, url1).href;
    const fullUrl2 = new URL(page, url2).href;
    const name = pageName(page);

    console.log(`\n📄 Comparing: ${page}`);
    console.log(`   ${fullUrl1}`);
    console.log(`   ${fullUrl2}`);

    const result = comparePage(fullUrl1, fullUrl2, name, opts.outDir, opts.viewports, opts);
    results.push({ page, ...result });

    for (const d of result.dom) printDomResult(d);
    const pxStatus = result.pixel.failed === 0 ? "✅" : "❌";
    console.log(`   ${pxStatus} Pixel: ${result.pixel.passed} passed, ${result.pixel.failed} failed`);
  }

  // Generate HTML report
  const reportDir = join(opts.outDir, "report");
  try {
    regCli(
      `"${join(opts.outDir, "current")}" "${join(opts.outDir, "baseline")}" "${join(opts.outDir, "diff")}" --report "${reportDir}" --json "${join(opts.outDir, "reg.json")}" --matchingThreshold ${opts.threshold}`,
    );
  } catch {}

  // Summary
  const totalDom = results.flatMap((r) => r.dom);
  const domIssues = totalDom.filter((d) => !d.skipped && ((d.additions ?? 0) > 0 || (d.removals ?? 0) > 0));
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
  console.log(`   Output:       ${opts.outDir}`);

  const allPassed = domIssues.length === 0 && pixelFails === 0;
  console.log(`\n${allPassed ? "✅ All checks passed!" : "❌ Differences detected."}`);

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  }

  process.exit(allPassed ? 0 : 1);
}

function cmdSnapshot(args, opts) {
  const [, url, dir] = args.positional;
  if (!url || !dir) {
    console.error("Error: vrt snapshot requires a URL and output directory");
    process.exit(1);
  }

  checkAgentBrowser();

  console.log(`📸 Taking snapshots of ${url}`);
  const resolvedDir = resolve(dir);

  for (const page of opts.pages) {
    const fullUrl = new URL(page, url).href;
    const pageDir = join(resolvedDir, pageName(page));
    console.log(`   ${page}...`);
    screenshot(fullUrl, pageDir, opts.viewports, opts);
  }

  console.log(`✅ Snapshots saved to ${resolvedDir}`);
}

function cmdDiff(args, opts) {
  const [, dir1, dir2] = args.positional;
  if (!dir1 || !dir2) {
    console.error("Error: vrt diff requires two directories");
    process.exit(1);
  }

  const diffDir = join(opts.outDir, "diff");
  const reportDir = join(opts.outDir, "report");
  mkdirSync(diffDir, { recursive: true });

  console.log(`🔍 Diffing ${dir1} vs ${dir2}`);
  const result = regCli(
    `"${resolve(dir2)}" "${resolve(dir1)}" "${diffDir}" --report "${reportDir}" --json "${join(opts.outDir, "reg.json")}" --matchingThreshold ${opts.threshold}`,
  );
  console.log(result);

  if (existsSync(join(reportDir, "index.html"))) {
    console.log(`📊 Report: ${join(reportDir, "index.html")}`);
  }
}

export function run(argv) {
  const args = parseArgs(argv);
  const command = args.positional[0];

  if (args.flags.version) {
    console.log(`vrt v${PKG.version}`);
    process.exit(0);
  }

  if (!command || command === "help") {
    printUsage();
    process.exit(0);
  }

  const opts = resolveOpts(args.flags);

  switch (command) {
    case "compare":
      cmdCompare(args, opts);
      break;
    case "snapshot":
      cmdSnapshot(args, opts);
      break;
    case "diff":
      cmdDiff(args, opts);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}
