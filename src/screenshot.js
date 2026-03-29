import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ab } from "./shell.js";

export function screenshot(url, outDir, viewports, { waitUntil = "networkidle", delay = 2000, full = true } = {}) {
  mkdirSync(outDir, { recursive: true });
  const files = [];

  for (const vp of viewports) {
    ab(`set viewport ${vp.width} ${vp.height}`);
    ab(`open ${url}`);
    ab(`wait --load ${waitUntil}`);
    if (delay > 0) ab(`wait ${delay}`);

    const filename = `${vp.label}.png`;
    const filepath = join(outDir, filename);
    const fullFlag = full ? "--full " : "";
    ab(`screenshot ${fullFlag}"${filepath}"`);
    files.push({ viewport: vp.label, path: filepath });
  }

  return files;
}
