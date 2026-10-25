const assert=require('node:assert/strict');
const {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync}=require('node:fs');
const {resolve,join,dirname,sep}=require('node:path');
const {createHash}=require('node:crypto');
const root=resolve(__dirname,'..'),reports=join(root,'app/build/reports/offline-android'),out=join(root,'releases/android-offline-report');
const version='1.2.3',hash=createHash('sha256').update(readFileSync(join(root,`releases/Geraina-POS-${version}.apk`))).digest('hex'),profiles=[];
for(const profile of ['android14','android17','xiaomi12','tablet146']){
 const pointer=JSON.parse(readFileSync(join(reports,`latest-${profile}.json`),'utf8')),source=dirname(resolve(pointer.path));assert.ok(source.startsWith(reports+sep));
 const report=JSON.parse(readFileSync(join(source,'verification.json'),'utf8'));assert.equal(report.status,'passed');assert.equal(report.version,version);assert.equal(report.apkSha256,hash);assert.equal(report.checks.length,8);assert.ok(report.checks.every(row=>row.status==='passed'));
 const destination=join(out,profile);mkdirSync(destination,{recursive:true});for(const file of readdirSync(source))if(file==='verification.json'||file.endsWith('.png'))copyFileSync(join(source,file),join(destination,file));
 profiles.push({profile,version,apkSha256:hash,status:'passed',passed:report.checks.length,report:`${profile}/verification.json`});
}
const browser=JSON.parse(readFileSync(join(root,'app/build/reports/offline-browser/verification.json'),'utf8'));assert.equal(browser.status,'passed');
copyFileSync(join(root,'app/build/reports/offline-browser/verification.json'),join(out,'browser-verification.json'));
const summary={status:'passed',version,apkSha256:hash,profiles,browserChecks:browser.results.length,physicalPrinterOutput:'not tested: no physical printer or model specified',scope:'Installed signed APK. Android connectivity disabled and API responses blocked for cold-start/cash-sale checks. Native camera and printer UI are exercised; physical printer transport/output remains unverified.'};
writeFileSync(join(out,'matrix.json'),JSON.stringify(summary,null,2)+'\n');
const cards=profiles.map(row=>`<article><h2>${row.profile} · ${row.passed}/8 passed</h2><a href="${row.report}">Assertion results</a><div class="images"><img src="${row.profile}/cold-restart-offline-receipt.png" alt="Receipt restored after an offline cold restart"><img src="${row.profile}/camera-ready-offline.png" alt="Native camera preview without connectivity"><img src="${row.profile}/offline-printer-selection.png" alt="Native offline printer selector"></div></article>`).join('');
writeFileSync(join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Geraina ${version} offline Android checks</title><style>body{font:16px/1.6 system-ui;background:#f5f7f1;color:#203d2b;margin:0}main{max-width:1200px;margin:auto;padding:30px}article{border:1px solid #dce5d6;border-radius:18px;padding:24px;margin:24px 0;background:white}.images{display:flex;gap:16px;flex-wrap:wrap}.images img{max-width:31%;max-height:680px;object-fit:contain;align-self:flex-start}a{color:#245238}@media(max-width:700px){.images img{max-width:100%}}</style><main><h1>Geraina ${version}: offline and native hardware checks</h1><p>32 installed-APK checks and ${browser.results.length} browser scenarios passed. ${summary.scope}</p><p>Bluetooth support targets ESC/POS over Bluetooth Classic SPP; USB targets printer-class devices. A selected printer and its actual paper output have not been tested.</p>${cards}</main></html>`);
console.log(`Exported ${profiles.length} passing signed offline/hardware profiles.`);
