import fs from "fs/promises";
import path from "path";
import { MARKETING_DIR } from "./paths.ts";
import { PLATFORMS, type Platform } from "./constants.ts";
import { readJson } from "../../../core/lib/io.ts";

const CONFIG_PATH = path.join(MARKETING_DIR, "config.json");

export interface PlatformConfig {
  disabledPlatforms: string[];
}

export interface ResolvedPlatformConfig {
  disabled: string[];
  enabled: Platform[];
}

async function readRawConfig(): Promise<PlatformConfig> {
  const parsed = await readJson<Partial<PlatformConfig>>(CONFIG_PATH, {});
  return {
    disabledPlatforms: Array.isArray(parsed.disabledPlatforms)
      ? parsed.disabledPlatforms.filter((p): p is string => typeof p === "string")
      : [],
  };
}

export async function getPlatformConfig(): Promise<ResolvedPlatformConfig> {
  const { disabledPlatforms } = await readRawConfig();
  const disabledSet = new Set(disabledPlatforms);
  return {
    disabled: [...disabledSet],
    enabled: PLATFORMS.filter((p) => !disabledSet.has(p)),
  };
}

export async function setDisabledPlatforms(disabled: string[]): Promise<void> {
  const valid = [...new Set(disabled.filter((p) => (PLATFORMS as readonly string[]).includes(p)))];
  const body = JSON.stringify({ disabledPlatforms: valid }, null, 2);
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  const tmp = `${CONFIG_PATH}.tmp`;
  await fs.writeFile(tmp, body, "utf-8");
  await fs.rename(tmp, CONFIG_PATH);
}
