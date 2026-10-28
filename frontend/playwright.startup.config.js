const path=require('node:path');
const base=require('./playwright.audit.config');
const output=path.resolve(__dirname,'../android-app/app/build/reports/startup-navigation');
module.exports={...base,testMatch:['startup-navigation-local.spec.js','customer-role-audit.spec.js'],outputDir:path.join(output,'artifacts'),
reporter:[['list'],['html',{outputFolder:path.join(output,'report'),open:'never'}],['json',{outputFile:path.join(output,'results.json')}]]};
