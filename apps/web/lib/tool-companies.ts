export const TOOL_COMPANIES_KEY = "cohvera.tool-companies.v1";
export const TOOL_COMPANIES_EVENT = "cohvera:tool-companies";
export const CATALOG_ENTRIES_KEY = "cohvera.catalog.entries.v1";
export type CompanyEntry = {companyCode: string; companyCodes?: string[]};

export function entryCompanies(entry: CompanyEntry): string[] {
  return Array.isArray(entry.companyCodes) ? entry.companyCodes : [entry.companyCode];
}
export function readToolCompanies(): Record<string,string[]> {
  const value: unknown = JSON.parse(localStorage.getItem(TOOL_COMPANIES_KEY) || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.values(value).every(codes => Array.isArray(codes) && codes.length && codes.every(code => typeof code === "string"))) throw new Error("Ongeldige bedrijfsselectie.");
  return value as Record<string,string[]>;
}
export function toolMatchesCompany(toolId: string, companyCode: string, selections: Record<string,string[]>): boolean {
  return !selections[toolId] || selections[toolId].includes(companyCode);
}
export function notifyToolCompanies() {
  window.dispatchEvent(new Event(TOOL_COMPANIES_EVENT));
}

export type CatalogEntry = CompanyEntry & {id:string;name:string;description:string;href:string;kind:"tool"|"integration"};
export type CatalogSnapshot = {entries:CatalogEntry[];selections:Record<string,string[]>};
export async function readCatalog():Promise<CatalogSnapshot> {
  const response=await fetch("/api/catalog",{cache:"no-store"});
  if(!response.ok)throw new Error("De toolcatalogus kon niet worden geladen.");
  return response.json();
}
