const path=require('node:path');
const base=require('./playwright.audit.config');
const output=path.resolve(__dirname,'../android-app/app/build/reports/subscription-state');
module.exports={...base,testMatch:'customer-subscriptions.spec.js',outputDir:path.join(output,'artifacts'),
reporter:[['list'],['html',{outputFolder:path.join(output,'report'),open:'never'}],['json',{outputFile:path.join(output,'results.json')}]]};
