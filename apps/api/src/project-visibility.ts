import { prisma, type Prisma } from "@cohvera/database";

/** Only the last accepted reader selection determines Plenion list visibility.
 * No age cutoff: a failed sync must not remove the previous successful selection.
 * Detail routes keep historical IDs available for existing tasks/warehouse links.
 */
export function projectListWhere(companyCode: string, source: {sourceKind:string; sourceObservedAt:Date} | null): Prisma.ProjectWhereInput {
  const base = {company:{code:companyCode}, sourceParentRecordId:null};
  if (source?.sourceKind !== "reader_selection") return base;
  return {...base, OR:[
    {externalSource:null},
    {externalSource:{not:"PLENION"}},
    {externalSource:"PLENION", sourceSeenAt:source.sourceObservedAt},
  ]};
}
export async function currentProjectListWhere(companyCode: string) {
  const source = await prisma.qboxImport.findUnique({where:{companyCode},select:{sourceKind:true,sourceObservedAt:true}});
  return projectListWhere(companyCode,source);
}
