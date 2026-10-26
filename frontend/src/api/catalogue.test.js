import api from './client';
import { loadCatalogue } from './catalogue';
jest.mock('./client', () => ({ __esModule: true, default: { get: jest.fn() } }));
beforeEach(() => api.get.mockReset());

test('loads every page beyond 500 and reports completion without truncation', async () => {
  const first = Array.from({ length: 500 }, (_, i) => ({ id: `p-${i}` }));
  api.get.mockResolvedValueOnce({ data: { items: first, total: 501, next_cursor: 'page-2' } })
    .mockResolvedValueOnce({ data: { items: [{ id: 'p-500' }], total: 501, next_cursor: null } });
  const progress = jest.fn(), controller = new AbortController();
  expect(await loadCatalogue({ signal: controller.signal, activeOnly: true, onProgress: progress })).toHaveLength(501);
  expect(api.get.mock.calls[1][1]).toMatchObject({ signal: controller.signal, params: { cursor: 'page-2', active_only: true, limit: 500 } });
  expect(progress).toHaveBeenLastCalledWith({ loaded: 501, total: 501 });
});

test('a later page error rejects rather than returning a partial offline snapshot', async () => {
  api.get.mockResolvedValueOnce({ data: { items: [{ id: 'first' }], total: 2, next_cursor: 'next' } }).mockRejectedValueOnce(new Error('Interrupted'));
  await expect(loadCatalogue()).rejects.toThrow('Interrupted');
});

test.each([
  { items: [], total: 1, next_cursor: null },
  { items: [{ id: 'same' }, { id: 'same' }], total: 2, next_cursor: null },
  { items: [], total: 2, next_cursor: 'next' },
  [],
])('invalid or incomplete catalogue is not acknowledged as complete: %j', async data => {
  api.get.mockResolvedValueOnce({ data });
  await expect(loadCatalogue()).rejects.toThrow();
});

test('concurrent catalogue size changes are explicit rather than silently incomplete', async () => {
  api.get.mockResolvedValueOnce({ data: { items: [{ id: 'one' }], total: 2, next_cursor: 'next' } })
    .mockResolvedValueOnce({ data: { items: [{ id: 'two' }], total: 3, next_cursor: null } });
  await expect(loadCatalogue()).rejects.toThrow(/berubah/);
});
