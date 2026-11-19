const {spawn}=require('node:child_process');const path=require('node:path');
const v=process.argv[2],port=process.argv[3],base=path.resolve(__dirname),root=path.resolve(base,'../integration-engines/Marinara-Engine-'+v);
const sandbox=path.join(base,'sandbox-auth-'+v);require('node:fs').mkdirSync(sandbox,{recursive:true});
const modulePath=path.resolve(base,'../marinara-memory-module/memory-module/marinara-memory-runtime.cjs');
const env={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,TEMP:sandbox,TMP:sandbox,USERPROFILE:sandbox,APPDATA:sandbox,LOCALAPPDATA:sandbox,DATA_DIR:path.join(sandbox,'data'),FILE_STORAGE_DIR:path.join(sandbox,'files'),MEMORY_MODULE_NOTES_DIR:path.join(base,'notes'),HOST:'127.0.0.1',PORT:port,MODEL_CATALOG_REFRESH:'false',UPDATES_APPLY_DISABLED:'true',AUTO_OPEN_BROWSER:'false',BASIC_AUTH_USER:'sandbox-user',BASIC_AUTH_PASS:'sandbox-password-2026',NODE_ENV:'production'};
let p=spawn(process.execPath,['--require',path.join(base,'network-guard.cjs'),'--require',modulePath,path.join(root,'packages/server/dist/index.js')],{cwd:root,env,stdio:'inherit'});p.on('exit',(code)=>process.exit(code??1));process.on('SIGTERM',()=>p.kill());
