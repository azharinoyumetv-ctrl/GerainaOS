import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AffiliateSignupField, affiliateCodeFromSearch, useAffiliateSignup } from './affiliateSignup';
jest.mock('@/auth/session', () => ({ sessionToken: () => 'signed-in-owner-token' }), { virtual: true });
let root, host, referral;
function Harness({ search = '', showField = false }) {
  referral = useAffiliateSignup('geraina', affiliateCodeFromSearch(search));
  return showField ? <AffiliateSignupField referral={referral} androidProduct="geraina" /> : null;
}
const response=(body,ok=true)=>({ok,json:async()=>body});
beforeEach(()=>{ global.IS_REACT_ACT_ENVIRONMENT=true; host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);if(!AbortSignal.timeout) AbortSignal.timeout=()=>new AbortController().signal; });
afterEach(async()=>{ await act(async()=>root.unmount());host.remove();jest.restoreAllMocks(); });
test('unresolved lookup cannot silently confirm a referral',async()=>{
 global.fetch=jest.fn().mockImplementationOnce(()=>new Promise(()=>{}));
 await act(async()=>root.render(<Harness/>));let result;await act(async()=>{result=await referral.save()});expect(result).toBe(false);expect(fetch).toHaveBeenCalledTimes(1);
});
test('failed lookup asks the owner to recover the referral at checkout',async()=>{
 global.fetch=jest.fn().mockRejectedValueOnce(new Error('offline'));
 await act(async()=>root.render(<Harness/>));let result;await act(async()=>{result=await referral.save()});expect(result).toBe(false);
});
test('no code after a successful lookup does not block the trial',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce(response({available:true,code:null}));
 await act(async()=>root.render(<Harness/>));let result;await act(async()=>{result=await referral.save()});expect(result).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);
});
test('link referral succeeds only when the saved code matches',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce(response({available:true,code:'PROMOTE01'})).mockResolvedValueOnce(response({available:true,code:'OTHER999'}));
 await act(async()=>root.render(<Harness/>));let result;await act(async()=>{result=await referral.save()});expect(result).toBe(false);
});
test('typed old codes are normalized and confirmed on save',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce(response({available:true,code:null})).mockResolvedValueOnce(response({available:true,code:'OLDALIAS1'})).mockResolvedValueOnce(response({available:true,code:'OLDALIAS1'}));
 await act(async()=>root.render(<Harness/>));await act(async()=>referral.setCode('oldalias1'));await act(async()=>referral.validate());let result;await act(async()=>{result=await referral.save()});expect(result).toBe(true);expect(fetch.mock.calls[2][1].headers['X-Affiliate-Code']).toBe('OLDALIAS1');
});

test('an HTTP error during lookup does not silently discard a referral',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce(response({error:'unavailable'},false));
 await act(async()=>root.render(<Harness/>));let result;await act(async()=>{result=await referral.save()});expect(result).toBe(false);
});
test('a valid referral link is saved only after the server confirms it',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce(response({available:true,code:'PROMOTE01'})).mockResolvedValueOnce(response({available:true,code:'PROMOTE01'}));
 await act(async()=>root.render(<Harness/>));let result;await act(async()=>{result=await referral.save()});expect(result).toBe(true);expect(fetch.mock.calls[1][1].method).toBe('POST');
});
test('invalid typed codes stop validation',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce(response({available:true,code:null}));
 await act(async()=>root.render(<Harness/>));await act(async()=>referral.setCode('bad!'));await expect(referral.validate()).rejects.toThrow('Kode afiliasi');expect(fetch).toHaveBeenCalledTimes(1);
});


test('a linked Android code is reviewed before signup and saved with the owner session', async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce(response({ available: true, code: null }))
    .mockResolvedValueOnce(response({ available: true, code: 'PROMOTE01' }))
    .mockResolvedValueOnce(response({ available: true, code: 'PROMOTE01' }));
  await act(async () => root.render(<Harness search="?affiliate=promote01" showField />));
  expect(host.querySelector('input[name="affiliate_code"]').value).toBe('PROMOTE01');
  await referral.validate();
  await expect(referral.save()).resolves.toBe(true);
  expect(fetch.mock.calls[2][1].headers).toEqual({
    Authorization: 'Bearer signed-in-owner-token',
    'X-Affiliate-Code': 'PROMOTE01',
  });
});

test('an Android handoff preserves the validated browser code with a web fallback', async () => {
  jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla Android Chrome');
  global.fetch = jest.fn().mockResolvedValueOnce(response({ available: true, code: 'PROMOTE01' }));
  await act(async () => root.render(<Harness showField />));
  const link = host.querySelector('a').getAttribute('href');
  expect(link).toContain('intent://dagangos.com/geraina/affiliate-signup/PROMOTE01');
  expect(link).toContain('package=com.dagangos.geraina');
  expect(link).toContain(encodeURIComponent('https://dagangos.com/geraina/register'));
});
