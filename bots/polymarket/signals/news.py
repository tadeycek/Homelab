"""News / context fetcher for market questions.

Strategy: use GDELT's free Doc API (no key, no auth) to pull recent English-
language news headlines related to the question. Falls back to a short generic
"no news found" message so the estimator can still run with lower confidence.

GDELT Doc API docs: https://blog.gdeltproject.org/gdelt-2-0-our-global-decision/

Swap `recent_context()` with any other retrieval function — the rest of the
pipeline just calls recent_context(question) -> str and doesn't care how it
works.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc"
_MAX_ARTICLES = 5      # headlines to return per question
_LOOKBACK_DAYS = 7     # search window


def _build_query(question: str) -> str:
    """Strip question marks and common filler words for better GDELT match."""
    stop = {"will", "the", "a", "an", "be", "is", "are", "was", "were", "in", "?"}
    tokens = [t for t in question.lower().split() if t not in stop]
    # Use up to 8 significant tokens joined with spaces (GDELT treats as AND)
    return " ".join(tokens[:8])


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=6))
def _gdelt_fetch(query: str) -> list[dict]:
    """Call GDELT Doc API and return article list."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=_LOOKBACK_DAYS)
    # GDELT datetime format: YYYYMMDDHHMMSS
    fmt = "%Y%m%d%H%M%S"

    params = {
        "query": query,
        "mode": "ArtList",
        "maxrecords": _MAX_ARTICLES,
        "startdatetime": start.strftime(fmt),
        "enddatetime": end.strftime(fmt),
        "sort": "DateDesc",
        "format": "json",
    }
    with httpx.Client(timeout=15) as c:
        r = c.get(GDELT_BASE, params=params)
        r.raise_for_status()
        data = r.json()

    return data.get("articles") or []


def recent_context(question: str) -> str:
    """Return a short multi-line string of recent news context for `question`.

    Never raises — if news fetch fails, returns a "no context" string so the
    estimator can still run (at lower confidence).

    Format returned:
        [2026-06-10] Source: Headline title
        [2026-06-09] Source: Another headline
        ...

    Or:
        No recent news found. Estimate with base rates only.
    """
    try:
        q = _build_query(question)
        if not q:
            return "No recent news found. Estimate with base rates only."

        articles = _gdelt_fetch(q)
        if not articles:
            return "No recent news found. Estimate with base rates only."

        lines = []
        for a in articles[:_MAX_ARTICLES]:
            date_raw = a.get("seendate", "")[:8]  # YYYYMMDD prefix
            try:
                date_fmt = datetime.strptime(date_raw, "%Y%m%d").strftime("%Y-%m-%d")
            except ValueError:
                date_fmt = date_raw
            source = a.get("domain", "unknown")
            title = a.get("title", "").strip()
            if title:
                lines.append(f"[{date_fmt}] {source}: {title}")

        return "\n".join(lines) if lines else "No recent news found. Estimate with base rates only."

    except Exception as exc:
        logger.warning("News fetch failed for '%s': %s", question[:60], exc)
        return "News fetch failed. Estimate with base rates only."
