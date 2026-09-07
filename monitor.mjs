import { appendFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const origin = "https://macbook-catalog-staging.chezzdev.workers.dev";
const repo = "chezzdev/macbook-catalog-monitor";
const fetchJson = async (url, init = {}) => {
  const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(10_000) });
  const value = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return value;
};
export function verifyReadiness(live, registry, health, now = Date.now()) {
  if (!live.live || live.service !== "macbook-catalog-staging") throw new Error("Worker identity check failed");
  const ids = registry.markets?.map((m) => m.id).sort();
  if (!health.ready || !ids?.length || JSON.stringify(ids) !== JSON.stringify(health.markets?.map((m) => m.marketId).sort())) {
    throw new Error("One or more markets are unavailable");
  }
  for (const m of health.markets) {
    if (!m.ready) throw new Error(`${m.marketId}: market is not ready`);
    for (const [field, maximumHours] of [["inventoryCheckedAt", 3], ["pricesCheckedAt", 36], ["fxCheckedAt", 36]]) {
      const age = now - Date.parse(m[field]);
      if (!Number.isFinite(age) || age < -60_000 || age > maximumHours * 60 * 60_000) throw new Error(`${m.marketId}: ${field} is stale or invalid`);
    }
  }
}

export async function runMonitor() {
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [live, registry, health] = await Promise.all(["/health/live", "/api/v1/markets", "/health/ready"].map((route) => fetchJson(`${origin}${route}`)));
      verifyReadiness(live, registry, health);
      result = { checkedAt: new Date().toISOString(), ready: true, releaseId: live.releaseId, markets: health.markets };
      break;
    } catch (error) {
      result = { checkedAt: new Date().toISOString(), ready: false, error: error.message };
      if (attempt < 2) await delay(5000);
    }
  }
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `## Catalog staging ${result.ready ? "healthy" : "requires attention"}\n\nChecked ${result.checkedAt}.\n\n[Staging](${origin}/) · [Operations](${origin}/ops/)\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`);

  // Public status contains only the public health fields. A daily observation also
  // keeps this monitoring repository active so GitHub does not disable its schedule.
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY === repo) {
    const url = `https://api.github.com/repos/${repo}/contents/status.json`;
    const headers = { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28", "content-type": "application/json" };
    let existing;
    const response = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(10_000) });
    if (response.ok) existing = await response.json();
    else if (response.status !== 404) throw new Error(`Cannot read monitoring history: HTTP ${response.status}`);
    const previous = existing ? JSON.parse(Buffer.from(existing.content, "base64").toString()) : null;
    if (!previous || previous.ready !== result.ready || previous.checkedAt.slice(0, 10) !== result.checkedAt.slice(0, 10)) {
      await fetchJson(url, { method: "PUT", headers, body: JSON.stringify({
        message: `Record ${result.ready ? "healthy" : "failed"} staging observation`,
        content: Buffer.from(JSON.stringify(result, null, 2) + "\n").toString("base64"),
        ...(existing ? { sha: existing.sha } : {}),
      }) });
    }
  }
  if (!result.ready) process.exitCode = 1;
  return result;
}
if (process.argv[1]?.endsWith("/monitor.mjs") || process.argv[1] === "monitor.mjs") await runMonitor();
