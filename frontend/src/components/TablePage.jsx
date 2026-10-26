export default function TablePage({ value, label = "produk" }) {
  return <div className="flex flex-wrap items-center gap-3 mt-4" data-testid="table-pagination"><span>{value.count} {label} · halaman {value.page + 1}/{value.pages}</span><button type="button" className="btn-outline" disabled={value.page === 0} onClick={() => value.setPage(value.page - 1)}>Sebelumnya</button><button type="button" className="btn-outline" disabled={value.page + 1 >= value.pages} onClick={() => value.setPage(value.page + 1)}>Berikutnya</button></div>;
}
