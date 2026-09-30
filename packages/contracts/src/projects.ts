/** Stable portal project ID is the foreign reference for warehouse records. */
export interface ProjectReferenceV1 {
  id: string;
  companyCode: string;
  name: string;
  owner: string;
  status: string;
  statusColor: string;
}
export interface ProjectReferencePageV1 {
  version: 1;
  projects: ProjectReferenceV1[];
  nextCursor: string | null;
}
