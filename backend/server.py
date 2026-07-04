"""Geraina POS by DagangOS - FastAPI server."""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

import sys
ROOT_DIR = Path(__file__).parent
sys.path.append(str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from database import close_db, get_db
from routes_auth import router as auth_router
from routes_products import router as products_router
from routes_orders import router as orders_router
from routes_webhooks import router as webhooks_router
from routes_pdf import router as pdf_router
from routes_pricing import router as pricing_router
from routes_inventory import router as inventory_router
from routes_purchase import router as purchase_router
from routes_customers import router as customers_router
from routes_staff import router as staff_router
from routes_settings import router as settings_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("geraina")

app = FastAPI(title="Geraina POS by DagangOS")

# Health check (mounted at /api by frontend, but also at root for k8s)
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {
        "service": "Geraina POS by DagangOS",
        "status": "ok",
        "version": "1.0.0",
    }


@api_router.get("/health")
async def health():
    try:
        db = get_db()
        await db.command("ping")
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


app.include_router(api_router)
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(webhooks_router)
app.include_router(pdf_router)
app.include_router(pricing_router)
app.include_router(inventory_router)
app.include_router(purchase_router)
app.include_router(customers_router)
app.include_router(staff_router)
app.include_router(settings_router)

cors_origins = os.environ.get("CORS_ORIGINS", "").split(",")
cors_origins = [o.strip() for o in cors_origins if o.strip()]
cors_origin_regex = r"https://.*\.pages\.dev|http://localhost(:\d+)?|https://(.*\.)?dagangos\.com"

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["http://localhost:3000"],
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _ensure_indexes():
    """Index idempotent — resolusi toko per-request (stores by owner+module) tetap cepat."""
    db = get_db()
    for coll, keys in (
        ("stores", [("owner_user_id", 1), ("module", 1)]),
        ("users", [("email", 1)]),
        ("orders", [("store_id", 1), ("created_at", -1)]),
        ("products", [("store_id", 1)]),
    ):
        try:
            await db[coll].create_index(keys)
        except Exception as e:
            logger.warning(f"ensure index {coll} failed: {e}")


@app.on_event("shutdown")
async def _shutdown():
    close_db()
