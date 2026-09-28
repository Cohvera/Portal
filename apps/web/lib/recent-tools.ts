import { entryCompanies, readCatalog, toolMatchesCompany } from "./tool-companies";
import { tools } from "./tools";

export const RECENT_TOOLS_EVENT = "cohvera:recent-tools";
const keyFor = (companyCode: string) => `cohvera.recent-tools.v1.${companyCode}`;
type Visit = { id: string; openedAt: number };
export type RecentTool = Visit & { name: string; category: string; description: string; href: string };

function readVisits(companyCode: string): Visit[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(keyFor(companyCode)) || "[]");
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.filter((entry): entry is Visit => {
      if (!entry || typeof entry.id !== "string" || typeof entry.openedAt !== "number" || !Number.isFinite(entry.openedAt) || seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  } catch { return []; }
}

export function recordToolOpen(companyCode: string, id: string) {
  try {
    const visits = [{id, openedAt: Date.now()}, ...readVisits(companyCode).filter(entry => entry.id !== id)].slice(0, 50);
    localStorage.setItem(keyFor(companyCode), JSON.stringify(visits));
    window.dispatchEvent(new Event(RECENT_TOOLS_EVENT));
  } catch { /* Opening a tool must still work when browser storage is unavailable. */ }
}

export async function getRecentTools(companyCode: string): Promise<RecentTool[]> {
  const {selections,entries}=await readCatalog();
  const catalog = new Map(tools.filter(tool=>toolMatchesCompany(tool.slug,companyCode,selections)).map(tool => [tool.slug, {name: tool.name, category: tool.category, description: tool.description, href: tool.href || `/tools/${tool.slug}`} ]));
  try {
    if (Array.isArray(entries)) for (const entry of entries) {
      if (entry && entryCompanies(entry).includes(companyCode) && entry.kind === "tool" && typeof entry.id === "string" && typeof entry.name === "string" && typeof entry.description === "string" && typeof entry.href === "string" && /^https?:\/\//i.test(entry.href)) {
        catalog.set(`custom:${entry.id}`, {name: entry.name, description: entry.description, category: "Eigen tools", href: entry.href});
      }
    }
  } catch { /* Built-in tools remain available if custom entries cannot be loaded. */ }
  return readVisits(companyCode).flatMap(visit => {
    const tool = catalog.get(visit.id);
    return tool ? [{...visit, ...tool}] : [];
  }).slice(0, 3);
}
