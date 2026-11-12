"""Reproducible benchmark and cautious exploratory error analysis for Assignment 2."""
from __future__ import annotations

import csv
import json
import os
import math
from collections import Counter
from pathlib import Path

BASE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get("A2_RESULTS_DIR", str(BASE / "results"))).resolve()


def load_rows(path=None):
    path = Path(path or RESULTS / "study_trials_200_with_ai.csv")
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def div(a, b):
    return round(a / b, 5) if b else None


def summarize(rows):
    completed = [r for r in rows if r["ai_status"] == "completed" and r["ai_hateful_prediction"] in ("0", "1")]
    examples = [(int(r["ground_truth_hateful"]), int(r["ai_hateful_prediction"])) for r in completed]
    tp = sum(y == 1 and p == 1 for y, p in examples)
    tn = sum(y == 0 and p == 0 for y, p in examples)
    fp = sum(y == 0 and p == 1 for y, p in examples)
    fn = sum(y == 1 and p == 0 for y, p in examples)
    n = len(examples)
    recall = div(tp, tp + fn)
    specificity = div(tn, tn + fp)
    output = {
        "source_dataset": "limjiayi/hateful_memes_expanded", "model": os.environ.get("A2_MODEL_ID", "gemini-3.8-flash"),
        "source_trials": len(rows), "completed_trials": n, "missing_trials": len(rows) - n,
        "completion_rate": div(n, len(rows)),
        "class_support_completed": dict(Counter(str(y) for y, _ in examples)),
        "confusion": {"TP": tp, "TN": tn, "FP": fp, "FN": fn},
        "accuracy": div(tp + tn, n), "precision_hateful": div(tp, tp + fp),
        "recall_hateful": recall, "specificity_nonhateful": specificity,
        "f1_hateful": div(2 * tp, 2 * tp + fp + fn),
        "balanced_accuracy": round((recall + specificity) / 2, 5) if recall is not None and specificity is not None else None,
        "error_count": fp + fn,
        "predicted_triggering_count": sum(r["ai_trigger_flag"].lower() == "true" for r in completed),
        "predicted_triggering_fraction": div(sum(r["ai_trigger_flag"].lower() == "true" for r in completed), n),
        "confidence_correct_mean": None, "confidence_wrong_mean": None,
        "model_self_confidence_calibration_warning": "Self-report is not a calibrated probabilistic guarantee.",
        "study_sample_is_balanced": True,
        "notes": [
            "The dataset has no independent trigger ground truth; trigger detection F1 cannot be reported.",
            "Conditional accuracy over completed API responses can be biased when calls fail or refuse.",
            "The source labels are reference annotations, not unequivocal judgments of subjective intent.",
            "A balanced study subset does not represent real-world prevalence.",
            "No human-only or human-AI participant results are available in Assignment 2.",
        ],
    }
    good = []
    bad = []
    confidences = []
    for r in completed:
        try:
            c = float(r["ai_confidence"])
        except (ValueError, TypeError):
            continue
        if 0 <= c <= 1:
            correctness = int(r["ground_truth_hateful"] == r["ai_hateful_prediction"])
            (good if correctness else bad).append(c)
            confidences.append((c, correctness))
    output["confidence_correct_mean"] = round(sum(good) / len(good), 4) if good else None
    output["confidence_wrong_mean"] = round(sum(bad) / len(bad), 4) if bad else None
    output["high_confidence_errors_at_0_8"] = sum(c >= 0.8 and correct == 0 for c, correct in confidences)
    output["high_confidence_total_at_0_8"] = sum(c >= 0.8 for c, _ in confidences)
    return output


CATEGORY_DESCRIPTIONS = {
    "quotation_satire": "Quotation, sarcasm or satire can invert the apparent message",
    "explicit_language_context": "Offensive language appears but its intent is context-dependent",
    "visual_text_interaction": "Meaning depends on how the image changes the caption",
    "implicit_stereotype": "An identity reference or stereotype is implicit rather than explicit",
    "visual_recognition": "Visual objects, symbols, or relationships may be misread",
    "other_ambiguous": "Insufficient evidence to identify a narrower theme from model text",
}


def possible_error_theme(row):
    """Automated triage suggestion, NOT a validated causal explanation of the error."""
    reason = (row.get("ai_explanation", "") + " " + row.get("ai_alternative", "")).lower()
    try:
        categories = json.loads(row.get("ai_trigger_categories") or "[]")
    except json.JSONDecodeError:
        categories = []
    if any(x in reason for x in ("sarcas", "satir", "ironic", "quotation", "quoted", "joking", "mocking")):
        return "quotation_satire"
    if "slur" in categories or "profanity" in categories:
        return "explicit_language_context"
    if any(x in reason for x in ("image and text", "image with text", "caption and image", "visual context", "image-text")):
        return "visual_text_interaction"
    if any(x in reason for x in ("stereotyp", "implicit", "identity", "demographic", "protected")):
        return "implicit_stereotype"
    if any(x in reason for x in ("picture", "photo", "symbol", "depiction", "depicts", "visual", "image")):
        return "visual_recognition"
    return "other_ambiguous"


def save_error_analysis(rows, base=RESULTS):
    errors = []
    for r in rows:
        if r["ai_status"] != "completed" or r["ai_hateful_prediction"] not in ("0", "1"):
            continue
        if r["ground_truth_hateful"] == r["ai_hateful_prediction"]:
            continue
        error = {
            "trial_id": r["trial_id"], "source_id": r["source_id"],
            "ground_truth": r["ground_truth_hateful"], "ai_prediction": r["ai_hateful_prediction"],
            "subjective_confidence": r["ai_confidence"],
            "error_direction": "false_positive" if r["ground_truth_hateful"] == "0" else "false_negative",
            "suggested_theme": possible_error_theme(r),
            "validated_error_theme": "", "manual_visual_review_completed": "no",
            "model_explanation": r.get("ai_explanation", ""),
            "human_correctable": "unassessed",
            "reviewer_notes": "",
        }
        errors.append(error)
    path = base / "error_review.csv"
    if errors:
        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(errors[0]))
            writer.writeheader()
            writer.writerows(errors)
    else:
        path.write_text("trial_id,source_id,ground_truth,ai_prediction,validated_error_theme,reviewer_notes\n")
    counts = Counter(r["suggested_theme"] for r in errors)
    dist = [{"theme": k, "description": CATEGORY_DESCRIPTIONS[k], "count": counts[k],
             "percent_of_errors": round(100 * counts[k] / len(errors), 2) if errors else None,
             "method": "heuristic preliminary triage, NOT human-validated"}
            for k in CATEGORY_DESCRIPTIONS]
    with (base / "error_distribution_preliminary.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(dist[0]))
        writer.writeheader()
        writer.writerows(dist)
    return dist


def main():
    RESULTS.mkdir(parents=True, exist_ok=True)
    rows = load_rows()
    if len(rows) != 200 or len({r["source_id"] for r in rows}) != 200:
        raise ValueError("The study dataset must contain 200 distinct source memes")
    results = summarize(rows)
    distribution = save_error_analysis(rows)
    results["preliminary_error_distribution"] = distribution
    (RESULTS / "evaluation_metrics.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in results.items() if k not in ("notes", "preliminary_error_distribution")}, indent=2))
    return results


if __name__ == "__main__":
    main()