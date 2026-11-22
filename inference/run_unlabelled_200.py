"""Run the Cloudflare multimodal model on the unlabelled 200-meme manifest.

Unlike the original reproducibility benchmark, this runner NEVER loads labels
and has no dependence on the original ground-truth CSV. It reuses the original
Assignment 2 image encoder, prompt, API payload, and Pydantic result schema.

Environment: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN.
Install: pip install -r inference/requirements.txt
Usage: python inference/run_unlabelled_200.py --limit 5
       python inference/run_unlabelled_200.py --limit 200
"""
import argparse
import csv
import json
import os
import time
from pathlib import Path

import run_cloudflare

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "datasets" / "unlabelled_inference_200.csv"
DEFAULT_OUTPUT = ROOT / "output" / "cloudflare_predictions.jsonl"

def read_completed(path):
    previous = set()
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            record = json.loads(line)
            if "trial_id" in record and "result" in record:
                previous.add(record["trial_id"])
    return previous

def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--limit", type=int, default=5, help="Maximum number of first rows considered (1–200)")
    parser.add_argument("--delay", type=float, default=3.0, help="Delay between uncached requests")
    args = parser.parse_args()
    if args.limit < 1 or args.limit > 200 or args.delay < 0:
        parser.error("limit must be 1–200; delay must be nonnegative")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if not account or not token:
        parser.error("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (never add these to source control).")
    with args.input.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if len(rows) != 200:
        parser.error("Expected exactly 200 unlabelled input records")
    allowed_fields = {"trial_id", "image_url", "meme_text", "image_relpath"}
    if not allowed_fields.issubset(rows[0]):
        parser.error("Input must contain trial_id, image_url, meme_text, image_relpath")
    if set(rows[0]) != allowed_fields:
        parser.error("Refusing inference CSV with unexpected fields (possible ground-truth label leakage)")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    run_cloudflare.RESULTS = args.output.parent
    prior = read_completed(args.output)
    for i, row in enumerate(rows[:args.limit], 1):
        if row["trial_id"] in prior:
            continue
        result, usage = run_cloudflare.call_api(token, account, row)
        entry = {"trial_id": row["trial_id"], "model": run_cloudflare.MODEL,
                 "result": result, "usage": usage}
        with args.output.open("a", encoding="utf-8") as file:
            file.write(json.dumps(entry, ensure_ascii=False) + "\n")
        print("Recorded", row["trial_id"], f"({i}/{args.limit})", flush=True)
        if i < args.limit:
            time.sleep(args.delay)

if __name__ == "__main__":
    run()
