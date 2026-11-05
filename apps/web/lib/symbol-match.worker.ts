import {matchSymbols,type Match,type MatchInput,type SymbolSample} from './symbol-match';
self.onmessage=(event:MessageEvent<MatchInput&{samples?:SymbolSample[]}>)=>{
 try{
  const {samples,...input}=event.data;
  const examples=samples?.length?samples:[undefined];const candidates:Match[]=[];
  examples.forEach((sample,index)=>candidates.push(...matchSymbols({...input,sample},p=>self.postMessage({progress:Math.round((index+p/100)/examples.length*100)}))));
  const matches:Match[]=[];
  for(const c of candidates.sort((a,b)=>b.score-a.score)){
   if(matches.some(m=>Math.abs(m.x-c.x)<Math.max(m.width,c.width)*.6&&Math.abs(m.y-c.y)<Math.max(m.height,c.height)*.6))continue;
   matches.push(c);if(matches.length>=500)break;
  }
  self.postMessage({matches});
 }catch(e){self.postMessage({error:e instanceof Error?e.message:'Herkenning mislukt.'});}
};
