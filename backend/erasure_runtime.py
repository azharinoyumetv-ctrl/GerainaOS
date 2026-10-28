"""Fail closed if production backends do not both advertise the same fence."""
import os
import re
from urllib.parse import urlsplit

import httpx

from erasure_guard import PROTOCOL, implementation_fingerprint
from erasure_workflow import ErasureBlocked


async def verify_runtime_fences(db):
    # The only bypass is a marked, randomly named fixture on a single loopback
    # host. Neither ENV=test nor a user-supplied URL can bypass production probes.
    uri = os.getenv("MONGO_URL", "")
    try: host = urlsplit(uri).hostname
    except ValueError: host = None
    if (host in ("127.0.0.1", "localhost", "::1")
            and re.fullmatch(r"geraina_erasure_(workflow|bench)_[a-f0-9]{32}", db.name)
            and await db.erasure_bench_fixture.find_one({"_id": "disposable-workflow-fixture-only"})):
        return {"status": "disposable-loopback-fixture"}
    fingerprints = []
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=False) as client:
            for module in ("geraina", "dapuros"):
                response = await client.get("https://dagangos.com/api/system/erasure-capabilities",
                    headers={"X-DagangOS-Module": module, "Cache-Control": "no-cache"})
                response.raise_for_status(); value = response.json()
                fingerprint = value.get("implementation_sha256")
                if (value.get("module") != module or value.get("protocol") != PROTOCOL
                        or value.get("write_fence_enabled") is not True
                        or not isinstance(fingerprint, str) or not re.fullmatch(r"[a-f0-9]{64}", fingerprint)):
                    raise ErasureBlocked("Both deployed backends must enable the matching write-fence protocol before erasure.")
                fingerprints.append(fingerprint)
    except (httpx.HTTPError, ValueError):
        raise ErasureBlocked("Runtime protection could not be verified on both official backends. No erasure was started.") from None
    if len(set(fingerprints)) != 1:
        raise ErasureBlocked("Deployed write-fence implementations do not match. Finish the coordinated rollout first.")
    if fingerprints[0] != implementation_fingerprint():
        raise ErasureBlocked("The local support tool and deployed write-fence versions do not match.")
    return {"status": "matching-production-fences", "implementation_sha256": fingerprints[0]}
