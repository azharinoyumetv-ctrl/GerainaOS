import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { firstAllowedPath } from '@/auth/permissions';

export default function AppPageNotFound() {
  const { user } = useAuth();
  return <div className="p-6 space-y-4" data-testid="app-page-not-found"><h1 className="font-display text-2xl font-bold">Halaman tidak ditemukan</h1><p>Alamat halaman ini tidak tersedia. Pilih menu yang sesuai untuk melanjutkan.</p><Link className="btn-outline" to={firstAllowedPath(user?.role)}>Kembali ke aplikasi</Link></div>;
}
