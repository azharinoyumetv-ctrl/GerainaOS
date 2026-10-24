const {readFileSync,mkdirSync,readdirSync,copyFileSync,writeFileSync}=require('node:fs');
const {resolve,join,relative}=require('node:path');
const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const root=resolve(__dirname,'..'),frontend=resolve(root,'../frontend');
const craco=join(frontend,'node_modules/@craco/craco');
const executable=JSON.parse(readFileSync(join(craco,'package.json'),'utf8')).bin.craco;
const build=spawnSync(process.execPath,[join(craco,executable),'build'],{cwd:frontend,env:{...process.env,CI:'false',DISABLE_ESLINT_PLUGIN:'true'},stdio:'inherit',windowsHide:true});
if(build.status!==0)throw Error('The frontend build failed; no Android package was created.');
const source=join(frontend,'build'),destination=join(root,'app/build/generated/frontend-assets/frontend'),manifest=[];
function copy(directory){for(const item of readdirSync(directory,{withFileTypes:true})){const path=join(directory,item.name);if(item.isDirectory())copy(path);else if(!item.name.endsWith('.map')){const name=relative(source,path),target=join(destination,name);mkdirSync(resolve(target,'..'),{recursive:true});copyFileSync(path,target);manifest.push({path:name.replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});}}}
copy(source);writeFileSync(join(destination,'bundle-manifest.json'),JSON.stringify({builtAt:new Date().toISOString(),files:manifest},null,2));console.log(`Bundled ${manifest.length} frontend files for offline startup.`);
