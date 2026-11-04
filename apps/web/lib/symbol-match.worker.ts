import {matchSymbols,type MatchInput} from './symbol-match';
self.onmessage=(event:MessageEvent<MatchInput>)=>{try{const matches=matchSymbols(event.data,progress=>self.postMessage({progress}));self.postMessage({matches});}catch(e){self.postMessage({error:e instanceof Error?e.message:'Herkenning mislukt.'});}};
