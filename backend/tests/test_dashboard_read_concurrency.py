"""Dashboard reads must overlap without changing store scope or published totals."""
import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
import routes_orders


@pytest.mark.asyncio
async def test_dashboard_independent_reads_overlap(monkeypatch):
    ready = asyncio.Event()
    started = []

    async def read(name, value):
        started.append(name)
        if len(started) == 6:
            ready.set()
        await asyncio.wait_for(ready.wait(), timeout=1)
        return value

    class Orders:
        def aggregate(self, pipeline):
            assert pipeline[0]['$match']['store_id'] == 'store-a'
            assert pipeline[0]['$match']['payment_status'] == 'paid'
            group = pipeline[1]['$group']
            value = ([{'total': 1500, 'count': 3}] if group['_id'] is None
                     else [{'_id': '2026-10-28', 'value': 1500}])
            return SimpleNamespace(to_list=lambda length: read('orders', value))

    class Products:
        async def count_documents(self, query):
            assert query['store_id'] == 'store-a'
            return await read('products', 2 if 'stock' in query else 12)

    async def zone(db, store):
        assert store == 'store-a'
        return ZoneInfo('Asia/Jakarta')

    monkeypatch.setattr(routes_orders, 'get_db', lambda: SimpleNamespace(orders=Orders(), products=Products()))
    monkeypatch.setattr(routes_orders, 'store_zone', zone)
    monkeypatch.setattr(routes_orders, 'utcnow', lambda: datetime(2026, 10, 28, 6, tzinfo=timezone.utc))
    result = await routes_orders.stats({'store_id': 'store-a'})
    assert len(started) == 6
    assert result['today_sales'] == result['week_sales'] == result['month_sales'] == 1500
    assert result['today_orders'] == 3
    assert result['product_count'] == 12 and result['low_stock_count'] == 2
    assert result['daily_sales'][-1] == {'date': '2026-10-28', 'value': 1500}
    assert len(result['daily_sales']) == 7 and result['timezone'] == 'Asia/Jakarta'
