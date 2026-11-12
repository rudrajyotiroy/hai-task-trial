"""Offline contract checks for the Cloudflare Gemma 4 response parser."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run_cloudflare import MODEL, parse_result
import run_cloudflare


def _example():
    return {
        "exposure": {
            "potentially_distressing": False,
            "categories": [],
            "potentially_affected_viewers": [],
            "concrete_cues": [],
            "neutral_exposure_notice": "No specific distress cues observed.",
            "image_description": "A person standing beside a bicycle.",
            "euphemized_caption": "A harmless cycling joke.",
        },
        "classification": {
            "hateful": False,
            "evidence": ["Bicycle image", "Neutral caption"],
            "explanation": "No protected group is targeted.",
            "alternative_interpretation": "",
            "subjective_confidence": 0.7,
        },
    }


def test_cloudflare_model_and_checkpoint_are_isolated():
    assert MODEL == "@cf/google/gemma-4-26b-a4b-it"
    assert run_cloudflare.RESULTS.name == "results_cloudflare"
    assert run_cloudflare.source.OUT == run_cloudflare.RESULTS


def test_parses_plain_and_markdown_json():
    raw = json.dumps(_example())
    assert parse_result(raw)["classification"]["hateful"] is False
    assert parse_result("```json\n" + raw + "\n```")["classification"]["hateful"] is False


def test_requires_valid_response():
    try:
        parse_result("no JSON returned")
    except ValueError:
        pass
    else:
        raise AssertionError("Non-JSON response incorrectly accepted")
