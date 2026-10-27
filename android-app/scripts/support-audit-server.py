"""Real auth/Mongo, captured SMTP only; no outbound email or production access."""
import importlib.util, os, smtplib
from pathlib import Path
spec=importlib.util.spec_from_file_location('support_base',Path(__file__).with_name('addon-audit-server.py'))
bench=importlib.util.module_from_spec(spec);spec.loader.exec_module(bench)
from fastapi import Body
app=bench.app; emails=[]; mode='normal'
class CapturedSMTP:
    def __init__(self,host,port,timeout,context=None): assert host=='smtp.resend.com' and port==465 and context is not None
    def __enter__(self):return self
    def __exit__(self,*args):return False
    def login(self,user,password):assert user=='resend' and password=='disposable-support-bench-only'
    def send_message(self,message,from_addr,to_addrs):
        emails.append({'from':str(message['From']),'to':str(message['To']),'reply_to':str(message['Reply-To']),'subject':str(message['Subject']),'body':message.get_content(),'envelope_from':from_addr,'envelope_to':to_addrs})
        if mode=='timeout':raise TimeoutError('Fixture response lost after acceptance')
        return {}
smtplib.SMTP_SSL=CapturedSMTP
def configure(value):
    global mode
    mode=value;os.environ.update(SUPPORT_SMTP_HOST='smtp.resend.com',SUPPORT_SMTP_PORT='465',SUPPORT_SMTP_SECURITY='ssl',SUPPORT_SMTP_USER='resend');os.environ.pop('RESEND_API_KEY',None)
    if value=='unconfigured':os.environ.pop('SUPPORT_SMTP_PASSWORD',None)
    else:os.environ['SUPPORT_SMTP_PASSWORD']='disposable-support-bench-only'
configure('normal')
@app.post('/__support/reset')
async def reset(payload:dict=Body(default={})):
    await bench.reset(payload);emails.clear();configure(payload.get('mode','normal'));return {'ok':True}
@app.get('/__support/emails')
async def capture():return emails
if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=8850,log_level='warning')
