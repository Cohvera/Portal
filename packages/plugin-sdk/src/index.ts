import type { PluginManifest } from "@cohvera/contracts";

export function definePlugin<T extends PluginManifest>(manifest: T): T {
  if (!manifest.id.match(/^[a-z0-9-]+$/)) throw new Error(`Invalid plugin id: ${manifest.id}`);
  if (!manifest.route.startsWith("/")) throw new Error(`Plugin route must start with /: ${manifest.id}`);
  return Object.freeze(manifest);
}

export const pluginCatalog: PluginManifest[] = [
  { id: "ventilation-cloud", name: "Ventilatie Cloud", version: "0.1.0", description: "Cloudberekeningen en opvolging van ventilatieprojecten.", route: "/tools/ventilation-cloud", apiVersion: "1", requiredPermissions: ["ventilation.read"], status: "active", menu: { section: "tools", label: "Ventilatie Cloud", order: 10 } },
  { id: "inspections", name: "Keuringen", version: "0.1.0", description: "Planning, attesten en periodieke controles.", route: "/tools/inspections", apiVersion: "1", requiredPermissions: ["inspections.read"], status: "active", menu: { section: "tools", label: "Keuringen", order: 20 } },
  { id: "solar-subcontracting", name: "Solar Onderaanneming", version: "0.1.0", description: "Planning en opvolging van PV-onderaannemers.", route: "/tools/solar-subcontracting", apiVersion: "1", requiredPermissions: ["solar.read"], status: "active", menu: { section: "tools", label: "Solar Onderaanneming", order: 30 } },
  { id: "charging-workorders", name: "Laadpaal Werkbon", version: "0.1.0", description: "Digitale werkbonnen voor plaatsing en service.", route: "/tools/charging-workorders", apiVersion: "1", requiredPermissions: ["charging-workorders.read"], status: "active", menu: { section: "tools", label: "Laadpaal Werkbon", order: 40 } }
].map(definePlugin);
