const path=require('node:path');
const base=require('./playwright.audit.config');
const output=path.resolve(__dirname,'../android-app/app/build/reports/route-recovery');
module.exports={...base,testMatch:['route-recovery-local.spec.js','play-distribution-local.spec.js'],outputDir:path.join(output,'artifacts'),
reporter:[['list'],['html',{outputFolder:path.join(output,'report'),open:'never'}],['json',{outputFile:path.join(output,'results.json')}]]};
