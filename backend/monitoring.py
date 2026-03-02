"""
Mizan.ai — Monitoring & APM Middleware

Features:
  ✅ Request duration tracking per endpoint
  ✅ Error rate monitoring
  ✅ Percentile metrics (p50, p95, p99)
  ✅ /api/metrics endpoint
  ✅ Uptime tracking
"""
import time
import statistics
from collections import defaultdict, deque
from datetime import datetime, timezone
from fastapi import Request
from fastapi.responses import JSONResponse
from loguru import logger


# ── Metrics Store ──
_start_time = time.time()
_MAX_SAMPLES = 1000  # Keep last 1000 request durations per endpoint

_request_counts: dict = defaultdict(int)
_error_counts: dict = defaultdict(int)
_durations: dict = defaultdict(lambda: deque(maxlen=_MAX_SAMPLES))
_status_codes: dict = defaultdict(lambda: defaultdict(int))


def _percentile(data, pct: float) -> float:
    """Calculate percentile from a deque of values."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    idx = int(len(sorted_data) * pct / 100)
    idx = min(idx, len(sorted_data) - 1)
    return round(sorted_data[idx], 3)


# ══════════════════════════════════════════
# Middleware
# ══════════════════════════════════════════
async def monitoring_middleware(request: Request, call_next):
    """Track request metrics for all endpoints."""
    start = time.time()
    endpoint = f"{request.method} {request.url.path}"

    try:
        response = await call_next(request)
    except Exception as e:
        duration = time.time() - start
        _request_counts[endpoint] += 1
        _error_counts[endpoint] += 1
        _durations[endpoint].append(duration)
        _status_codes[endpoint][500] += 1
        raise

    duration = time.time() - start
    status = response.status_code

    _request_counts[endpoint] += 1
    _durations[endpoint].append(duration)
    _status_codes[endpoint][status] += 1

    if status >= 400:
        _error_counts[endpoint] += 1

    # Log slow requests
    if duration > 2.0:
        logger.warning(f"🐌 Slow request: {endpoint} took {duration:.2f}s (status={status})")

    return response


# ══════════════════════════════════════════
# Metrics Endpoint Data
# ══════════════════════════════════════════
def get_metrics() -> dict:
    """Return aggregated metrics for all endpoints."""
    uptime_seconds = time.time() - _start_time

    total_requests = sum(_request_counts.values())
    total_errors = sum(_error_counts.values())

    # Global latency
    all_durations = []
    for d in _durations.values():
        all_durations.extend(d)

    # Per-endpoint breakdown
    endpoints = {}
    for endpoint in sorted(_request_counts.keys()):
        durations = _durations[endpoint]
        endpoints[endpoint] = {
            "count": _request_counts[endpoint],
            "errors": _error_counts[endpoint],
            "latency_ms": {
                "avg": round(statistics.mean(durations) * 1000, 1) if durations else 0,
                "p50": round(_percentile(durations, 50) * 1000, 1),
                "p95": round(_percentile(durations, 95) * 1000, 1),
                "p99": round(_percentile(durations, 99) * 1000, 1),
            },
            "status_codes": dict(_status_codes[endpoint]),
        }

    return {
        "uptime_seconds": round(uptime_seconds, 1),
        "uptime_human": _format_uptime(uptime_seconds),
        "total_requests": total_requests,
        "total_errors": total_errors,
        "error_rate": round(total_errors / max(total_requests, 1) * 100, 2),
        "global_latency_ms": {
            "avg": round(statistics.mean(all_durations) * 1000, 1) if all_durations else 0,
            "p50": round(_percentile(all_durations, 50) * 1000, 1),
            "p95": round(_percentile(all_durations, 95) * 1000, 1),
            "p99": round(_percentile(all_durations, 99) * 1000, 1),
        },
        "endpoints": endpoints,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _format_uptime(seconds: float) -> str:
    """Format uptime as human-readable string."""
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"
