import type {Project} from './projects';
import {projectInExecution} from './project-overview';
export function projectDeadline(project:Project){
 return (project.externalSource==='PLENION'?project.sourceDates?.deadline:project.dueDate)?.slice(0,10)||null;
}
export function projectInWarranty(project:Project){
 return project.externalSource==='PLENION' && project.sourceIsClosed===false &&
  (project.sourceStatusCode==='09' || (!project.sourceStatusCode && /^09\s*-/.test(project.sourceStatusLabel??'')));
}
export function operationsSummary(projects:Project[],today:string){
 const active=projects.filter(projectInExecution);
 const tasks=projects.flatMap(project=>project.tasks.map(task=>({...task,projectName:project.name})));
 const openTasks=tasks.filter(task=>task.status!=='DONE');
 const deadlines=active.filter(project=>projectDeadline(project)).sort((a,b)=>projectDeadline(a)!.localeCompare(projectDeadline(b)!)||a.name.localeCompare(b.name));
 return {active,warranty:projects.filter(projectInWarranty),deadlines,overdue:deadlines.filter(project=>projectDeadline(project)!<today),
  missingDeadline:active.filter(project=>!projectDeadline(project)),unassigned:active.filter(project=>!project.owner.trim()),
  openTasks,blockedTasks:openTasks.filter(task=>task.status==='BLOCKED')};
}
