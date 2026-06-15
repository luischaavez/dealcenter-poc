"""
Model Gateway — three-tier cascade for AI qualification calls.

Tier 1: Anthropic direct   — cheapest with prompt caching; preferred
Tier 2: OpenRouter         — commercial fallback when Anthropic is unavailable
Tier 3: Ollama local       — always available; lower-confidence marker

Returns (result: dict, provider: str) where provider is one of the
PROVIDER_* constants defined below. Callers should store the provider
in the result dict as "_gateway_provider" so scorer.py can apply penalties.
"""

import json
import logging
import time
from typing import Tuple

import requests
import anthropic

from config import (
    ANTHROPIC_API_KEY,
    QUALIFIER_MODEL,
    OPENROUTER_API_KEY,
    OPENROUTER_MODEL,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
)

_log = logging.getLogger(__name__)

PROVIDER_ANTHROPIC  = "anthropic"
PROVIDER_OPENROUTER = "openrouter"
PROVIDER_OLLAMA     = "ollama"

_anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def _strip_markdown(raw: str) -> str:
    """Remove ```json ... ``` fences that some models add."""
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


def _validate(result: dict) -> bool:
    required = ["qualifies", "services_needed", "actionability_score", "revenue_estimate"]
    return all(k in result for k in required)


# ── Tier 1: Anthropic ─────────────────────────────────────────────────────────

def _call_anthropic(system_prompt: str, user_content: str) -> dict:
    response = _anthropic_client.messages.create(
        model=QUALIFIER_MODEL,
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
    )
    return json.loads(_strip_markdown(response.content[0].text))


# ── Tier 2: OpenRouter ────────────────────────────────────────────────────────

def _call_openrouter(system_prompt: str, user_content: str) -> dict:
    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://dealcenter.app",
            "X-Title": "DealCenter",
        },
        json={
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "response_format": {"type": "json_object"},
            "max_tokens": 1024,
        },
        timeout=60,
    )
    resp.raise_for_status()
    return json.loads(_strip_markdown(resp.json()["choices"][0]["message"]["content"]))


# ── Tier 3: Ollama ────────────────────────────────────────────────────────────

def _call_ollama(system_prompt: str, user_content: str) -> dict:
    resp = requests.post(
        f"{OLLAMA_BASE_URL}/api/chat",
        json={
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "stream": False,
            "format": "json",
        },
        timeout=120,
    )
    resp.raise_for_status()
    return json.loads(_strip_markdown(resp.json()["message"]["content"]))


# ── Cascade ───────────────────────────────────────────────────────────────────

def call_with_cascade(system_prompt: str, user_content: str) -> Tuple[dict, str]:
    """
    Try Anthropic → OpenRouter → Ollama in order.

    Falls through to the next tier on transient failures (rate limit,
    overload, network errors). Re-raises on permanent errors (bad API key).

    Returns:
        (result_dict, provider_name)

    Raises:
        RuntimeError  — all tiers failed (details in message)
        anthropic.AuthenticationError — bad Anthropic API key
    """
    errors: list[str] = []

    # ── Tier 1 ────────────────────────────────────────────────────────────────
    try:
        result = _call_anthropic(system_prompt, user_content)
        if _validate(result):
            return result, PROVIDER_ANTHROPIC
        errors.append("anthropic: response missing required fields")
    except anthropic.AuthenticationError:
        raise  # Bad key — surface immediately, don't silently fall through
    except (anthropic.RateLimitError, anthropic.APIConnectionError) as e:
        errors.append(f"anthropic transient: {type(e).__name__}")
    except anthropic.APIStatusError as e:
        if e.status_code >= 500:
            errors.append(f"anthropic server error {e.status_code}")
        else:
            raise  # 4xx other than 429 = config / billing issue
    except Exception as e:
        errors.append(f"anthropic: {e}")

    # ── Tier 2 ────────────────────────────────────────────────────────────────
    if OPENROUTER_API_KEY:
        for attempt in range(2):
            try:
                result = _call_openrouter(system_prompt, user_content)
                if _validate(result):
                    _log.warning("Gateway: fell back to OpenRouter. %s", "; ".join(errors))
                    return result, PROVIDER_OPENROUTER
                errors.append("openrouter: response missing required fields")
                break
            except requests.HTTPError as e:
                code = e.response.status_code if e.response is not None else 0
                if code == 429 and attempt == 0:
                    time.sleep(5)
                    continue
                errors.append(f"openrouter HTTP {code}")
                break
            except requests.RequestException as e:
                errors.append(f"openrouter network: {e}")
                break
    else:
        errors.append("openrouter: OPENROUTER_API_KEY not set")

    # ── Tier 3 ────────────────────────────────────────────────────────────────
    try:
        result = _call_ollama(system_prompt, user_content)
        if _validate(result):
            _log.warning("Gateway: fell back to Ollama. %s", "; ".join(errors))
            return result, PROVIDER_OLLAMA
        errors.append("ollama: response missing required fields")
    except requests.RequestException as e:
        errors.append(f"ollama: {e}")

    raise RuntimeError(f"All gateway tiers failed — {'; '.join(errors)}")
