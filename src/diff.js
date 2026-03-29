import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ab, regCli, exec } from "./shell.js";
import { screenshot } from "./screenshot.js";

export function snapshotDom(url1, url2, viewports, { waitUntil = "networkidle" } = {}) {
  const results = [];

  for (const vp of viewports) {
    try {
      ab(`set viewport ${vp.width} ${vp.height}`);
      const json = exec(
        `agent-browser diff url ${url1} ${url2} --wait-until ${waitUntil} --json`,
        { ignoreError: true, timeout: 90000 },
      );
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

export function pixelDiff(currentDir, baselineDir, diffDir, jsonPath, threshold) {
  mkdirSync(diffDir, { recursive: true });

  try {
    regCli(
      `"${currentDir}" "${baselineDir}" "${diffDir}" --json "${jsonPath}" --matchingThreshold ${threshold}`,
    );
    if (existsSync(jsonPath)) {
      return JSON.parse(readFileSync(jsonPath, "utf8"));
    }
  } catch {}

  return { failedItems: [], newItems: [], deletedItems: [], passedItems: [] };
}

export function comparePage(fullUrl1, fullUrl2, pageName, outDir, viewports, opts) {
  console.log(`   🌲 DOM diff...`);
  const domResults = snapshotDom(fullUrl1, fullUrl2, viewports, opts);

  const baselineDir = join(outDir, "baseline", pageName);
  const currentDir = join(outDir, "current", pageName);
  const diffDir = join(outDir, "diff", pageName);

  console.log(`   📸 Screenshots (baseline)...`);
  screenshot(fullUrl1, baselineDir, viewports, opts);

  console.log(`   📸 Screenshots (current)...`);
  screenshot(fullUrl2, currentDir, viewports, opts);

  console.log(`   🔍 Pixel diff...`);
  const regJsonPath = join(outDir, `reg-${pageName}.json`);
  const pixelResult = pixelDiff(currentDir, baselineDir, diffDir, regJsonPath, opts.threshold);

  return {
    dom: domResults,
    pixel: {
      passed: pixelResult.passedItems?.length ?? 0,
      failed: pixelResult.failedItems?.length ?? 0,
      new: pixelResult.newItems?.length ?? 0,
      deleted: pixelResult.deletedItems?.length ?? 0,
    },
    diffDir,
  };
}
