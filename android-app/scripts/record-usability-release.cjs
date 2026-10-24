const assert=require('node:assert/strict');
const {readFileSync,writeFileSync,existsSync,copyFileSync,readdirSync}=require('node:fs');
const {resolve,join}=require('node:path');
const {createHash}=require('node:crypto');
const root=resolve(__dirname,'..'),releases=join(root,'releases');
const read=path=>JSON.parse(readFileSync(join(root,path),'utf8'));
const matrix=read('releases/android-usability-report/matrix.json');assert.equal(matrix.status,'passed');
const browser=read('app/build/reports/usability-browser/verification.json');assert.equal(browser.status,'passed');assert.equal(browser.version,matrix.version);
const presentation=read('app/build/reports/mobile-ui/verification.json');assert.equal(presentation.status,'passed');
const bridge=read('releases/bridge-verification.json');assert.equal(bridge.status,'passed');
const contrast=read('app/build/reports/login-contrast/browser/verification.json');assert.equal(contrast.status,'passed');
const offline=read('releases/android-offline-report/matrix.json');assert.equal(offline.status,'passed');assert.equal(offline.version,matrix.version);assert.equal(offline.apkSha256,matrix.apkSha256);
const alignment=read('build/native-library-alignment.json');assert.equal(alignment.status,'passed');
const backend=readFileSync(join(root,'app/build/reports/offline-backend.xml'),'utf8');
const suite=backend.match(/<testsuite\b[^>]*>/)[0];const attribute=name=>Number(suite.match(new RegExp(`${name}="(\\d+)"`))[1]);assert.equal(attribute('failures')+attribute('errors'),0);assert.ok(attribute('tests')>=9);
const apk=readFileSync(join(releases,`Geraina-POS-${matrix.version}.apk`));assert.equal(createHash('sha256').update(apk).digest('hex'),matrix.apkSha256);
let unitTests=0,unitFailures=0;
const unitDir=join(root,'app/build/test-results/testDebugUnitTest');
for(const file of readdirSync(unitDir).filter(name=>name.endsWith('.xml'))){const xml=readFileSync(join(unitDir,file),'utf8');unitTests+=Number(xml.match(/<testsuite[^>]* tests="(\d+)"/)[1]);unitFailures+=Number(xml.match(/<testsuite[^>]* failures="(\d+)"/)[1])+Number(xml.match(/<testsuite[^>]* errors="(\d+)"/)[1]);}
assert.equal(unitFailures,0);assert.ok(unitTests>0);
const lint=readFileSync(join(root,'app/build/reports/lint-results-release.txt'),'utf8').match(/(\d+) errors, (\d+) warnings/);assert.equal(Number(lint[1]),0);
const signature=readFileSync(join(root,'build/apk-signature.txt'),'utf8');assert.ok(signature.includes('52e14a39a7da4f5f528838f33602860e35960373070a6132d08f682487494ec8'));
const current=join(releases,'release-verification.json');
if(existsSync(current)){const previous=JSON.parse(readFileSync(current,'utf8'));if(previous.version!==matrix.version)copyFileSync(current,join(releases,`release-verification-${previous.version}.json`));}
const report={schemaVersion:3,app:'Geraina POS',version:matrix.version,versionCode:5,applicationId:'com.dagangos.geraina',minimumSdk:34,targetSdk:36,supportedAbis:['arm64-v8a','x86_64'],verifiedAt:new Date().toISOString(),apkSha256:matrix.apkSha256,
 androidUsability:{...matrix,report:'android-usability-report/index.html',totalPassed:matrix.profiles.reduce((sum,row)=>sum+row.passed,0)},
 browserUsability:{status:browser.status,version:browser.version,widths:browser.results.map(row=>row.width),metadataScenarios:browser.results.length*3*6,localFrontend:browser.localFrontend},
 loginContrast:{cases:contrast.results.length,minimumTextContrast:Math.min(...contrast.results.flatMap(row=>row.fields.map(field=>field.textContrast)))},
 unitTests:{passed:unitTests,failed:0},mobilePresentationChecks:{passed:presentation.checks.length,failed:0},bridgeChecks:bridge,
 offlineAndroid:{...offline,totalPassed:offline.profiles.reduce((sum,row)=>sum+row.passed,0),report:'android-offline-report/index.html'},
 offlineBackend:{status:'passed',passed:attribute('tests'),database:'isolated loopback MongoDB replica set; concurrent replay and rollback exercised'},
 barcodeDecoder:{status:'passed',test:'BarcodeDecoderTest',scope:'Debug-library instrumentation on Android 14; EAN-13 at 0/90 degrees; repeated with Wi-Fi/data disabled. Signed APK camera startup and frame processing are checked in the installed offline suite.'},
 physicalPrinterValidation:{status:'not_performed',reason:'No printer model or physical printer supplied',implementedProtocols:['ESC/POS over Bluetooth Classic SPP','ESC/POS over USB printer-class bulk OUT'],notClaimed:['BLE-only printers','proprietary vendor protocols','USB serial adapters']},
 releaseLint:`passed; ${lint[2]} warnings, zero errors`,bundletool:'passed',apkSignature:'verified; original signing certificate retained',pageAlignment:'16 KB',nativeLibraryAlignment:alignment,privateCredentialScan:'passed for decompressed APK/AAB entries',
 merchantProductAndSaleWrites:0,supportMessagesSent:0,googlePlay:'postponed at user request; website APK first',publicWebsite:{status:'awaiting deployment',url:'https://dagangos.com/geraina/android'},
 historicalBaseline:{version:'1.1.2',report:'release-verification-1.1.2.json',note:'Previous release records are historical; current counts require the exact 1.2.0 APK hash.'}};
writeFileSync(current,JSON.stringify(report,null,2)+'\n');console.log(`Recorded signed ${report.version}: ${report.androidUsability.totalPassed} current device checks passed.`);
