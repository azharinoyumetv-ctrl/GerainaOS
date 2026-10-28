"""Compatibility entry point for the complete replica/browser erasure bench."""
import asyncio
from verify_erasure_workflow_replica import main
if __name__ == "__main__":
    asyncio.run(main())
