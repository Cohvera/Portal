import { definePlugin } from "@cohvera/plugin-sdk";
export default definePlugin({ id: "sample-plugin", name: "Sample Plugin", version: "0.1.0", description: "Referentie-implementatie voor nieuwe pluginontwikkelaars.", route: "/tools/sample-plugin", apiVersion: "1", requiredPermissions: ["sample.read"], status: "disabled", menu: { section: "tools", label: "Sample Plugin", order: 999 } });
