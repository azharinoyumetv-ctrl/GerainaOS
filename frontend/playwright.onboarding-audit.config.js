const path=require('node:path');
const base=require('./playwright.audit.config');
const output=path.resolve(__dirname,'../android-app/app/build/reports/customer-audit/onboarding');
module.exports={...base,testMatch:'customer-onboarding-audit.spec.js',outputDir:path.join(output,'artifacts'),
  reporter:[['list'],['html',{outputFolder:path.join(output,'report'),open:'never'}],['json',{outputFile:path.join(output,'results.json')}]],
};
