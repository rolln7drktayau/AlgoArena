import { useAppStore } from "../store/useAppStore";
import english from "./en.json";

/** Translate interface copy; scientific identifiers and saved data stay unchanged. */
export function t(source: string): string {
  return useAppStore.getState().language === "en"
    ? (english as Record<string, string>)[source] ?? source
    : source;
}
