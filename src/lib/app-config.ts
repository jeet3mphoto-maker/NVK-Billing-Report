import * as fs from "fs";
import * as path from "path";

const CONFIG_PATH = path.join(process.cwd(), "portal-config.json");

interface AppConfig {
  fc28HistoryPath: string;
}

export function readConfig(): AppConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {
      fc28HistoryPath: process.env.FC28_HISTORY_PATH ?? "",
    };
  }
}

export function writeConfig(updates: Partial<AppConfig>): AppConfig {
  const current = readConfig();
  const next = { ...current, ...updates };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
