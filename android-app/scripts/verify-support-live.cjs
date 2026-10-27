// Exactly one owner-approved test email; repeated invocations only inspect its status.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {loadTestConfig}=require('./test-config.cjs'),config=loadTestConfig();
const out=path.resolve(__dirname,'../app/build/reports/support-live');fs.mkdirSync(out,{recursive:true});
let token;
async function api(p,body){const r=await fetch(config.base+'/api'+p,{method:body?'POST':'GET',headers:{Origin:config.base,'Content-Type':'application/json','X-DagangOS-Module':'geraina',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.equal(r.status,200,`Support verification ${p}: HTTP ${r.status}`);return data;}
(async()=>{
 const login=await api('/auth/login',{email:config.email,password:config.password});token=login.access_token;assert.equal(login.user.store_name,config.store);
 const context=await api('/support/context');assert.equal(context.customer_email,login.user.email);assert.equal(context.recipient,'contact@dagangos.com');
 const report={status:'configured',productionContextVerified:true,accountEmailMatches:true,recipientMatches:true,deliveryReady:context.delivery_ready};
 if(!context.delivery_ready){fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));throw Error('The production backend does not have a mail credential');}
 if(process.env.GERAINA_APPROVED_SUPPORT_TEST!=='1'){console.log(JSON.stringify(report));return;}
 const guard=path.join(out,'send-once.json');let result,reference;
 if(fs.existsSync(guard)){const saved=JSON.parse(fs.readFileSync(guard));reference=saved.request_id;result=await api('/support/requests/'+reference);}
 else{
  reference=randomUUID();fs.writeFileSync(guard,JSON.stringify({request_id:reference,attemptStartedAt:new Date().toISOString()}));
  result=await api('/support/requests',{request_id:reference,subject:'[TEST] Geraina 1.2.14 customer support verification',message:'Automated test explicitly approved by the DagangOS owner. Do not action this as a real customer request. This verifies that the authenticated Geraina customer email is used for replies.',app_version:'1.2.14-live-check'});
 }
 assert.equal(result.customer_email,context.customer_email);assert.equal(result.status,'accepted','SMTP acceptance is not confirmed; this test will not send another email');
 const persisted=await api('/support/requests/'+reference);assert.equal(persisted.status,'accepted');
 Object.assign(report,{status:'passed',smtpAccepted:true,requestId:reference,supportReference:result.reference,realEmailAttempts:1,repeatInvocationsDoNotResend:true,mailboxReceiptVerified:false,verifiedAt:new Date().toISOString()});fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
