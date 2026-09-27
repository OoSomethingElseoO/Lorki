import { spawnSync } from "node:child_process";
import fs from "node:fs";

const baseUrl = process.env.BASE_URL;
if (!baseUrl) throw new Error("BASE_URL is required; pass the deployed or test server URL explicitly");
const output = process.env.LIGHTHOUSE_REPORT ?? "lighthouse-report.json";
const result = spawnSync("npx", ["--yes", "lighthouse", baseUrl, "--output=json", `--output-path=${output}`, "--chrome-flags=--headless --no-sandbox", "--quiet"], {
  stdio: "inherit",
  env: { ...process.env, LIGHTHOUSE_NO_UPDATE_NOTIFIER: "true" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
if (!fs.existsSync(output)) {
  console.error(`Lighthouse did not produce ${output}`);
  process.exit(2);
}
const report = JSON.parse(fs.readFileSync(output, "utf8"));
const scores = Object.fromEntries(Object.entries(report.categories ?? {}).map(([name, category]) => [name, category.score]));
console.log(JSON.stringify({ url: report.finalDisplayedUrl, scores }, null, 2));
