import type {SymbolSample} from './symbol-match';
export const LIBRARY_KEY='cohvera.symbol-library.v1';
export type SavedExample={id:string;width:number;height:number;rgba:string};
export type SavedSymbol={id:string;name:string;examples:SavedExample[]};
export type SymbolLibrary={version:1;symbols:SavedSymbol[]};
export const emptyLibrary=():SymbolLibrary=>({version:1,symbols:[]});
/** Validate imported/local data before allocating pixel buffers. */
export function parseLibrary(text:string):SymbolLibrary{
 if(text.length>4_000_000)throw new Error('De bibliotheek is groter dan 4 MB.');
 const v=JSON.parse(text);
 if(v?.version!==1||!Array.isArray(v.symbols)||v.symbols.length>40)throw new Error('Ongeldig bibliotheekbestand (maximaal 40 symbolen).');
 const ids=new Set<string>();
 for(const s of v.symbols){
  if(typeof s.id!=='string'||s.id.length>100||ids.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||!Array.isArray(s.examples)||!s.examples.length||s.examples.length>8)throw new Error('Ongeldig symbool: gebruik een naam en 1–8 voorbeelden.');
  ids.add(s.id);const examples=new Set<string>();
  for(const e of s.examples){
   if(typeof e.id!=='string'||e.id.length>100||examples.has(e.id)||!Number.isInteger(e.width)||!Number.isInteger(e.height)||e.width<6||e.width>160||e.height<6||e.height>160||typeof e.rgba!=='string'||e.rgba.length!==4*Math.ceil(e.width*e.height*4/3)||!/^[A-Za-z0-9+/]+={0,2}$/.test(e.rgba)||atob(e.rgba).length!==e.width*e.height*4)throw new Error('Ongeldig voorbeeldbeeld.');
   examples.add(e.id);
  }
 }
 return {version:1,symbols:v.symbols.map((s:SavedSymbol)=>({id:s.id,name:s.name.trim(),examples:s.examples.map(e=>({id:e.id,width:e.width,height:e.height,rgba:e.rgba}))}))};
}
export function saveExample(sample:SymbolSample):SavedExample{
 let bytes='';for(const b of sample.pixels)bytes+=String.fromCharCode(b);
 return {id:crypto.randomUUID(),width:sample.width,height:sample.height,rgba:btoa(bytes)};
}
export function decodeExample(e:SavedExample):SymbolSample{return {width:e.width,height:e.height,pixels:Uint8ClampedArray.from(atob(e.rgba),c=>c.charCodeAt(0))};}
