"""Privileged support tool. Dry-run unless both --apply and its digest are given."""
import argparse
import asyncio
import json
from pathlib import Path

from pydantic import ValidationError
from pymongo.errors import PyMongoError
from fastapi import HTTPException

from account_erasure import (ErasureBlocked, ErasureCase, prepare_erasure, fulfill_erasure,
    begin_erasure, resume_erasure, cancel_erasure, get_job, public_job, acknowledge_external,
    purge_expired_retention)
from database import get_raw_db, close_db
from erasure_runtime import verify_runtime_fences


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", type=Path, help="Private, verified case record (JSON)")
    actions = parser.add_mutually_exclusive_group()
    for action in ("apply", "begin", "resume", "cancel", "status", "restore", "purge-expired"):
        actions.add_argument("--" + action, action="store_true")
    actions.add_argument("--ack-external", metavar="STEP")
    parser.add_argument("--evidence-ref")
    parser.add_argument("--outcome", choices=["completed", "not_applicable"], default="completed")
    parser.add_argument("--plan-digest")
    args = parser.parse_args()
    if bool(args.apply or args.begin or args.restore) != bool(args.plan_digest):
        parser.error("Applying requires --apply/--begin/--restore and the exact --plan-digest together.")
    if not args.purge_expired and not args.case: parser.error("A private --case is required.")
    if args.ack_external and not args.evidence_ref: parser.error("External confirmation requires --evidence-ref.")
    try:
        if args.purge_expired:
            print(json.dumps(await purge_expired_retention(get_raw_db()), sort_keys=True))
            return
        case = ErasureCase.model_validate_json(args.case.read_text(encoding="utf-8"))
        db = get_raw_db()
        if args.apply or args.begin or args.resume or args.restore:
            await verify_runtime_fences(db)
        if args.apply:
            result = await fulfill_erasure(db, case, args.plan_digest)
        elif args.begin or args.restore:
            result = public_job(await begin_erasure(db, case, args.plan_digest, restore=args.restore))
            if args.restore: result = await resume_erasure(db, case)
        elif args.resume:
            result = await resume_erasure(db, case)
        elif args.cancel:
            result = await cancel_erasure(db, case)
        elif args.status:
            job = await get_job(db, case)
            result = public_job(job) if job else {"phase": "not_started"}
        elif args.ack_external:
            result = await acknowledge_external(db, case, args.ack_external, args.evidence_ref, args.outcome)
        else:
            result = (await prepare_erasure(db, case)).summary()
            result["status"] = "dry-run-no-data-changed"
        print(json.dumps(result, sort_keys=True))
    except ValidationError:
        # Validation exceptions include supplied values. Never echo a case file.
        parser.exit(2, "Invalid erasure case; check its required fields locally. No case contents were logged.\n")
    except ErasureBlocked as error:
        parser.exit(2, str(error) + "\n")
    except (PyMongoError, HTTPException):
        parser.exit(2, "Database erasure was not confirmed. Inspect the case and database state before retrying; no success is claimed.\n")
    except OSError:
        parser.exit(2, "Unable to read the private case file or reach the database. No case contents were logged.\n")
    finally:
        close_db()


if __name__ == "__main__":
    asyncio.run(main())
