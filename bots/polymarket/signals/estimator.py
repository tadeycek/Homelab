"""LLM-based probability estimator — the core edge.

Calls Claude with the market question, resolution date, and recent news context.
Forces structured JSON output. Returns a calibrated {p_true, confidence, rationale}.

Key design choices:
  - We do NOT show Claude the current market price to avoid anchoring.
  - We demand explicit calibration: if news is thin, lower confidence.
  - We use claude-sonnet-4-6 by default (cost-efficient); swap to opus-4-8
    via ESTIMATOR_MODEL env var for harder / higher-stakes questions.
  - Retries on JSON parse errors (LLM occasionally adds extra prose).
  - Logs every estimate to disk for calibration analysis after paper trading.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

# Injected at call-time from config to avoid circular imports
_client: anthropic.Anthropic | None = None


def init(api_key: str) -> None:
    """Initialise the Anthropic client. Call once at startup."""
    global _client
    _client = anthropic.Anthropic(api_key=api_key)


@dataclass
class Estimate:
    p_true: float       # estimated probability of YES resolution (0–1)
    confidence: float   # forecaster's self-assessed confidence (0–1)
    rationale: str      # one-sentence justification

    def is_usable(self, min_confidence: float = 0.6) -> bool:
        return (
            0.0 < self.p_true < 1.0
            and self.confidence >= min_confidence
        )


_SYSTEM = """\
You are a calibrated superforecaster. Your job is to estimate the probability \
that a binary prediction market event resolves YES.

Rules:
- Reason carefully using the news context provided.
- Do NOT look at or anchor to any market price — you are not told it.
- Be calibrated: if news is sparse or ambiguous, lower your confidence score.
- Confidence reflects how sure you are that your p_true estimate is correct, \
  not how sure you are about the event itself.
- Output ONLY valid JSON — no markdown, no explanation outside the JSON.
"""

_USER_TMPL = """\
QUESTION: {question}

RESOLUTION DATE: {end_date}

RECENT NEWS CONTEXT:
{context}

DESCRIPTION (if any):
{description}

Now estimate the probability this resolves YES.

Output exactly this JSON (numbers as floats 0–1, rationale as a single sentence):
{{"p_true": <float>, "confidence": <float>, "rationale": "<string>"}}
"""


def _parse_json(text: str) -> dict:
    """Extract and parse the JSON object from model output.

    The model sometimes adds brief prose before/after the JSON block.
    We find the first {...} span and parse it.
    """
    match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in response: {text[:200]!r}")
    return json.loads(match.group())


def _validate(data: dict) -> Estimate:
    p = float(data["p_true"])
    c = float(data["confidence"])
    r = str(data.get("rationale", ""))
    if not (0.0 <= p <= 1.0):
        raise ValueError(f"p_true out of range: {p}")
    if not (0.0 <= c <= 1.0):
        raise ValueError(f"confidence out of range: {c}")
    return Estimate(p_true=p, confidence=c, rationale=r)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
def estimate(
    question: str,
    end_date: str,
    context: str,
    description: str = "",
    model: str = "claude-sonnet-4-6",
) -> Estimate:
    """Call Claude and return a calibrated probability estimate.

    Args:
        question:    The market question text.
        end_date:    ISO string resolution date.
        context:     Recent news context from signals.news.recent_context().
        description: Optional market description for additional clarity.
        model:       Anthropic model ID. Defaults to Sonnet for cost efficiency.

    Returns:
        Estimate dataclass.

    Raises:
        RuntimeError: if init() was not called.
        ValueError:   if the model returns unparseable or out-of-range output
                      (after retries).
    """
    if _client is None:
        raise RuntimeError("Call estimator.init(api_key) before estimating.")

    prompt = _USER_TMPL.format(
        question=question,
        end_date=end_date,
        context=context,
        description=description[:500] if description else "N/A",
    )

    msg = _client.messages.create(
        model=model,
        max_tokens=512,
        system=_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    raw_text = msg.content[0].text

    try:
        data = _parse_json(raw_text)
        est = _validate(data)
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        logger.warning("Estimator parse error (%s) — raw: %s", exc, raw_text[:300])
        raise  # tenacity will retry

    logger.debug(
        "Estimate: q='%s' p_true=%.3f conf=%.2f '%s'",
        question[:60], est.p_true, est.confidence, est.rationale,
    )
    return est
