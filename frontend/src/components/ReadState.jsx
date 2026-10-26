export default function ReadState({ loading, error, retry, testid = 'read-state' }) {
  if (!loading && !error) return null;
  return <div className="card-surface p-5 space-y-3" data-testid={testid} role={error ? 'alert' : 'status'}>
    <p>{error || 'Memuat data…'}</p>
    {error && <button type="button" onClick={retry} className="btn-outline">Coba lagi</button>}
  </div>;
}
