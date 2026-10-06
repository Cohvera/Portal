export type OverviewProject = {
  name: string; customer: string; owner: string; status: string;
  sourceStatusLabel?: string | null; sourceIsClosed?: boolean | null;
  externalSource?: string | null; externalId?: string | null;
};
export type ProjectFilters = {query: string; status: string; owner: string; source: string; scope?: string};
export function projectStatus(p: OverviewProject) {
  return p.externalSource === 'PLENION' ? p.sourceStatusLabel || p.status : p.status;
}
export function projectScope(p: OverviewProject): 'open' | 'closed' | 'unknown' {
  if (p.externalSource === 'PLENION') return p.sourceIsClosed === true ? 'closed' : p.sourceIsClosed === false ? 'open' : 'unknown';
  return p.status === 'Afgerond' ? 'closed' : 'open';
}
export function filterProjects<T extends OverviewProject>(projects: T[], filters: ProjectFilters): T[] {
  const query = filters.query.trim().toLocaleLowerCase('nl-BE');
  return projects.filter(p =>
    (!filters.scope || projectScope(p) === filters.scope) &&
    (!filters.status || projectStatus(p) === filters.status) &&
    (!filters.owner || (filters.owner === '__unassigned__' ? !p.owner.trim() : p.owner === filters.owner)) &&
    (!filters.source || (filters.source === 'PLENION' ? p.externalSource === 'PLENION' : !p.externalSource)) &&
    (!query || [p.name,p.customer,p.owner,p.externalId || ''].some(value => value.toLocaleLowerCase('nl-BE').includes(query)))
  ).sort((a,b) => a.name.localeCompare(b.name,'nl-BE',{numeric:true}));
}
