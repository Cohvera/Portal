export type CompanyId = string;
export type PluginStatus = "active" | "disabled" | "maintenance" | "unhealthy" | "deprecated";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  route: string;
  apiVersion: string;
  requiredPermissions: string[];
  status: PluginStatus;
  menu: { section: "tools" | "hub"; label: string; order: number };
}

export interface DomainEvent<T = unknown> {
  id: string;
  name: string;
  occurredAt: string;
  companyId: CompanyId;
  payload: T;
}
