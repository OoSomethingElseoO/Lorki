import fs from "node:fs";

const budget = JSON.parse(fs.readFileSync(new URL("../performance-budget.json", import.meta.url)));
const reportPath = process.env.PERFORMANCE_REPORT ?? "performance-report.json";
if (!fs.existsSync(reportPath)) {
  console.error(`Performance report not found: ${reportPath}`);
  process.exit(2);
}
const report = JSON.parse(fs.readFileSync(reportPath));
const failures = [];
const checks = [
  ["lcpMs", "maxLcpMs"], ["fcpMs", "maxFcpMs"], ["ttfbMs", "maxTtfbMs"],
  ["inpMs", "maxInpMs"], ["cls", "maxCls"], ["longTasks", "maxLongTasks"],
  ["transferBytes", "maxTransferBytes"],
];
for (const [actual, limit] of checks) {
  if (typeof report[actual] === "number" && report[actual] > budget[limit]) failures.push(`${actual} ${report[actual]} > ${budget[limit]}`);
}
if (failures.length) { console.error(`Performance budget failed:\n- ${failures.join("\n- ")}`); process.exit(1); }
console.log("Performance budget passed", JSON.stringify(report));
