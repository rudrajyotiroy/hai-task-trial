"""Cloudflare Workers AI benchmark on 200 actual Hugging Face memes.

Uses a dedicated results directory. Gemini checkpoints are NEVER combined with
Cloudflare predictions. Does not transmit the source's ground truth to Cloudflare.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import os
import time
from pathlib import Path

import requests
from PIL import Image
from pydantic import ValidationError

import source_dataset as source

MODEL = "@cf/google/gemma-4-26b-a4b-it"
RESULTS = Path(__file__).resolve().parent / "results_cloudflare"
source.OUT = RESULTS
source.MODEL = MODEL

PROMPT = source.PROMPT + """

Return ONE complete, parseable JSON object only. No markdown or prose outside JSON.
Use this exact structure, all fields required:
{
 "exposure": {
  "potentially_distressing": false,
  "categories": [],
  "potentially_affected_viewers": [],
  "concrete_cues": [],
  "neutral_exposure_notice": "",
  "image_description": "",
  "euphemized_caption": ""
 },
 "classification": {
  "hateful": false,
  "evidence": [],
  "explanation": "",
  "alternative_interpretation": "",
  "subjective_confidence": 0.5
 }
}
Arrays are arrays of short strings. Booleans are true/false, not strings.
Do not include the original offensive words in the exposure preview.
Keep the answer concise, with 1-3 evidence strings and 1-2 sentences per explanation.
"""

def image_data_url(row):
    path = RESULTS / "image_cache" / row["image_relpath"]
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.is_file():
        path.write_bytes(source.get_bytes(row["image_url"], timeout=120))
    with Image.open(path) as original:
        img = original.convert("RGB")
        img.thumbnail((896, 896))
        buffer = io.BytesIO()
        img.save(buffer, "JPEG", quality=78, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def parse_result(value):
    if not isinstance(value, str):
        raise ValueError("Expected model output text")
    text = value.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    if not text.startswith("{"):
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("Model returned no JSON object")
        text = text[start:end+1]
    return source.ModelResult.model_validate_json(text).model_dump()


def call_api(token, account, row, timeout=120):
    endpoint = f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1/chat/completions"
    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT + "\nOriginal meme caption: " + row["meme_text"]},
                    {"type": "image_url", "image_url": {"url": image_data_url(row)}},
                ],
            },
        ],
        "temperature": 0,
        "max_completion_tokens": 3500,
        "reasoning_effort": "low",
        "chat_template_kwargs": {"enable_thinking": False},
        "response_format": {"type": "json_object"},
        "stream": False,
    }
    response = requests.post(
        endpoint,
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "User-Agent": "HAI-Assignment2-Research/1.0",
        },
        json=payload, timeout=timeout,
    )
    if response.status_code != 200:
        # Do not expose headers or credentials.
        raise requests.HTTPError(f"Cloudflare HTTP {response.status_code}: {response.text[:350]}")
    data = response.json()
    if "choices" not in data or not data["choices"]:
        raise ValueError(f"Unexpected Cloudflare response format: {str(data)[:300]}")
    body = data["choices"][0]["message"]["content"]
    try:
        parsed = parse_result(body)
    except (ValidationError, ValueError) as err:
        info = data["choices"][0]
        raise ValueError(
            f"Model JSON incomplete (finish_reason={info.get('finish_reason')}; "
            f"characters={len(str(body))}; usage={data.get('usage')})"
        ) from err
    return parsed, data.get("usage") or {}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=5, help="Cumulative target, 5 for pilot or 200 for full study")
    p.add_argument("--delay", type=float, default=3.0)
    p.add_argument("--prepare-only", action="store_true")
    p.add_argument("--stop-on-error", action="store_true")
    args = p.parse_args()
    if not 1 <= args.limit <= 200 or args.delay < 0:
        p.error("--limit must be between 1 and 200; --delay cannot be negative")

    trials = source.prepare_trials()
    if args.prepare_only:
        source.export(trials)
        return
    key = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    if not key or not account:
        source.export(trials)
        p.error("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID as GitHub Actions secrets.")

    prior = source.checkpoint()
    consecutive_errors = 0
    for i, trial in enumerate(trials[:args.limit], 1):
        if prior.get(trial["trial_id"], {}).get("result"):
            continue
        print(f"Cloudflare trial {i}/{args.limit} {trial['trial_id']}", flush=True)
        try:
            result, usage = call_api(key, account, trial)
            entry = {
                "trial_id": trial["trial_id"],
                "source_id": trial["source_id"],
                "model": MODEL,
                "result": result,
                "usage": {
                    "prompt_tokens": usage.get("prompt_tokens"),
                    "completion_tokens": usage.get("completion_tokens"),
                    "total_tokens": usage.get("total_tokens"),
                },
            }
            consecutive_errors = 0
            source.append(entry)
            prior[trial["trial_id"]] = entry
            print("OK", trial["trial_id"], "tokens:", usage, flush=True)
        except (requests.RequestException, ValidationError, ValueError, OSError) as err:
            message = f"{type(err).__name__}: {str(err)[:320]}"
            source.append({"trial_id": trial["trial_id"], "source_id": trial["source_id"], "error": message})
            consecutive_errors += 1
            print("ERROR", trial["trial_id"], message, flush=True)
            if (
                args.stop_on_error or consecutive_errors >= 2
                or any(marker in message for marker in ("HTTP 429", "HTTP 402", "HTTP 403", "HTTP 401"))
            ):
                print("Stopping; rerun later to resume after quota reset or error correction.", flush=True)
                break
        if i < args.limit:
            time.sleep(args.delay)

    source.export(trials)
    n = sum(bool(x.get("result")) for x in source.checkpoint().values())
    print(f"Cloudflare results saved: {n}/200 complete, in {RESULTS}", flush=True)


if __name__ == "__main__":
    main()
