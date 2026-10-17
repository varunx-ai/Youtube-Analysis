import type { ResearchOptions } from "./types";

export function parseOptions(p: { get(k: string): string | null }): ResearchOptions {
  const order = p.get("order");
  const days = Number(p.get("days"));
  const pages = Number(p.get("pages"));
  return {
    order: order === "viewCount" || order === "date" ? order : "relevance",
    withinDays: days > 0 ? days : null,
    pages: pages === 1 || pages === 3 ? pages : 2,
  };
}
