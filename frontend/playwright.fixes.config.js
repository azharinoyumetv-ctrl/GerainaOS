const path=require('node:path');
const base=require('./playwright.audit.config');
const output=path.resolve(__dirname,process.env.GERAINA_AUDIT_OUTPUT||'../android-app/app/build/reports/customer-fixes/e2e');
module.exports={...base,testMatch:['customer-audit.spec.js','customer-money-e2e.spec.js','customer-onboarding-audit.spec.js','customer-role-audit.spec.js','customer-fixes.spec.js'],
 outputDir:path.join(output,'artifacts'),
 reporter:[['list'],['html',{outputFolder:path.join(output,'report'),open:'never'}],['json',{outputFile:path.join(output,'results.json')}]],
};
