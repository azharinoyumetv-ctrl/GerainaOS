"""Cross-product write fencing. Keep this file identical in both backends.

Every application mutation touches the relevant guard in the SAME transaction
as the mutation. Closing a guard therefore waits for earlier writes and blocks
later/in-flight writes. No expiring lease can reopen a closed account/store.
Privileged erasure operations alone use the raw database.
"""
import hashlib
import os
import time
from pathlib import Path
from contextvars import ContextVar

import jwt
from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, OperationFailure

actor_context = ContextVar("erasure_actor", default=(None, None))
actor_expiry = ContextVar("erasure_actor_expiry", default=None)
session_context = ContextVar("erasure_session", default=None)
guard_context = ContextVar("erasure_touched_guards", default=None)
INTERNAL = frozenset({"erasure_guards", "erasure_jobs", "erasure_retained"})
PROTOCOL = "dagangos-erasure-fence-v1"
MUTATIONS = frozenset({"insert_one", "insert_many", "update_one", "update_many",
                       "replace_one", "delete_one", "delete_many", "find_one_and_update",
                       "find_one_and_replace", "find_one_and_delete"})


class GuardCreationRace(Exception):
    """A concurrent first writer inserted the same guard; retry the transaction."""


def guard_key(kind, *values):
    value = "\0".join(str(part) for part in values)
    return kind + ":" + hashlib.sha256(value.encode()).hexdigest()


def implementation_fingerprint():
    try: return hashlib.sha256(Path(__file__).read_bytes().replace(b"\r\n", b"\n")).hexdigest()
    except OSError: return None


def capabilities(module, db):
    return {"module": module, "protocol": PROTOCOL, "implementation_sha256": implementation_fingerprint(),
            "write_fence_enabled": isinstance(db, GuardedDatabase)}


async def touch_active(db, keys, session):
    for key in sorted(set(keys)):
        touched = guard_context.get() if session_context.get() is session else None
        cache_key = (db.name, key)
        if touched is not None and cache_key in touched:
            continue  # The transaction already holds this guard's write lock.
        try:
            guard = await db.erasure_guards.find_one_and_update(
                {"_id": key}, {"$setOnInsert": {"state": "active"}, "$inc": {"revision": 1}},
                upsert=True, return_document=ReturnDocument.AFTER, projection={"state": 1}, session=session)
        except DuplicateKeyError:
            raise GuardCreationRace() from None
        if guard.get("state") != "active":
            raise HTTPException(409, "Akses akun/toko sedang ditutup atau telah dihapus. Data belum disimpan.")
        if touched is not None: touched.add(cache_key)


async def transaction(db, operation):
    for attempt in range(4):
        try:
            async with await db.client.start_session() as session:
                async def callback(current):
                    token = session_context.set(current)
                    guards_token = guard_context.set(set())
                    try:
                        return await operation(current)
                    finally:
                        guard_context.reset(guards_token)
                        session_context.reset(token)
                return await session.with_transaction(callback)
        except GuardCreationRace:
            if attempt == 3:
                raise HTTPException(503, "Penyimpanan sedang sibuk. Coba lagi dengan referensi transaksi yang sama.") from None
        except (NotImplementedError, OperationFailure) as error:
            if isinstance(error, NotImplementedError) or error.code in (20, 303):
                raise HTTPException(503, "Penyimpanan transaksi belum siap. Data belum disimpan.") from None
            raise


class ErasureContextMiddleware:
    def __init__(self, app, default_module="geraina"):
        self.app, self.default_module = app, default_module

    async def __call__(self, scope, receive, send):
        headers = dict(scope.get("headers", []))
        module = headers.get(b"x-dagangos-module", self.default_module.encode()).decode(errors="ignore").lower()
        module = module if module in ("geraina", "dapuros") else self.default_module
        user_id = None
        expiry = None
        auth = headers.get(b"authorization", b"").decode(errors="ignore")
        if auth.lower().startswith("bearer "):
            try:
                claims = jwt.decode(auth[7:], os.getenv("JWT_SECRET_KEY", "change-me"),
                                    algorithms=[os.getenv("JWT_ALGORITHM", "HS256")])
                user_id = claims.get("sub") if isinstance(claims.get("sub"), str) else None
                expiry = claims.get("exp") if isinstance(claims.get("exp"), (int, float)) else None
            except jwt.PyJWTError:
                pass  # Existing route authentication returns the appropriate error.
        token = actor_context.set((user_id, module))
        expiry_token = actor_expiry.set(expiry)
        try:
            await self.app(scope, receive, send)
        finally:
            actor_expiry.reset(expiry_token)
            actor_context.reset(token)


class GuardedDatabase:
    def __init__(self, raw, default_module="geraina"):
        self.raw, self.default_module = raw, default_module

    def __getitem__(self, name):
        return GuardedCollection(self, self.raw[name])

    def __getattr__(self, name):
        if name.startswith("_") or name in ("client", "name", "command", "list_collection_names", "list_collections"):
            return getattr(self.raw, name)
        return self[name]

    def get_collection(self, name, **kwargs):
        return GuardedCollection(self, self.raw.get_collection(name, **kwargs))


