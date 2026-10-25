'use strict';
// Gacha Forge 1.8.13 only. Transforms loaded code, never saved games or package files.
const fs = require('node:fs');
const {fileURLToPath} = require('node:url');
const MARKER = 'const entrypoint = await capabilityPackageManager.clientEntrypoint(id);';
const OLD_CURRENT = '_currentChapterOf(e){let a=e&&e.progress||{},r=0;for(let s of Object.keys(a)){let o=Number(s);Number.isInteger(o)&&o>r&&(r=o)}return Math.max(1,r)}';
const NEW_CURRENT = '_currentChapterOf(e){let a=e&&e.progress||{},r=1;while(Object.prototype.hasOwnProperty.call(a,String(r))&&Number(a[String(r)].normal)>=10){if(!Object.keys(a).some(k=>Number(k)>r))return r;r++}return r}';
const OLD_DISPLAY = '_currentChapter(){let e=this._run&&this._run.progress||{},a=0;for(let r of Object.keys(e)){let s=Number(r);Number.isInteger(s)&&s>a&&(a=s)}return Math.max(1,a,Number(this._planChapter)||1)}';
const OLD_RESTORE = 'Number.isInteger(e.ch)&&e.ch>=1&&(this._planChapter=e.ch)';
const OLD_ERROR = 'else i&&i.error==="bond-chapter-open"&&i.heldById&&!this._bondUnit?';
const SERVER_ANCHOR = 'let{data:w}=await pe(o),b=w&&w.progress||{},S=await wl(o,w,i);';
function edits(source, replacements, marker) {
  if(source.includes(marker)) return source;
  if(replacements.some(([a])=>source.split(a).length!==2)) return null;
  for(const [a,b] of replacements) source=source.replace(a,()=>b);
  return source;
}
function transformClient(source) {
  return edits(source,[
    [OLD_CURRENT,NEW_CURRENT],
    [OLD_DISPLAY,'_currentChapter(){return Math.max(1,Number(this._planChapter)||this._currentChapterOf(this._run))}'],
    [OLD_RESTORE,'Number.isInteger(e.ch)&&e.ch>=1&&(this._planChapter=Math.min(e.ch,this._currentChapterOf(this._run)))'],
    [OLD_ERROR,'else i&&i.error==="chapter-order"&&Number.isInteger(i.resumeChapter)&&i.resumeChapter>=1&&i.resumeChapter<this._planChapter?(this._planChapter=i.resumeChapter,this._plan=null,this._planState="idle",this._chapterProgress={},this._persistNav(),this._renderBrowser()):i&&i.error==="bond-chapter-open"&&i.heldById&&!this._bondUnit?']
  ],NEW_CURRENT);
}
function transformServer(source) {
  return edits(source,[[SERVER_ANCHOR,
    'let{data:w}=await pe(o),b=w&&w.progress||{};/*gf-chapter-guard*/'+
    'for(let __ch=1;__ch<i;__ch++){let __doc=await a.getById(n.id,f(o,__ch)),__total=__doc&&__doc.data?tr(__doc.data).length:0;'+
    'if(!__total||!(Number(b[String(__ch)]&&b[String(__ch)].normal)>=__total))return{ok:!1,error:"chapter-order",resumeChapter:__ch,detail:"이전 챕터를 먼저 완료해 주세요."}}'+
    'let S=await wl(o,w,i);'
  ],[
    'async generatePortrait({connectionId:h,name:A,unit:T,styleProfileId:R,size:C}){let{portraitWidth:I,portraitHeight:D}=$r(C)',
    'async generatePortrait({connectionId:h,name:A,unit:T,styleProfileId:R,size:C,enemyArt:__gfEnemyArt=false}){let{portraitWidth:I,portraitHeight:D}=__gfEnemyArt?{portraitWidth:384,portraitHeight:576}:$r(C)'
  ],[
    'generatePortrait({connectionId:g.id,name:i.name,unit:m,styleProfileId:nt(p).styleProfileId,size:nt(p)})',
    'generatePortrait({connectionId:g.id,name:i.name,unit:m,styleProfileId:nt(p).styleProfileId,size:nt(p),enemyArt:true})'
  ]],'/*gf-chapter-guard*/');
}
function transformRoute(source) {
  if(source.includes('__gfChapterGuardHash'))return source;
  if(source.split(MARKER).length!==2)return null;
  const injected = `
if(id === "gacha-forge" && entrypoint && Buffer.isBuffer(entrypoint.data)) {
 const before = entrypoint.data.toString("utf8");
 const after = globalThis.__gfChapterGuardClient(before);
 if(after === null) process.stderr.write("[chapter-guard] client signature mismatch; skipped\\n");
 else {entrypoint.data=Buffer.from(after);entrypoint.sha256=__gfChapterGuardHash(entrypoint.data);}
}`;
  return 'import {createHash as __gfChapterGuardCreateHash} from "node:crypto";\nconst __gfChapterGuardHash=b=>__gfChapterGuardCreateHash("sha256").update(b).digest("hex");\n'+source.replace(MARKER,()=>MARKER+injected);
}
if(process.env.GF_CHAPTER_GUARD_TEST!=='1') {
  const {registerHooks}=require('node:module');
  if(typeof registerHooks!=='function')throw Error('chapter-guard requires Node with registerHooks (Node 24 recommended)');
  globalThis.__gfChapterGuardClient=transformClient;
  registerHooks({load(url,context,nextLoad){
    if(!url.startsWith('file:'))return nextLoad(url,context);
    const file=fileURLToPath(url).replace(/\\/g,'/');
    const server=/\/capability-runtime-snapshots\/gacha-forge-1\.8\.13-[^/]+\/server\.mjs$/.test(file);
    const route=/\/packages\/server\/dist\/routes\/capability-packages\.routes\.js$/i.test(file);
    const response=nextLoad(url,context);
    if(!server&&!route)return response;
    const source=response.source==null?fs.readFileSync(file,'utf8'):Buffer.isBuffer(response.source)?response.source.toString('utf8'):String(response.source);
    const updated=(server?transformServer:transformRoute)(source);
    if(updated===null){process.stderr.write('[chapter-guard] signature mismatch; skipped\n');return response;}
    process.stderr.write('[chapter-guard] '+(server?'server guard':'client route')+' applied in memory\n');
    return {...response,source:updated,shortCircuit:true};
  }});
}
module.exports={transformClient,transformServer,transformRoute};
