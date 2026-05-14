import fs from "fs/promises";
import path from "path";
import { CLI_DIR } from "./paths.ts";

/**
 * Loads and concatenates the shared post rules with per-platform rules.
 * Throws with a clear error if either file is missing.
 */
export async function loadWritePrompt(platform: string): Promise<string> {
  const sharedPath = path.join(CLI_DIR, "write-post-shared.md");
  const platformPath = path.join(CLI_DIR, `write-post-${platform}.md`);

  const [shared, platformRules] = await Promise.all([
    fs.readFile(sharedPath, "utf-8").catch(() => {
      throw new Error(`Missing shared prompt file: ${sharedPath}`);
    }),
    fs.readFile(platformPath, "utf-8").catch(() => {
      throw new Error(`Missing prompt file for platform "${platform}": ${platformPath}`);
    }),
  ]);

  return `${shared.trim()}\n\n${platformRules.trim()}`;
}
