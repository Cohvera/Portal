import {jsPDF} from 'jspdf';
import {autoTable} from 'jspdf-autotable';
import type {Project} from './projects';
import {projectDeadline,projectStatusIssues,type StatusIssueKind} from './operations';
import {projectStatus} from './project-overview';
export type OperationsReport={title:string;company:string;filter:string;projects:Project[];issueFilter?:StatusIssueKind|'all';generatedAt?:Date};
export function reportRows(report:OperationsReport):string[][] {
 return report.projects.flatMap(p=>{
  const project=[p.externalId?`Nr. ${p.externalId}`:'',p.name,p.customer,`Status: ${projectStatus(p)}`].filter(Boolean).join('\n');
  if(report.issueFilter){
   const records=new Map<string,string[]>();
   for(const issue of projectStatusIssues(p).filter(i=>report.issueFilter==='all'||i.kind===report.issueFilter))records.set(issue.record,[...(records.get(issue.record)||[]),issue.reason]);
   return [...records].map(([record,reasons])=>[p.companyName||report.company,project,record,reasons.map(reason=>'- '+reason).join('\n\n')]);
  }
  return [[p.companyName||report.company,project,projectDeadline(p)||'Niet ingevuld',p.owner||'Nog toe te wijzen']];
 });
}
export function createOperationsPdf(report:OperationsReport,fonts:{regular:string;bold:string}) {
 const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 for(const [style,data] of [['normal',fonts.regular],['bold',fonts.bold]]){pdf.addFileToVFS(`report-${style}.ttf`,data);pdf.addFont(`report-${style}.ttf`,'Report',style);}
 pdf.setProperties({title:report.title,subject:report.filter,author:'Cohvera Portal'});
 const width=pdf.internal.pageSize.getWidth(),height=pdf.internal.pageSize.getHeight();
 const timestamp=(report.generatedAt??new Date()).toLocaleString('nl-BE',{timeZone:'Europe/Brussels'});
 const rows=reportRows(report);
 const subtitle=`${report.company} | ${report.projects.length} projecten${report.issueFilter?` | ${report.projects.reduce((n,p)=>n+projectStatusIssues(p).filter(i=>report.issueFilter==='all'||i.kind===report.issueFilter).length,0)} aandachtspunten`:''}`;
 autoTable(pdf,{
  head:[report.issueFilter?['Bedrijf','Project / huidige status','Betrokken record','Te controleren']:['Bedrijf','Project / huidige status','Deadline','Verantwoordelijke']],
  body:rows.length?rows:[['','Geen projecten in deze selectie.','','']],
  startY:49,margin:{top:49,bottom:18,left:14,right:14},
  styles:{font:'Report',fontSize:9,cellPadding:3,overflow:'linebreak',textColor:[30,41,59],lineColor:[222,228,237],lineWidth:0.15},
  headStyles:{fontStyle:'bold',fillColor:[43,58,151],textColor:[255,255,255]},
  alternateRowStyles:{fillColor:[245,247,251]},
  columnStyles:{0:{cellWidth:28},1:{cellWidth:82},2:{cellWidth:64},3:{cellWidth:95}},
  rowPageBreak:'avoid',showHead:'everyPage',
  didDrawPage:()=>{
   pdf.setFont('Report','bold');pdf.setFontSize(10);pdf.setTextColor(62,73,165);pdf.text('COHVERA  /  OPERATIONS',14,12);
   pdf.setFontSize(18);pdf.setTextColor(24,33,52);pdf.text(report.title,14,22);
   pdf.setFont('Report','normal');pdf.setFontSize(10);pdf.text(subtitle,14,29);
   pdf.setFontSize(9);pdf.text(`Selectie: ${report.filter}`,14,35);pdf.text(`Opgemaakt: ${timestamp} (Brussel)`,14,41);
  }
 });
 const count=pdf.getNumberOfPages();
 for(let page=1;page<=count;page++){
  pdf.setPage(page);pdf.setFont('Report','normal');pdf.setFontSize(8);pdf.setTextColor(90,101,120);
  pdf.text('Momentopname uit Portal. Controleer correcties in het bronsysteem; dit rapport wijzigt geen gegevens.',14,height-9);
  pdf.text(`${page} / ${count}`,width-14,height-9,{align:'right'});
 }
 return pdf;
}
export async function loadReportFonts(){
 const load=async(name:string)=>{
  const response=await fetch(`/fonts/LiberationSans-${name}.ttf`);
  if(!response.ok)throw new Error('Rapportlettertype kon niet worden geladen. Probeer opnieuw.');
  const bytes=new Uint8Array(await response.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
 };
 const [regular,bold]=await Promise.all([load('Regular'),load('Bold')]);return {regular,bold};
}
