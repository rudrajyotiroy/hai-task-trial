"""Evaluate only Cloudflare outputs, never mix with Gemini pilot results."""
from __future__ import annotations

import os
from pathlib import Path

BASE = Path(__file__).resolve().parent
os.environ["A2_RESULTS_DIR"] = str(BASE / "results_cloudflare")
os.environ["A2_MODEL_ID"] = "@cf/google/gemma-4-26b-a4b-it"

import evaluate_200

if __name__ == "__main__":
    evaluate_200.main()
