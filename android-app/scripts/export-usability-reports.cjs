const assert=require('node:assert/strict');
const {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync,existsSync,cpSync}=require('node:fs');
const {resolve,join,dirname,sep}=require('node:path');
const {createHash}=require('node:crypto');
const root=resolve(__dirname,'..'),reports=join(root,'app/build/reports/android-usability'),out=join(root,'releases/android-usability-report');
const version='1.2.2',hash=createHash('sha256').update(readFileSync(join(root,`releases/Geraina-POS-${version}.apk`))).digest('hex');
const profiles=process.argv.slice(2);assert.ok(profiles.length>=3,'Provide the completed Android and tablet profiles');
if(existsSync(join(out,'matrix.json'))){const previous=JSON.parse(readFileSync(join(out,'matrix.json'),'utf8'));if(previous.version!==version){assert.match(previous.version,/^\d+\.\d+\.\d+$/);const backup=join(root,`releases/android-usability-report-${previous.version}`);if(!existsSync(backup))cpSync(out,backup,{recursive:true});}}
const matrix=[];mkdirSync(out,{recursive:true});
for(const profile of profiles){
 assert.match(profile,/^[a-z0-9]+$/);
 const pointer=JSON.parse(readFileSync(join(reports,`latest-${profile}.json`),'utf8'));
 const source=dirname(resolve(pointer.path));assert.ok(source.startsWith(reports+sep));
 const report=JSON.parse(readFileSync(join(source,'verification.json'),'utf8'));
 assert.equal(report.status,'passed');assert.equal(report.profile,profile);assert.equal(report.version,version);assert.equal(report.apkSha256,hash);
 assert.ok(report.checks.length>=12&&report.checks.every(check=>check.status==='passed'));
 const destination=join(out,profile);mkdirSync(destination,{recursive:true});
 for(const file of readdirSync(source))if(file==='verification.json'||file.endsWith('.png'))copyFileSync(join(source,file),join(destination,file));
 matrix.push({profile,status:report.status,version,apkSha256:hash,androidVersion:report.androidVersion,api:report.api,checks:report.checks.length,passed:report.checks.length,finishedAt:report.finishedAt,localFrontend:report.localFrontend,report:`${profile}/verification.json`});
}
const summary={status:'passed',version,apkSha256:hash,scope:'Installed signed APK with its bundled frontend on AOSP emulators. Real account sign-in; record changes are intercepted local fixtures. Vendor firmware and physical hardware are not tested.',profiles:matrix};
writeFileSync(join(out,'matrix.json'),JSON.stringify(summary,null,2)+'\n');
const labels={android14:'Android 14 phone',android17:'Android 17 phone',xiaomi12:'Xiaomi Pad 6S Pro screen profile',tablet146:'Samsung Ultra screen profile'};
const cards=matrix.map(row=>`<article><h2>${labels[row.profile]||row.profile}</h2><p>${row.passed}/${row.checks} checks passed · Android ${row.androidVersion}, API ${row.api}</p><p><a href="${row.report}">Assertion results</a></p><div class="screens"><a href="${row.profile}/login-readable.png"><img src="${row.profile}/login-readable.png" alt="Readable login fields"></a><a href="${row.profile}/suite-menu-readable.png"><img src="${row.profile}/suite-menu-readable.png" alt="Readable Suite navigation"></a></div></article>`).join('');
writeFileSync(join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Geraina ${version} Android usability checks</title><style>body{font:16px/1.6 system-ui;background:#f5f7f1;color:#203d2b;margin:0}main{max-width:1100px;padding:30px;margin:auto}article{background:white;border:1px solid #dce5d6;border-radius:18px;padding:24px;margin:25px 0}h1{font-size:32px}h2{font-size:21px}.screens{display:flex;gap:20px;flex-wrap:wrap}.screens a{flex:1;min-width:220px}img{display:block;max-width:100%;max-height:700px;margin:20px auto;border-radius:12px}a{color:#245238}</style><main><h1>Geraina ${version} Android usability checks</h1><p>${matrix.reduce((sum,row)=>sum+row.passed,0)} checks passed across ${matrix.length} device profiles.</p><p>${summary.scope}</p><p>Checks cover login contrast, Suite labels, navigation, category/brand/unit validation and failure recovery, keyboard and dialog Back handling, text selection, double-Back exit, and session persistence. Tablet checks also cover landscape navigation and checkout bounds.</p>${cards}</main></html>`);
console.log(`Exported ${matrix.length} verified signed-APK profiles to ${out}`);
