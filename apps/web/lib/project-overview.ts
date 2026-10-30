export type OverviewProject = {
  companyName?:string;
  name: string; customer: string; owner: string; status: string;
  sourceDates?: Record<string,string|null>|null;
  dueDate?:string|null;
  sourcePlannedAt?:string|null; createdAt?:string|null;
  sourceIsActive?: boolean | null;
  sourceStatusCode?: string | null;
  sourceStatusLabel?: string | null; sourceIsClosed?: boolean | null;
  externalSource?: string | null; externalId?: string | null;
};
export type ProjectFilters = {query: string; status: string; owner: string; source: string; scope?: string; yearFrom?:string; yearTo?:string; includeUnknownYear?:boolean};
// Use the source project date, never the date an imported project arrived in Portal.
export function projectYear(p:OverviewProject):number|null {
  const value=p.externalSource === 'PLENION' ? p.sourceDates?.created_date
    : p.externalSource === 'TEAMLEADER' ? p.sourcePlannedAt
    : !p.externalSource ? p.createdAt : null;
  const match=value?.match(/^(\d{4})-\d{2}-\d{2}(?:T| |$)/);
  if(!match || Number(match[1])<1000 || !Number.isFinite(Date.parse(value!)))return null;
  return Number(match[1]);
}
function matchesYear(p:OverviewProject,filters:ProjectFilters){
  if(!filters.yearFrom&&!filters.yearTo)return true;
  const year=projectYear(p);
  return year===null ? filters.includeUnknownYear===true
    : (!filters.yearFrom||year>=Number(filters.yearFrom))&&(!filters.yearTo||year<=Number(filters.yearTo));
}
export function projectStatus(p: OverviewProject) {
  return ['PLENION', 'TEAMLEADER'].includes(p.externalSource || '') ? p.sourceStatusLabel || p.status : p.status;
}
export function projectScope(p: OverviewProject): 'open' | 'closed' | 'unknown' {
  if (['PLENION', 'TEAMLEADER'].includes(p.externalSource || '')) return p.sourceIsClosed === true ? 'closed' : p.sourceIsClosed === false ? 'open' : 'unknown';
  return p.status === 'Afgerond' ? 'closed' : 'open';
}
export function filterProjects<T extends OverviewProject>(projects: T[], filters: ProjectFilters): T[] {
  const query = filters.query.trim().toLocaleLowerCase('nl-BE');
  return projects.filter(p =>
    matchesYear(p,filters) &&
    (!filters.scope || (filters.scope === "active" ? projectInExecution(p) : projectScope(p) === filters.scope)) &&
    (!filters.status || projectStatus(p) === filters.status) &&
    (!filters.owner || (filters.owner === '__unassigned__' ? !p.owner.trim() : p.owner === filters.owner)) &&
    (!filters.source || (filters.source === 'PORTAL' ? !p.externalSource : p.externalSource === filters.source)) &&
    (!query || [p.name,p.customer,p.owner,p.externalId || ''].some(value => value.toLocaleLowerCase('nl-BE').includes(query)))
  ).sort((a,b) => a.name.localeCompare(b.name,'nl-BE',{numeric:true}));
}

export function projectInExecution(p:OverviewProject) {
  return p.externalSource === "PLENION" ? p.sourceIsActive === true && p.sourceIsClosed !== true : p.status === "Actief";
}
export function projectExplanation(p:OverviewProject) {
  if(p.externalSource === "TEAMLEADER") return "Status beheerd in Teamleader";
  if(p.externalSource !== "PLENION") return p.status === "Afgerond" ? "Afgerond in Portal" : "Status beheerd in Portal";
  const status=projectStatus(p).toLocaleLowerCase("nl-BE");
  const closed=p.sourceIsClosed;
  if(closed===true) return "Administratief afgesloten (Uit WIP). Dit zegt niet of alle facturen betaald zijn.";
  if(closed==null) return "Administratieve afsluiting niet ontvangen.";
  if(p.sourceStatusCode==="09" || status.includes("gefactureerd")) return "Gefactureerd, nog niet administratief afgesloten. Betaling en garantieperiode niet bevestigd.";
  if(status.includes("opgeleverd")) return "Opgeleverd, nog niet administratief afgesloten. Garantieperiode niet bevestigd.";
  if(status.includes("verloren")) return "Verloren, maar Uit WIP staat nog uit.";
  if(status.includes("offerte") || status.includes("calculatie")) return "Offerte/calculatie staat administratief open; uitvoering is niet bevestigd.";
  return "Nog niet administratief afgesloten. De bronstatus bepaalt de fase van het project.";
}
