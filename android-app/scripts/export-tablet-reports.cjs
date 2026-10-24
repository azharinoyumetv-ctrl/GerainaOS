const assert=require('node:assert/strict');
const {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync}=require('node:fs');
const {resolve,join,dirname,sep}=require('node:path');
const root=resolve(__dirname,'..'),reports=join(root,'app/build/reports/android-bench'),destination=join(root,'releases/android-tablet-report');
const matrix=[];
for(const profile of ['xiaomi12','tablet146'])for(const orientation of ['portrait','landscape']){
  const pointer=JSON.parse(readFileSync(join(reports,`latest-${profile}-${orientation}.json`),'utf8'));
  const source=dirname(resolve(pointer.path));assert.ok(source.startsWith(reports+sep));
  const report=JSON.parse(readFileSync(join(source,'report.json'),'utf8'));
  assert.equal(report.status,'passed');assert.equal(report.deviceProfile,profile);assert.equal(report.orientation,orientation);
  assert.equal(report.checks.length,29);assert.ok(report.checks.every(check=>check.status==='passed'));
  const folder=`${profile}-${orientation}`,out=join(destination,folder);mkdirSync(out,{recursive:true});
  for(const file of readdirSync(source))if(['report.html','report.json'].includes(file)||file.endsWith('.png'))copyFileSync(join(source,file),join(out,file));
  matrix.push({profile,label:report.deviceLabel,orientation,checks:report.checks.length,passed:report.checks.length,runId:report.runId,androidVersion:report.androidVersion,viewport:report.viewport,report:`${folder}/report.html`,screenshot:`${folder}/tablet-populated-cashier.png`,keyboardScreenshot:`${folder}/tablet-checkout-android-keyboard.png`});
}
writeFileSync(join(destination,'matrix.json'),JSON.stringify({status:'passed',scope:'Android 16 AOSP emulators matching screen profiles; vendor firmware and physical hardware are not tested.',matrix},null,2));
const cards=matrix.map(row=>`<article><h2>${row.label} · ${row.orientation}</h2><p><strong>${row.passed}/${row.checks} passed</strong> · ${row.androidVersion} · WebView ${row.viewport.width} × ${row.viewport.height}</p><a href="${row.report}">Full automated report</a> · <a href="${row.keyboardScreenshot}">Android keyboard check</a><a href="${row.screenshot}"><img src="${row.screenshot}" alt="${row.label} cashier in ${row.orientation}"></a></article>`).join('');
writeFileSync(join(destination,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Geraina large Android tablet tests</title><style>body{font:16px/1.6 system-ui;background:#f5f7f1;color:#203d2b;margin:0}main{max-width:1100px;padding:30px;margin:auto}article{background:white;border:1px solid #dce5d6;border-radius:18px;padding:24px;margin:25px 0}h1{font-size:32px}h2{font-size:21px}img{display:block;max-width:100%;max-height:650px;margin:20px auto 0;border-radius:12px}a{color:#245238}strong{color:#28653a}</style><main><h1>Geraina large Android tablet tests</h1><p>116/116 checks passed across Xiaomi Pad 6S Pro (12.4-inch) and Samsung Ultra-size (14.6-inch) screen profiles, each in portrait and landscape.</p><p>Actual installed debug APK on Android 16 AOSP emulators. These match screen resolution and size class; they do not emulate HyperOS / One UI or prove physical-device compatibility. Product and payment examples are isolated local fixtures. No merchant record or support message was written.</p>${cards}</main></html>`);
console.log(`Exported ${matrix.length} passing tablet reports: ${destination}`);
