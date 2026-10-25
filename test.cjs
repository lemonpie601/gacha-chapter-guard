const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
process.env.GF_CHAPTER_GUARD_TEST = '1';
const patch = require('./gacha-chapter-guard.cjs');
const base = process.argv[2] || path.join(process.env.LOCALAPPDATA,'Marinara-Engine');
const pkg = path.join(base,'packages/server/data/capability-packages/versions/gacha-forge/1.8.13');
const client = patch.transformClient(fs.readFileSync(path.join(pkg,'client.js'),'utf8'));
assert.ok(client);
const method = client.match(/_currentChapterOf\(e\)\{(.*?)\}_currentChapter\(/s)[1];
const current = new Function('e', method);
assert.equal(current({progress:{1:{normal:10},7:{normal:1}}}),2);
assert.equal(current({progress:{1:{normal:3},7:{normal:1}}}),1);
assert.equal(current({progress:{1:{normal:10}}}),1,'reload must not create next chapter just because last one is complete');
assert.equal(current({progress:{1:{normal:10},2:{normal:4}}}),2);
assert.equal(current({progress:{}}),1);
assert.equal(patch.transformClient('changed version'),null);
const server = patch.transformServer(fs.readFileSync(path.join(pkg,'server.mjs'),'utf8'));
assert.ok(server);
const route = server.slice(server.indexOf('s.post("/chapter-plan",') + 's.post("/chapter-plan",'.length,server.indexOf(');let je=2,St='));
async function check(chapter,progress,plans) {
 let calls=0;
 const a={getById:async (_,id)=>plans[id]?{data:plans[id]}:null, create:async()=>{calls++;}};
 const handler = new Function('l','be','Ae','pe','wl','a','n','f','ze','tr','Bf', 'return ('+route+');')(
 String,async()=>({data:{}}),()=>({scenario:'test'}),async()=>({data:{progress}}),async()=>null,a,{id:'gacha-forge'},(_,i)=>String(i),async()=>{calls++;throw Error('generation reached');},p=>p.nodes,()=>null);
 const result=await handler({body:{runId:'r',chapter}});
 return {result,calls};
}
(async()=>{
 const portrait=server.slice(server.indexOf('async generatePortrait('), server.indexOf(',async generateOutfit('));
 let request;
 const adapter=new Function('$r','ve','w0','xc','f','Ec','Ng','return ({'+portrait+'});')(
   x=>({portraitWidth:x.portraitWidth||832,portraitHeight:x.portraitHeight||1216}),x=>String(x||''),()=>({prompt:'test',negative:''}),()=>'',async(_,opts)=>{request=JSON.parse(opts.body);return {images:[{url:'/image'}]};},x=>x,()=>({url:'/image'}));
 adapter.portraitProfile=async()=>({});
 // The upstream response decoder may reject the mock; the outgoing request is the assertion target.
 await adapter.generatePortrait({name:'enemy',size:{},enemyArt:true}).catch(()=>{});
 assert.equal(request.width,384);assert.equal(request.height,576);
 await adapter.generatePortrait({name:'ally',size:{portraitWidth:832,portraitHeight:1216}}).catch(()=>{});
 assert.equal(request.width,832);assert.equal(request.height,1216);
 const plan={nodes:Array(10).fill({type:'story'})};
 let r=await check(7,{1:{normal:10},7:{normal:1}},{1:plan,7:plan});
 assert.equal(r.result.error,'chapter-order'); assert.equal(r.result.resumeChapter,2); assert.equal(r.calls,0);
 r=await check(2,{1:{normal:4}},{1:plan}); assert.equal(r.result.resumeChapter,1);assert.equal(r.calls,0);
 r=await check(2,{1:{normal:10}},{1:plan,2:plan});assert.equal(r.result.cached,true);
 r=await check(1,{}, {1:plan});assert.equal(r.result.cached,true);
 console.log('chapter guard: client recovery and server order tests passed');
})();
