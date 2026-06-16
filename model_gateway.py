"""
Model Gateway — provider selection for AI qualification calls.

Primary:  OpenRouter  — when OPENROUTER_API_KEY is set. OR handles its own
                        internal model fallbacks across the configured route.
Fallback: Anthropic   — used when no OpenRouter key is configured (e.g. local
                        dev or before an OR account is set up). Prompt caching
                        keeps batch costs low in this mode.

Local tier (Ollama) is preserved but commented out. Uncomment for extreme
cases where both cloud providers are unavailable.
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
    # OLLAMA_BASE_URL,  # uncomment with Ollama tier below
    # OLLAMA_MODEL,
)

_log = logging.getLogger(__name__)

PROVIDER_OPENROUTER = "openrouter"
PROVIDER_ANTHROPIC  = "anthropic"
# PROVIDER_OLLAMA   = "ollama"  # uncomment with Ollama tier below

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


# ── Primary: OpenRouter ───────────────────────────────────────────────────────

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


# ── Fallback: Anthropic (no OpenRouter key configured) ────────────────────────

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


# ── Local tier: Ollama — uncomment for extreme fallback scenarios ──────────────
# def _call_ollama(system_prompt: str, user_content: str) -> dict:
#     resp = requests.post(
#         f"{OLLAMA_BASE_URL}/api/chat",
#         json={
#             "model": OLLAMA_MODEL,
#             "messages": [
#                 {"role": "system", "content": system_prompt},
#                 {"role": "user", "content": user_content},
#             ],
#             "stream": False,
#             "format": "json",
#         },
#         timeout=120,
#     )
#     resp.raise_for_status()
#     return json.loads(_strip_markdown(resp.json()["message"]["content"]))


# ── Provider selection ────────────────────────────────────────────────────────

def call_with_cascade(system_prompt: str, user_content: str) -> Tuple[dict, str]:
    """
    Call the AI model via the configured provider.

    If OPENROUTER_API_KEY is set, OpenRouter is used (with one retry on 429).
    Model-level fallbacks within OpenRouter are handled by OR's own routing.

    If no OPENROUTER_API_KEY, Anthropic direct is used as fallback (prompt
    caching keeps batch cost low).

    Returns:
        (result_dict, provider_name)

    Raises:
        RuntimeError               — provider call failed
        anthropic.AuthenticationError — bad Anthropic API key
    """
    errors: list[str] = []

    if OPENROUTER_API_KEY:
        # ── OpenRouter (primary) ───────────────────────────────────────────────
        for attempt in range(2):
            try:
                result = _call_openrouter(system_prompt, user_content)
                if _validate(result):
                    return result, PROVIDER_OPENROUTER
                errors.append("openrouter: response missing required fields")
                break
            except requests.HTTPError as e:
                code = e.response.status_code if e.response is not None else 0
                if code == 429 and attempt == 0:
                    _log.warning("OpenRouter 429 — retrying in 5s")
                    time.sleep(5)
                    continue
                errors.append(f"openrouter HTTP {code}")
                break
            except requests.RequestException as e:
                errors.append(f"openrouter network: {e}")
                break
    else:
        # ── Anthropic (fallback when no OpenRouter key) ────────────────────────
        try:
            result = _call_anthropic(system_prompt, user_content)
            if _validate(result):
                return result, PROVIDER_ANTHROPIC
            errors.append("anthropic: response missing required fields")
        except anthropic.AuthenticationError:
            raise  # Bad key — surface immediately
        except Exception as e:
            errors.append(f"anthropic: {e}")

    # ── Local tier: Ollama — uncomment for extreme fallback scenarios ──────────
    # try:
    #     result = _call_ollama(system_prompt, user_content)
    #     if _validate(result):
    #         _log.warning("Gateway: fell back to Ollama. %s", "; ".join(errors))
    #         return result, PROVIDER_OLLAMA
    #     errors.append("ollama: response missing required fields")
    # except requests.RequestException as e:
    #     errors.append(f"ollama: {e}")

    raise RuntimeError(f"Gateway failed — {'; '.join(errors)}")
