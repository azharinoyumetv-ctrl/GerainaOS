// Read-only deployment smoke check. Credentials stay in the ignored local test file.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {loadTestConfig}=require('./test-config.cjs');
(async()=>{
 const config=loadTestConfig(),headers={'content-type':'application/json','x-dagangos-module':'geraina','cache-control':'no-cache'};
 const login=await fetch(config.base+'/api/auth/login',{method:'POST',headers,body:JSON.stringify({email:config.email,password:config.password,store_name:config.store})});
 assert.equal(login.status,200,'Read-only test login must succeed');
 const session=await login.json();assert.equal(session.user.store_name,config.store);
 const auth={...headers,authorization:'Bearer '+session.access_token},checks=[];
 const get=async(url,authenticated=true)=>{const response=await fetch(config.base+url,{headers:authenticated?auth:headers});return {status:response.status,data:await response.json()};};
 const readiness=await get('/api/payments/options');assert.equal(readiness.status,200);
 if(readiness.data.schema_version!==2){console.log(JSON.stringify({status:'pending',paymentOptionsSchema:readiness.data.schema_version}));process.exitCode=2;return;}
 checks.push('payment-options-schema-2');
 for(const name of ['cash','qris_bank','ewallet','va','credit_card']){assert.equal(typeof readiness.data.methods[name].displayed,'boolean');assert.equal(typeof readiness.data.methods[name].enabled,'boolean');checks.push(name+'-visibility-and-readiness');}
 assert.deepEqual(Object.keys(readiness.data.gateways).sort(),['doku','midtrans','xendit']);checks.push('three-merchant-gateway-catalogue');
 const settings=await get('/api/payments/config');assert.equal(settings.status,200);assert.equal(settings.data.checkout_options.schema_version,2);checks.push('payment-settings-and-options-share-policy');
 const bank=await get('/api/payments/bank-qris');assert.equal(bank.status,200);assert.equal(typeof bank.data.is_active,'boolean');checks.push('bank-qris-independent-setup');
 for(const endpoint of ['/api/payments/options','/api/payments/config','/api/payments/bank-qris']){assert.equal((await get(endpoint,false)).status,401);checks.push(endpoint+'-requires-session');}
 const health=await get('/api/health');assert.equal(health.status,200);checks.push('backend-health');
 const report={status:'passed',paymentOptionsSchema:2,checks,merchantWrites:0,origin:config.base,verifiedAt:new Date().toISOString()};
 const out=path.resolve(__dirname,'../app/build/reports/payment-workflow');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'deployment.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
