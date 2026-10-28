const path=require('node:path');
const base=require('./playwright.audit.config');
const output=path.resolve(__dirname,'../android-app/app/build/reports/remaining-playwright');
module.exports={...base,testMatch:['navigation-replacement-local.spec.js','route-recovery-local.spec.js','payment-workflow.spec.js','customer-onboarding-audit.spec.js'],timeout:60000,outputDir:path.join(output,'artifacts'),
reporter:[['list'],['html',{outputFolder:path.join(output,'report'),open:'never'}],['json',{outputFile:path.join(output,'results.json')}]]};
