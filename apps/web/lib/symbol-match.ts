export type Box={x:number;y:number;width:number;height:number};
export type Match={x:number;y:number;width:number;height:number;score:number};
export type MatchInput={width:number;height:number;pixels:Uint8ClampedArray;template:Box;region:Box;threshold:number;rotations:boolean};
export function boxFromPoints(a:{x:number;y:number},b:{x:number;y:number}):Box{return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};}
/** Local binary template matching. Scores are resemblance, not probabilities. */
export function matchSymbols(input:MatchInput,progress:(n:number)=>void=()=>{}):Match[]{
 const {width:w,height:h,pixels,threshold,rotations}=input;
 const clamp=(b:Box)=>{const x=Math.max(0,Math.round(b.x)),y=Math.max(0,Math.round(b.y));return {x,y,width:Math.min(w-x,Math.round(b.width)),height:Math.min(h-y,Math.round(b.height))};};
 const t=clamp(input.template),region=clamp(input.region);
 if(t.width<6||t.height<6||t.width>160||t.height>160)throw new Error('Kies één symbool, zonder tekst: tussen 6 en 160 beeldpixels breed en hoog. Zoom in om nauwkeurig te selecteren.');
 // Prefer coloured ink when the example contains it, to suppress building outlines.
 let coloured=0,total=0,red=0,green=0,blue=0;
 for(let y=t.y;y<t.y+t.height;y++)for(let x=t.x;x<t.x+t.width;x++){
  const i=(y*w+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
  if(Math.min(r,g,b)<180){total++;if(Math.max(r,g,b)-Math.min(r,g,b)>35){coloured++;const sum=r+g+b||1;red+=r/sum;green+=g/sum;blue+=b/sum;}}
 }
 const useColor=coloured>=8&&coloured/Math.max(1,total)>.2;
 if(useColor){red/=coloured;green/=coloured;blue/=coloured;}
 const ink=new Uint8Array(w*h);
 for(let p=0;p<w*h;p++){const i=p*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2],sum=r+g+b||1;
  ink[p]=Number(useColor?Math.min(r,g,b)<210&&Math.max(r,g,b)-Math.min(r,g,b)>25&&Math.hypot(r/sum-red,g/sum-green,b/sum-blue)<.18:(r+g+b)/3<175);
 }
 const base=new Uint8Array(t.width*t.height);let count=0;
 for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++){base[y*t.width+x]=ink[(t.y+y)*w+t.x+x];count+=base[y*t.width+x];}
 if(count<8||count>base.length*.8)throw new Error('Het voorbeeld bevat te weinig herkenbare lijnen of te veel achtergrond. Kies een strakker kader rond één symbool.');
 const near=new Uint8Array(w*h);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(ink[y*w+x])for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)near[(y+dy)*w+x+dx]=1;
 const candidates:Match[]=[];const turns=rotations?4:1;let iteration=0;
 for(const scale of [.85,1,1.15])for(let turn=0;turn<turns;turn++){
  const sw=Math.max(6,Math.round(t.width*scale)),sh=Math.max(6,Math.round(t.height*scale));
  const tw=turn%2?sh:sw,th=turn%2?sw:sh,mask=new Uint8Array(tw*th);
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
   const value=base[Math.min(t.height-1,Math.floor(y/scale))*t.width+Math.min(t.width-1,Math.floor(x/scale))];
   const nx=turn===0?x:turn===1?sh-1-y:turn===2?sw-1-x:y;
   const ny=turn===0?y:turn===1?x:turn===2?sh-1-y:sw-1-x;mask[ny*tw+nx]=value;
  }
  const positive:number[]=[];const expanded=new Uint8Array(tw*th);
  for(let y=0;y<th;y++)for(let x=0;x<tw;x++)if(mask[y*tw+x]){positive.push(y*tw+x);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<tw&&y+dy>=0&&y+dy<th)expanded[(y+dy)*tw+x+dx]=1;}
  const sample=positive.filter((_,i)=>i%Math.max(1,Math.floor(positive.length/24))===0);
  for(let y=region.y;y<=region.y+region.height-th;y+=2)for(let x=region.x;x<=region.x+region.width-tw;x+=2){
   let hits=0;for(const p of sample)hits+=near[(y+Math.floor(p/tw))*w+x+p%tw];
   if(hits/sample.length<threshold*.85)continue;
   hits=0;for(const p of positive)hits+=near[(y+Math.floor(p/tw))*w+x+p%tw];
   const recall=hits/positive.length;if(recall<threshold*.8)continue;
   let found=0,covered=0;
   for(let dy=0;dy<th;dy++)for(let dx=0;dx<tw;dx++)if(ink[(y+dy)*w+x+dx]){found++;covered+=expanded[dy*tw+dx];}
   const precision=found?covered/found:0,score=2*precision*recall/(precision+recall||1);
   if(score>=threshold)candidates.push({x:x+tw/2,y:y+th/2,width:tw,height:th,score});
   if(candidates.length>25000)throw new Error('Te veel overeenkomsten. Kies een duidelijker voorbeeld, kleiner zoekgebied of hogere gelijkenis.');
  }
  progress(Math.round(++iteration/(3*turns)*100));
 }
 const result:Match[]=[];
 for(const c of candidates.sort((a,b)=>b.score-a.score)){
  if(result.some(m=>Math.abs(m.x-c.x)<Math.max(m.width,c.width)*.6&&Math.abs(m.y-c.y)<Math.max(m.height,c.height)*.6))continue;
  result.push(c);if(result.length>=500)break;
 }
 return result;
}
