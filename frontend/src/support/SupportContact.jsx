import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function SupportContact({ user, appVersion = 'Web', initiallyOpen = false, deletionRequest = false }) {
  const key = `geraina_support_${user.id}_${user.store_id}`;
  const [open, setOpen] = useState(initiallyOpen), [context, setContext] = useState(null);
  const [subject, setSubject] = useState(deletionRequest ? 'Permintaan penghapusan akun Geraina POS' : '');
  const [message, setMessage] = useState(deletionRequest ? 'Saya meminta penghapusan akun Geraina POS dan data terkait. Mohon verifikasi kepemilikan akun dan konfirmasikan proses penghapusan.' : '');
  const [pending, setPending] = useState(null), [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const sending = useRef(false);
  useEffect(() => { const show = () => setOpen(true); window.addEventListener('geraina-open-support', show); return () => window.removeEventListener('geraina-open-support', show); }, []);
  useEffect(() => {
    if (!open) return;
    let active = true; setContext(null); setError('');
    api.get('/support/context', { timeout: 12000 }).then(r => {
      if (active) setContext(r.data);
    }).catch(() => { if (active) setError('Identitas akun belum dapat dimuat. Coba lagi.'); });
    try {
      const stored = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (stored && typeof stored.request_id === 'string' && typeof stored.subject === 'string' && typeof stored.message === 'string') {
        setPending(stored); setSubject(stored.subject); setMessage(stored.message);
        api.get(`/support/requests/${encodeURIComponent(stored.request_id)}`, { timeout: 12000 }).then(r => {
          if (active) setResult(r.data);
        }).catch(e => { if (active && e.response?.status !== 404) setError('Status permintaan belum dapat diperiksa. Jangan kirim ulang dahulu.'); });
      }
    } catch { /* In-memory identity and request ID still protect this attempt. */ }
    return () => { active = false; };
  }, [open, key, retry]);

  const submit = async event => {
    event.preventDefault();
    if (sending.current || !context?.delivery_ready || result) return;
    const payload = pending || { request_id: crypto.randomUUID(), subject: subject.trim(), message: message.trim(), app_version: appVersion };
    sending.current = true; setBusy(true); setError(''); setPending(payload);
    try { sessionStorage.setItem(key, JSON.stringify(payload)); } catch { /* Keep the same in-memory request ID. */ }
    try {
      const r = await api.post('/support/requests', payload, { timeout: 30000 });
      setResult(r.data);
    } catch (e) {
      setError(typeof e.response?.data?.detail === 'string' ? e.response.data.detail : 'Hasil pengiriman belum dapat dipastikan. Periksa status sebelum mencoba lagi.');
      if ([400, 422, 429, 503].includes(e.response?.status)) {
        setPending(null); try { sessionStorage.removeItem(key); } catch { /* Draft remains in memory. */ }
      }
    } finally { sending.current = false; setBusy(false); }
  };
  const fresh = () => { try { sessionStorage.removeItem(key); } catch { /* Reset the visible draft. */ } setPending(null); setResult(null); setSubject(''); setMessage(''); setError(''); };
  return <>
    <button type="button" className="text-sm font-semibold text-[hsl(var(--accent))] hover:underline" data-testid="about-support" onClick={() => setOpen(true)}>Hubungi dukungan</button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto" data-testid="support-dialog" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>Hubungi dukungan Geraina</DialogTitle><DialogDescription>Jelaskan kendala Anda. Jangan sertakan kata sandi, API key, atau data pembayaran.</DialogDescription></DialogHeader>
        {context ? <div className="rounded-lg border p-3 space-y-1 text-sm">
          <p className="break-words">Email akun: <strong className="break-all" data-testid="support-account-email">{context.customer_email}</strong></p>
          <p>Toko: {context.store_name}</p><p>Tujuan: {context.recipient}</p>
          <p className="text-xs text-[hsl(var(--muted))]">Balasan dukungan menggunakan email akun Anda. Anda tidak perlu membuka aplikasi email.</p>
        </div> : <p role="status">Memuat email akun…</p>}
        {context && !context.delivery_ready && <p role="alert" className="text-sm">Pengiriman dukungan belum tersedia. Pesan belum dikirim; silakan coba lagi nanti.</p>}
        {result ? <div role="status" data-testid="support-result" className="space-y-3 text-sm">
          <p>{result.status === 'accepted' ? 'Server email telah menerima permintaan dukungan untuk pengiriman.' : 'Pengiriman belum dapat dipastikan. Simpan nomor ini dan periksa status; jangan mengirim ulang permintaan yang sama.'}</p>
          <p>Nomor dukungan: <strong className="break-all">{result.reference}</strong></p>
          <p>Balasan untuk: {result.customer_email}</p>
          {result.status === 'accepted' && <button type="button" className="btn-outline" onClick={fresh}>Buat permintaan baru</button>}
        </div> : <form onSubmit={submit} className="space-y-3" data-testid="support-form">
          <label className="block text-sm">Subjek<input className="input-field mt-1" name="support_subject" required minLength={3} maxLength={160} value={subject} onChange={e => setSubject(e.target.value)} disabled={busy || !!pending} /></label>
          <label className="block text-sm">Pesan<textarea className="input-field mt-1 min-h-32" name="support_message" required minLength={10} maxLength={5000} value={message} onChange={e => setMessage(e.target.value)} disabled={busy || !!pending} /></label>
          <p className="text-xs text-[hsl(var(--muted))]">Versi aplikasi: {appVersion}</p>
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={busy || !context?.delivery_ready} aria-busy={busy} data-testid="support-submit">{busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}{busy ? 'Mengirim permintaan…' : pending ? 'Coba permintaan yang sama' : 'Kirim permintaan'}</button>
        </form>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="button" className="btn-outline text-sm" disabled={busy} onClick={() => setRetry(v => v + 1)}>Periksa ulang status</button>
      </DialogContent>
    </Dialog>
  </>;
}
