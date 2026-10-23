import type {Project} from './projects';
import {projectInExecution} from './project-overview';
export function projectDeadline(project:Project){
 return (project.externalSource==='PLENION'?project.sourceDates?.deadline:project.dueDate)?.slice(0,10)||null;
}
export function projectInWarranty(project:Project){
 return project.externalSource==='PLENION' && project.sourceIsClosed===false &&
  (project.sourceStatusCode==='09' || (!project.sourceStatusCode && /^09\s*-/.test(project.sourceStatusLabel??'')));
}
export function projectStatusIssue(project:Project):string|null{
 if(project.externalSource!=='PLENION'||project.sourceIsClosed!==true)return null;
 const code=project.sourceStatusCode?.trim() || /^(\d{1,2})(?:\s|$)/.exec(project.sourceStatusLabel??'')?.[1];
 if(code?.padStart(2,'0')==='07')return 'In uitvoering, maar Uit WIP staat aan. Controleer de status of de administratieve afsluiting in Plenion.';
 return null;
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
