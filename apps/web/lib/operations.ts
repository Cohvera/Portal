import type {Project} from './projects';
import {projectInExecution} from './project-overview';
export function projectDeadline(project:Project){
 return (project.externalSource==='PLENION'?project.sourceDates?.deadline:project.dueDate)?.slice(0,10)||null;
}
export function projectInWarranty(project:Project){
 return project.externalSource==='PLENION' && project.sourceIsClosed===false &&
  (project.sourceStatusCode==='09' || (!project.sourceStatusCode && /^09\s*-/.test(project.sourceStatusLabel??'')));
}
function sourceCode(code:string|null|undefined,label:string|null|undefined){
 return (code?.trim() || /^(\d{1,2})(?:\s|$)/.exec(label??'')?.[1])?.padStart(2,'0');
}
export const statusIssueCategories = [
 {kind:'offer-wrong-status',label:'Offerte op 04 in plaats van 14'},
 {kind:'map-wrong-status',label:'Projectmap op 14 in plaats van 04'},
 {kind:'lost-not-closed',label:'Verloren / geen uitvoering · Uit WIP uit'},
 {kind:'calculation-closed',label:'Calculatie · Uit WIP aan'},
 {kind:'offer-closed',label:'Offerte · Uit WIP aan'},
 {kind:'execution-closed',label:'In uitvoering · Uit WIP aan'},
] as const;
export type StatusIssueKind = typeof statusIssueCategories[number]['kind'];
type StatusReason={kind:StatusIssueKind;reason:string};
function statusReasons(code:string|undefined,closed:boolean|null|undefined,isMap:boolean):StatusReason[]{
 const reasons:StatusReason[]=[];
 const lossCode=isMap?'04':'14';
 if(code===(isMap?'14':'04'))reasons.push({kind:isMap?'map-wrong-status':'offer-wrong-status',reason:`Verkeerde verliesstatus: voor ${isMap?'een projectmap':'een offerte'} hoort status ${lossCode}.`});
 if((code==='04'||code==='14')&&closed===false)reasons.push({kind:'lost-not-closed',reason:'Verloren / geen uitvoering, maar Uit WIP staat uit. Dit record moet ook administratief afgesloten worden.'});
 if(closed===true&&(code==='01'||code==='02'))reasons.push({kind:code==='01'?'calculation-closed':'offer-closed',reason:`Nog in ${code==='01'?'calculatie':'offerte'}, maar Uit WIP staat aan. Bij niet-uitvoering hoort status ${lossCode}; controleer de juiste eindstatus in Plenion.`});
 if(closed===true&&code==='07')reasons.push({kind:'execution-closed',reason:'In uitvoering, maar Uit WIP staat aan. Controleer de status of de administratieve afsluiting in Plenion.'});
 return reasons;
}
export function projectStatusIssues(project:Project):(StatusReason&{record:string})[]{
 if(project.externalSource!=='PLENION')return [];
 const issues=statusReasons(sourceCode(project.sourceStatusCode,project.sourceStatusLabel),project.sourceIsClosed,true).map(issue=>({record:'Projectmap',...issue}));
 for(const document of project.sourceDocuments??[]){
  // Only confirmed offers: invoices and other document types have their own lifecycle.
  if(document.documentType!=='601')continue;
  for(const issue of statusReasons(sourceCode(document.statusCode,document.statusLabel),document.closed,false))
   issues.push({record:`Offerte ${document.number} · ${document.name||'Naam niet ontvangen'}`,...issue});
 }
 return issues;
}
export function statusIssueGroups(projects:Project[]){
 const checked=projects.map(project=>({project,issues:projectStatusIssues(project)}));
 return statusIssueCategories.map(category=>({...category,projects:checked.filter(item=>item.issues.some(issue=>issue.kind===category.kind)).map(item=>item.project)}));
}
export function projectStatusIssue(project:Project):string|null{
 const issues=projectStatusIssues(project);
 return issues.length?issues.map(issue=>`${issue.record}: ${issue.reason}`).join(' '):null;
}
export function operationsSummary(projects:Project[],today:string){
 const active=projects.filter(projectInExecution);
 const tasks=projects.flatMap(project=>project.tasks.map(task=>({...task,projectName:project.name})));
 const openTasks=tasks.filter(task=>task.status!=='DONE');
 const deadlines=active.filter(project=>projectDeadline(project)).sort((a,b)=>projectDeadline(a)!.localeCompare(projectDeadline(b)!)||a.name.localeCompare(b.name));
 return {active,statusIssues:projects.filter(project=>projectStatusIssue(project)!==null),warranty:projects.filter(projectInWarranty),deadlines,overdue:deadlines.filter(project=>projectDeadline(project)!<today),
  missingDeadline:active.filter(project=>!projectDeadline(project)),unassigned:active.filter(project=>!project.owner.trim()),
  openTasks,blockedTasks:openTasks.filter(task=>task.status==='BLOCKED')};
}
