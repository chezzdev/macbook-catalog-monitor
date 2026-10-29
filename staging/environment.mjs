import { readFileSync } from "node:fs";

export const environments = JSON.parse(readFileSync(new URL("../config/server-environments.json", import.meta.url), "utf8"));

export function serverEnvironment(name = process.env.MACBOOK_ENVIRONMENT ?? "staging") {
  if (!Object.hasOwn(environments, name) || !["staging", "production"].includes(name)) throw new Error("Unknown server environment");
  const target = environments[name];
  const origin = new URL(target.origin);
  if (origin.protocol !== "https:" || origin.origin !== target.origin || origin.username || origin.password ||
      !/^[a-z0-9-]+$/.test(target.service) || typeof target.indexable !== "boolean" ||
      (name === "staging" && target.indexable)) throw new Error("Invalid server environment");
  return { ...target, name, outputDirectory: `outputs/${name}`, wranglerConfig: `${name}/wrangler.jsonc` };
}
