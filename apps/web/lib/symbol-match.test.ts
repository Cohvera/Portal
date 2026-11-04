import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchSymbols,boxFromPoints} from './symbol-match';
function fixture(){
 const width=160,height=100,pixels=new Uint8ClampedArray(width*height*4).fill(255);
 const pattern:Array<[number,number]>=[];
 for(let y=3;y<17;y++)for(let x=3;x<17;x++)if(x===3||y===16||(y===3&&x<12)||(x===11&&y<10))pattern.push([x,y]);
 function draw(ox:number,oy:number,rotate=false){for(const [x,y] of pattern){const p=((oy+(rotate?x:y))*width+ox+(rotate?19-y:x))*4;pixels[p]=0;pixels[p+1]=130;pixels[p+2]=0;}}
 draw(5,5);draw(50,30);draw(100,50,true);
 return {width,height,pixels,template:{x:5,y:5,width:20,height:20},region:{x:35,y:15,width:120,height:80},threshold:.95,rotations:true};
}
test('finds repeated and rotated symbols inside search region without duplicate dots',()=>{
 const hits=matchSymbols(fixture());assert.equal(hits.length,2);
 for(const expected of [{x:60,y:40},{x:110,y:60}])assert.ok(hits.some(h=>Math.hypot(h.x-expected.x,h.y-expected.y)<3));
 assert.ok(hits.every(h=>h.score>=.95&&h.score<=1));
});
test('rejects empty templates',()=>{const f=fixture();f.template={x:130,y:0,width:20,height:20};assert.throws(()=>matchSymbols(f),/te weinig/);});
test('does not find symbols in blank region',()=>{const f=fixture();f.region={x:35,y:0,width:120,height:20};assert.deepEqual(matchSymbols(f),[]);});
test('selection supports either corner order',()=>assert.deepEqual(boxFromPoints({x:20,y:30},{x:5,y:10}),{x:5,y:10,width:15,height:20}));
