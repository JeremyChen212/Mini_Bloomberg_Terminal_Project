"""
app/core/cache.py

Simple in-memory TTL cache for API responses.

The `cached` decorator wraps async route handlers and caches their return value
for `ttl` seconds, keyed by function name + arguments.

Usage:
    @cached(ttl=60)
    async def my_handler(ticker: str):
        ...

Note: This is a lightweight in-memory cache — data is lost on server restart.
For production, swap the store for Redis (e.g. via fastapi-cache2).
"""
from __future__ import annotations

import asyncio
import functools
import hashlib
import json
import time
from typing import Any, Callable


# { cache_key: (expires_at_unix, value) }
_store: dict[str, tuple[float, Any]] = {}
_lock = asyncio.Lock()


def _make_key(fn: Callable, args: tuple, kwargs: dict) -> str:
    """Stable cache key from function name + serialised arguments."""
    raw = json.dumps(
        {"fn": fn.__qualname__, "args": args, "kwargs": kwargs},
        default=str,
        sort_keys=True,
    )
    return hashlib.sha256(raw.encode()).hexdigest()


def cached(ttl: int = 60):
    """
    Decorator that caches the return value of an async function for `ttl` seconds.

    Args:
        ttl: Time-to-live in seconds. Default 60 s.
    """
    def decorator(fn: Callable):
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            key = _make_key(fn, args, kwargs)
            now = time.monotonic()

            async with _lock:
                entry = _store.get(key)
                if entry and entry[0] > now:
                    return entry[1]

            result = await fn(*args, **kwargs)

            async with _lock:
                _store[key] = (now + ttl, result)

            return result
        return wrapper
    return decorator


def invalidate_all() -> None:
    """Clear the entire cache (useful in tests)."""
    _store.clear()
