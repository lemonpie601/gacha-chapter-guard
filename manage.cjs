'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const action=process.argv[2];
if(!['install','remove'].includes(action))throw Error('Usage: node manage.cjs install|remove [engine path]');
const root=path.resolve(process.argv[3]||path.join(process.env.LOCALAPPDATA,'Marinara-Engine'));
const envPath=path.join(root,'.env'),target=path.join(root,'gacha-chapter-guard.cjs');
if(!fs.existsSync(path.join(root,'packages/server/dist/index.js')))throw Error('Not a Marinara installation: '+root);
const flag='--require='+target.replace(/\\/g,'/');
if(/\s/.test(flag))throw Error('Paths containing spaces require manual NODE_OPTIONS configuration.');
const original=fs.readFileSync(envPath,'utf8'),matches=[...original.matchAll(/^NODE_OPTIONS=(.*)$/gm)];
if(matches.length>1)throw Error('Multiple NODE_OPTIONS lines; manual review required.');
let options=(matches[0]?.[1]||'').trim();
if((options.startsWith('"')&&options.endsWith('"'))||(options.startsWith("'")&&options.endsWith("'")))options=options.slice(1,-1);
// Preserve all other options exactly, including quoting and spaces in their paths.
options=options.replace(new RegExp('(?:^|\\s)'+flag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=\\s|$)','g'),'').trim();
if(action==='install'){
 const test=spawnSync(process.execPath,[path.join(__dirname,'test.cjs'),root],{stdio:'inherit'});
 if(test.status!==0)throw Error('Compatibility tests failed; no installation changes made.');
 options+=(options?' ':'')+flag;
 if(fs.existsSync(target))fs.copyFileSync(target,target+'.backup-'+Date.now(),fs.constants.COPYFILE_EXCL);
 fs.copyFileSync(path.join(__dirname,'gacha-chapter-guard.cjs'),target);
}
const line='NODE_OPTIONS='+options;
const next=matches.length?original.replace(/^NODE_OPTIONS=.*$/m,()=>line):original+(original.endsWith('\n')?'':'\n')+line+'\n';
if(next!==original){
 fs.copyFileSync(envPath,envPath+'.before-chapter-guard-'+Date.now(),fs.constants.COPYFILE_EXCL);
 fs.writeFileSync(envPath+'.chapter-guard.tmp',next,'utf8');
 fs.renameSync(envPath+'.chapter-guard.tmp',envPath);
}
console.log(action==='install'?'Installed. Restart Marinara normally, then reload PC and iPad.':'Removed from startup. Restart Marinara normally. Patch file retained.');
