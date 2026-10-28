import { Component, lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

class PageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="p-4 sm:p-6" data-testid="route-error" role="alert">
      <div className="card-surface max-w-xl p-5 space-y-3">
        <h1 className="font-display text-xl font-bold">Halaman belum dapat dimuat</h1>
        <p className="text-sm">Periksa koneksi Anda, lalu coba lagi. Anda juga dapat membuka menu lain.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" onClick={this.props.onRetry}>Coba lagi</button>
          <Link className="btn-outline" to="/geraina">Kembali ke beranda</Link>
        </div>
      </div>
    </div>;
  }
}

// A rejected React.lazy download stays rejected until it is recreated. Retry
// explicitly, keeping the authenticated document and navigation mounted.
export function deferred(load) {
  return function DeferredPage(props) {
    const [attempt, setAttempt] = useState(0);
    const Page = useMemo(() => lazy(load), [attempt]);
    return <PageBoundary key={attempt} onRetry={() => setAttempt(value => value + 1)}>
      <Suspense fallback={<div className="p-4 text-sm" role="status" data-testid="route-loading">Memuat halaman…</div>}>
        <Page {...props} />
      </Suspense>
    </PageBoundary>;
  };
}
