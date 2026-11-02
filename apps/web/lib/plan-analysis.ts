export const analysisCategories={areas:'Ruimtes & oppervlaktes',electrical:'Elektriciteit',hvac:'Verwarming & ventilatie',sanitary:'Sanitair'} as const;
export type AnalysisCategory=keyof typeof analysisCategories;
export type Point={x:number;y:number};
export type PlanLine={text:string;page:number;x:number;y:number};
export type Finding={id:string;page:number;category:AnalysisCategory;kind:'room'|'area'|'mention'|'quantity'|'u-value';label:string;evidence:string;value:number|null;unit:string;point:Point;reviewed:boolean};
export type Measurement={id:string;page:number;name:string;area:number;points:Point[];metersPerPoint:number;referenceMeters:number;reviewed:boolean};
export type CountMark={id:string;page:number;name:string;point:Point;category:AnalysisCategory; color: string};
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function polygonArea(points:Point[]){return Math.abs(points.reduce((n,p,i)=>{const q=points[(i+1)%points.length];return n+p.x*q.y-q.x*p.y;},0))/2;}
function intersects(a:Point,b:Point,c:Point,d:Point){
 const cross=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
 // Treat touching/collinear non-neighbouring edges as invalid too.
 if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.max(c.x,d.x)<Math.min(a.x,b.x)||Math.max(a.y,b.y)<Math.min(c.y,d.y)||Math.max(c.y,d.y)<Math.min(a.y,b.y))return false;
 return ab1*ab2<=0&&cd1*cd2<=0;
}
export function validPolygon(points:Point[]){
 if(points.length<3||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))||polygonArea(points)<1)return false;
 for(let i=0;i<points.length;i++){
  if(distance(points[i],points[(i+1)%points.length])<1)return false;
  for(let j=i+1;j<points.length;j++)if(j!==i+1&&!(i===0&&j===points.length-1)&&intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return false;
 }
 return true;
}
const roomPattern=/^(?:slaapkamer(?:\s*\d+)?|badkamer|wc|toilet|inkom(?:sas)?|hal|nachthal|berging|techn\.?\s*berg\.?|technische berging|keuken|eetruimte|leefruimte|woonkamer|living|bureau|garage|wasplaats)$/i;
const terms:Record<Exclude<AnalysisCategory,'areas'>,RegExp>={
 electrical:/stopcontact|schakelaar|lichtpunt|verlichting|elektriciteit|zekering|thermostaat|utp|videofoon|rookmelder|omvormer|zonnepanel|deurbel/i,
 hvac:/vloerverwarming|radiator|ventilatie|ventilatietoestel|warmtepomp|cv[- ]ketel|collector|unit\s*d\b|thermo/i,
 sanitary:/warmwater|koudwater|stadswater|regenwater|sanitair|wastafel|douche|kraan|\bwsw\b|\bksw\b|\brw\b/i,
};
export function extractPlanFindings(lines:PlanLine[]):Finding[]{
 const output:Finding[]=[];
 const add=(l:PlanLine,category:AnalysisCategory,kind:Finding['kind'],label:string,value:number|null=null,unit='')=>{
  output.push({id:`${l.page}-${output.length}`,page:l.page,category,kind,label,evidence:l.text,value,unit,point:{x:l.x,y:l.y},reviewed:false});
 };
 for(const l of lines){
  const text=l.text.replace(/\s+/g,' ').trim();if(!text)continue;
  if(roomPattern.test(text))add(l,'areas','room',text);
  // Explicit dimensions only. Cable cross-sections (mm²) and isolated lengths are not room areas.
  for(const match of text.matchAll(/(?:^|[^\d.,])([0-9]+(?:[.,][0-9]+)?)\s*m(?:²|2|\^2)(?![a-z])/gi)){
   const value=Number(match[1].replace(',','.'));if(value>0&&value<=100000)add(l,'areas','area',text,value,'m²');
  }
  const u=text.match(/\bU(?:w|g)?\s*[:=]\s*([0-9]+(?:[.,][0-9]+)?)/i);
  if(u)add(l,'areas','u-value',text,Number(u[1].replace(',','.')),'W/m²K');
  for(const [category,pattern] of Object.entries(terms))if(pattern.test(text)){
   const quantities=[...text.matchAll(/\b\d+\s*[x×]\s+/gi)];
   const quantity=quantities.length===1?text.match(/^\s*[-•]?\s*(\d+)\s*[x×]\s+/i):null;
   add(l,category as AnalysisCategory,quantity?'quantity':'mention',text,quantity?Number(quantity[1]):null,quantity?'stuks (tekst)':'');
  }
 }
 return output;
}
export function measurementHeatDraft(name:string,measurements:Measurement[]){
 const selected=measurements.filter(m=>m.reviewed);
 if(!selected.length)throw new Error('Bevestig eerst minstens één gemeten ruimte.');
 return {version:1,name:name.slice(0,200),reference:'',address:'',outdoor:-8,allowance:0,notes:'Voorbereiding uit Plananalyse. Alleen gecontroleerde vloeroppervlaktes zijn overgenomen. Controleer ontwerpbuitentemperatuur en binnentemperaturen. Hoogtes ontbreken (0); bouwdelen, U-waarden, ventilatie, infiltratie en koudebruggen moeten nog worden ingevuld. Dit is geen volledige warmteverliesberekening.\n'+selected.map(m=>`${m.name}: ${m.area.toFixed(2)} m², pagina ${m.page}, handmatig omlijnd; kalibratiereferentie ${m.referenceMeters} m.`).join('\n'),rooms:selected.map(m=>({id:m.id,name:m.name,area:Number(m.area.toFixed(2)),height:0,temperature:20,ventilation:0,infiltration:0,recovery:0,bridges:0,surfaces:[]}))};
}
