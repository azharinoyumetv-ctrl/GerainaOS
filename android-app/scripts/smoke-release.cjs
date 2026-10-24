const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const {join}=require('node:path');
const {createHash}=require('node:crypto');
const root=join(__dirname,'..'),serial='emulator-5556',app='com.dagangos.geraina';
const adbPath=join(process.env.USERPROFILE,'AppData/Local/Android/Sdk/platform-tools/adb.exe');
const apk=join(root,'releases/Geraina-POS-1.1.1.apk'),out=join(root,'releases/release-smoke');mkdirSync(out,{recursive:true});
function adb(args,binary=false){const result=spawnSync(adbPath,['-s',serial,...args],{windowsHide:true,timeout:60000,maxBuffer:20000000,encoding:binary?undefined:'utf8'});if(result.error)throw result.error;assert.equal(result.status,0,String(result.stderr));return result.stdout;}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  adb(['install','-r',apk]);adb(['shell','am','force-stop','com.dagangos.geraina.debug']);adb(['shell','am','force-stop',app]);
  adb(['shell','settings','put','system','user_rotation','0']);
  adb(['shell','am','start','-f','0x10008000','-n',`${app}/com.example.gerainapos.MainActivity`]);
  let xml='';const deadline=Date.now()+60000;
  while(Date.now()<deadline){await wait(1000);try{adb(['shell','uiautomator','dump','/data/local/tmp/geraina-release-ui.xml']);xml=adb(['shell','cat','/data/local/tmp/geraina-release-ui.xml']);if(/text="Masuk"/.test(xml)&&/password="true"/.test(xml)&&/class="android.widget.EditText"/.test(xml))break;}catch{}}
  assert.ok(/text="Masuk"/.test(xml)&&/password="true"/.test(xml)&&/class="android.widget.EditText"/.test(xml),'The signed release must display the real login form');
  assert.doesNotMatch(xml,/Geraina belum dapat dibuka/);
  const info=adb(['shell','dumpsys','package',app]);assert.match(info,/versionCode=3/);assert.match(info,/versionName=1\.1\.1/);
  const flags=info.match(/pkgFlags=\[([^\]]+)\]/)?.[1];assert.ok(flags);assert.doesNotMatch(flags,/DEBUGGABLE/);
  const pid=adb(['shell','pidof',app]).trim();assert.match(pid,/^\d+$/);
  const systemDebuggable=adb(['shell','getprop','ro.debuggable']).trim()==='1';
  const debuggingSocket=adb(['shell','cat','/proc/net/unix']).includes(`webview_devtools_remote_${pid}`);
  // Chromium forces WebView debugging on userdebug/eng system images, regardless
  // of the application's false setting. Do not label that OS behavior an app bug.
  if(!systemDebuggable)assert.equal(debuggingSocket,false,'Release WebView has no debugging socket on a production system');
  writeFileSync(join(out,'signed-release-login.png'),adb(['exec-out','screencap','-p'],true));
  const result={status:'passed',version:'1.1.1',versionCode:3,serial,apkSha256:createHash('sha256').update(readFileSync(apk)).digest('hex'),checks:['Signed APK installs and launches','Real login renders without a native error','Version code and name match','Release application is not debuggable'],webViewDebugging:{systemDebuggable,debuggingSocket,limitation:systemDebuggable?'AOSP userdebug forces inspection; socket absence on a production OS is not tested here.':null,reference:'https://github.com/chromium/chromium/blob/main/android_webview/docs/net-debugging.md'}};
  writeFileSync(join(out,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
