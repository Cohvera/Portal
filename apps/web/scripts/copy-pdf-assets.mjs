import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cp,mkdir,rm} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const source=dirname(require.resolve('pdfjs-dist/package.json'));
const target=resolve(dirname(fileURLToPath(import.meta.url)),'../public/pdfjs');
await mkdir(target,{recursive:true});
await cp(resolve(source,'build/pdf.worker.min.mjs'),resolve(target,'pdf.worker.min.mjs'));
for(const directory of ['cmaps','standard_fonts','wasm']){
 await rm(resolve(target,directory),{recursive:true,force:true});
 await cp(resolve(source,directory),resolve(target,directory),{recursive:true});
}
