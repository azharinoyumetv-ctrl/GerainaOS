import { useEffect, useState } from 'react';
export default function useTablePage(items, size = 50) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [items]);
  const pages = Math.max(1, Math.ceil(items.length / size)), current = Math.min(page, pages - 1);
  return { rows: items.slice(current * size, (current + 1) * size), page: current, pages, count: items.length, setPage };
}