class GuardedCollection:
    def __init__(self, db, raw):
        self.db, self.raw = db, raw

    def __getattr__(self, name):
        if name in MUTATIONS:
            async def mutate(*args, **kwargs):
                return await self._mutate(name, args, kwargs)
            return mutate
        if name in ("bulk_write", "drop", "rename", "map_reduce", "inline_map_reduce"):
            raise HTTPException(503, "Operasi harus menggunakan jalur penulisan yang terlindungi.")
        return getattr(self.raw, name)

    def aggregate(self, pipeline, *args, **kwargs):
        if any("$out" in stage or "$merge" in stage for stage in pipeline):
            raise HTTPException(503, "Agregasi penulisan tidak diizinkan pada jalur aplikasi.")
        return self.raw.aggregate(pipeline, *args, **kwargs)

    async def _keys(self, method, args, kwargs, session):
        raw_db = self.db.raw
        actor, module = actor_context.get()
        if actor_expiry.get() is not None and actor_expiry.get() <= time.time():
            raise HTTPException(401, "Sesi telah berakhir. Data belum disimpan; masuk kembali.")
        module = module or self.db.default_module
        keys = set()
        if actor:
            keys.update((guard_key("account", actor), guard_key("module", actor, module)))
        if method == "insert_many":
            documents = list(args[0])
            prospective = {id(row) for row in documents}
        elif method == "insert_one":
            documents = [args[0]]
            prospective = {id(args[0])}
        else:
            query = args[0]
            projection = {field: 1 for field in ("id", "store_id", "owner_user_id", "user_id", "module")}
            # An equality-scoped business mutation is already confined to one
            # store. Avoid a redundant read on every sale line/stock update.
            scoped = (isinstance(query.get("store_id"), str)
                      and self.raw.name not in ("users", "stores", "staff"))
            documents = [] if scoped else await self.raw.find(query, projection, session=session).limit(1001).to_list(1001)
            if len(documents) > 1000:
                raise HTTPException(413, "Bagi perubahan massal menjadi batch paling banyak 1000 catatan.")
            # Include upsert/replacement values and equality filters. Query
            # operators are never interpreted as an identity.
            candidates = [query]
            if len(args) > 1 and isinstance(args[1], dict):
                update = args[1]
                candidates.extend([update, update.get("$set", {}), update.get("$setOnInsert", {})])
            documents.extend(candidates)
            prospective = {id(row) for row in candidates}
        for row in documents:
            if not isinstance(row, dict):
                continue
            store_id = row.get("store_id")
            if self.raw.name == "stores":
                store_id = row.get("id", store_id)
            if self.raw.name in ("counters", "capacity_guards") and isinstance(row.get("_id"), str):
                store_id = row["_id"].split(":", 1)[0]
            if (self.raw.name != "users" or id(row) in prospective) and isinstance(store_id, str) and store_id:
                keys.add(guard_key("store", store_id))
            if self.raw.name == "users" and isinstance(row.get("id"), str):
                # Account fields shared by the two apps are fenced by the
                # request's module, not the legacy active-store pointer.
                keys.add(guard_key("account", row["id"]))
                keys.add(guard_key("module", row["id"], module))
                if id(row) in prospective and isinstance(row.get("subscriptions"), dict):
                    keys.update(guard_key("module", row["id"], product) for product in row["subscriptions"] if product in ("geraina", "dapuros"))
                for update in args[1:2]:
                    if isinstance(update, dict):
                        for operator in ("$set", "$unset"):
                            for field in (update.get(operator) or {}):
                                for product in ("geraina", "dapuros"):
                                    if field.startswith("subscriptions." + product):
                                        keys.add(guard_key("module", row["id"], product))
                                if field == "subscriptions" and isinstance(update[operator][field], dict):
                                    keys.update(guard_key("module", row["id"], product) for product in update[operator][field] if product in ("geraina", "dapuros"))
            if self.raw.name == "stores" and isinstance(row.get("owner_user_id"), str):
                keys.add(guard_key("account", row["owner_user_id"]))
                keys.add(guard_key("module", row["owner_user_id"], row.get("module") or module))
            if self.raw.name == "staff":
                member = row.get("user_id") or row.get("id")
                if isinstance(member, str):
                    keys.add(guard_key("account", member))
                    if isinstance(store_id, str):
                        keys.add(guard_key("membership", member, store_id))
        return keys

    async def _mutate(self, method, args, kwargs):
        if self.raw.name in INTERNAL:
            raise HTTPException(403, "Data penghapusan hanya dapat diubah melalui alat dukungan berwenang.")
        kwargs = dict(kwargs)
        if not args:
            first = "documents" if method == "insert_many" else "document" if method == "insert_one" else "filter"
            if first not in kwargs: raise TypeError("Missing " + first)
            args = (kwargs.pop(first),)
        if method.startswith("update") or method in ("find_one_and_update", "replace_one", "find_one_and_replace"):
            second = "replacement" if "replace" in method else "update"
            if len(args) == 1 and second in kwargs: args = (*args, kwargs.pop(second))
        # Insert-many may receive a generator; materialize exactly once.
        if method == "insert_many":
            args = (list(args[0]), *args[1:])
        existing = kwargs.get("session") or session_context.get()

        async def apply(session):
            options = {**kwargs, "session": session}
            keys = await self._keys(method, args, options, session)
            if not keys and (method.startswith("insert") or kwargs.get("upsert")):
                raise HTTPException(422, "Identitas akun atau toko wajib jelas sebelum data dapat disimpan.")
            await touch_active(self.db.raw, keys, session)
            return await getattr(self.raw, method)(*args, **options)

        if existing is not None:
            return await apply(existing)
        return await transaction(self.db.raw, apply)
