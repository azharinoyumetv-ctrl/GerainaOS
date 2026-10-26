import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '@/api/client';
import { Save } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import SectionNavigation from '@/navigation/SectionNavigation';
import ReadState from '@/components/ReadState';

const LABELS = { cash: 'Tunai', qris: 'QRIS bank', ewallet: 'E-Wallet', va: 'Virtual Account', credit_card: 'Kartu Kredit', bank_transfer: 'Transfer Bank', edc: 'EDC' };
const defaults = { cash: { is_active: true }, qris_bank: { is_active: false }, ewallet: { is_active: false, provider: 'Xendit', channels: {} }, va: { is_active: false, provider: '', banks: {} }, credit_card: { is_active: false, provider: '', enable_3ds: true } };
export default function PaymentConfig() {
  const { type: routeType } = useParams();
  const type = (routeType || 'cash').replaceAll('-', '_');
  const key = type === 'qris' ? 'qris_bank' : type;
  const supported = key in defaults;
  const gatewayMethod = ['ewallet', 'va', 'credit_card'].includes(key);
  const [config, setConfig] = useState(defaults), [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [saving, setSaving] = useState(false), [attempt, setAttempt] = useState(0), [loadedType, setLoadedType] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    setLoading(supported); setError(''); setLoadedType('');
    if (supported) api.get('/payments/config', { signal: controller.signal, timeout: 12000 }).then(({ data }) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid settings');
      if (active) {
        setConfig(Object.fromEntries(Object.entries(defaults).map(([name, value]) => [name, { ...value, ...data[name] }])));
        setOptions(data.checkout_options || null); setLoadedType(type);
      }
    }).catch(() => { if (active) setError('Pengaturan pembayaran belum dapat dimuat. Coba lagi sebelum menyimpan.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [type, supported, attempt]);
  const value = config[key] || {}, provider = String(value.provider || '').toLowerCase();
  const gateways = options?.gateways || {}, policy = options?.methods?.[key];
  const channelField = key === 'va' ? 'banks' : 'channels';
  const channels = gateways[provider]?.methods?.[key] || [];
  const edit = patch => setConfig(previous => ({ ...previous, [key]: { ...previous[key], ...patch } }));
  const save = async event => {
    event.preventDefault();
    if (!supported || loading || loadedType !== type || error || lock.current) return;
    lock.current = true; setSaving(true);
    try {
      await api.post('/payments/config', { [key]: value });
      toast.success('Pilihan metode kasir disimpan.');
      window.dispatchEvent(new Event('geraina-payment-options-changed'));
      setAttempt(previous => previous + 1);
    } catch (e) { toast.error(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'Pengaturan gagal disimpan. Coba lagi.'); }
    finally { lock.current = false; setSaving(false); }
  };
  return <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="payment-config-page">
    <div><span className="label-tiny">Pembayaran</span><h1 className="font-display text-3xl font-bold mt-1">{LABELS[type] || 'Metode pembayaran'}</h1></div>
    <SectionNavigation section="payments" active={type} />
    <p className="text-sm max-w-3xl">Pilih metode yang ditampilkan di Kasir. Pengaturan akun gateway dan QRIS bank berada di Integrasi.</p>
    {!supported ? <div className="card-surface p-6 space-y-4 max-w-3xl" data-testid="payment-method-unavailable">
      <h2 className="font-display text-lg font-bold">{LABELS[type]} belum tersedia di Kasir</h2>
      <p className="text-sm">{type === 'edc' ? 'Pemrosesan mesin EDC memerlukan integrasi resmi perangkat dan bank. Preferensi lama tetap tersimpan.' : 'Pencatatan dan konfirmasi transfer ke rekening biasa belum tersedia. Virtual Account diatur terpisah melalui gateway toko.'}</p>
      <Link to="/geraina/app/pos" className="btn-outline inline-flex">Buka kasir</Link>
    </div> : <div className="card-surface p-6 max-w-3xl">
      <ReadState loading={loading} error={error} retry={() => setAttempt(previous => previous + 1)} testid="payment-config-error" />
      <form onSubmit={save} className="space-y-5">
        {!loading && !error && loadedType === type && <fieldset disabled={saving} className="space-y-5">
          <label className="flex items-center justify-between gap-4 border-b pb-4 font-semibold text-sm"><span>Tampilkan {LABELS[type]} di Kasir</span><input type="checkbox" data-testid="payment-active" checked={value.is_active === true} onChange={event => edit({ is_active: event.target.checked })} /></label>
          {key === 'cash' && <p className="text-sm">Tunai dapat digunakan saat offline. Perangkat memakai pengaturan terakhir yang tersimpan sampai kembali terhubung.</p>}
          {key === 'qris_bank' && <div className="space-y-3"><p className="text-sm">Gunakan QRIS bank milik toko. Staf memeriksa pembayaran di aplikasi merchant bank sebelum mengonfirmasi Lunas.</p><Link to="/geraina/app/integrations/qris" className="btn-outline inline-flex" data-testid="payment-qris-integration">Atur QRIS bank di Integrasi</Link></div>}
          {gatewayMethod && <>
            <label className="block text-sm font-semibold">Gateway pembayaran<select data-testid="payment-provider" value={provider} onChange={event => edit({ provider: gateways[event.target.value]?.label || '' })} className="input-field mt-2 max-w-sm"><option value="">Pilih gateway toko</option>{Object.entries(gateways).map(([id, gateway]) => <option key={id} value={id}>{gateway.label}</option>)}</select></label>
            {provider && !gateways[provider] && <p role="alert" className="text-sm">Penyedia tersimpan {value.provider} belum didukung. Pilih gateway toko yang tersedia.</p>}
            {gateways[provider] && <>
              <p className="text-sm">Transaksi diproses melalui akun {gateways[provider].label} milik toko. Aktifkan kanal yang sama di akun merchant Anda.</p>
              {key !== 'credit_card' && <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{channels.map(name => <label key={name} className="flex items-center justify-between gap-3 border rounded-xl p-3 text-sm"><span>{name}{key === 'va' ? ' VA' : ''}</span><input type="checkbox" data-testid={'payment-channel-' + name} checked={value[channelField]?.[name] !== false} onChange={event => edit({ [channelField]: { ...value[channelField], [name]: event.target.checked } })} /></label>)}</div>}
              {key === 'credit_card' && <p className="text-sm">Pelanggan mengisi data kartu pada halaman aman gateway. Verifikasi kartu mengikuti ketentuan gateway dan bank penerbit.</p>}
              <Link to={'/geraina/app/integrations/' + provider} className="btn-outline inline-flex" data-testid="payment-provider-integration">Atur integrasi {gateways[provider].label}</Link>
            </>}
          </>}
          {policy && <p role="status" className="text-sm rounded-xl border p-3" data-testid="payment-readiness">{!policy.displayed ? 'Tidak ditampilkan di Kasir.' : policy.enabled ? 'Ditampilkan di Kasir. Status ini berdasarkan kelengkapan pengaturan; uji merchant diperlukan untuk memastikan kanal aktif.' : 'Ditampilkan, tetapi belum dapat dipakai: ' + policy.reason}</p>}
        </fieldset>}
        <button type="submit" disabled={loading || loadedType !== type || !!error || saving} className="btn-primary disabled:opacity-50" data-testid="payment-config-save-btn"><Save size={16} />{saving ? 'Menyimpan…' : 'Simpan Pengaturan'}</button>
      </form>
    </div>}
  </div>;
}
