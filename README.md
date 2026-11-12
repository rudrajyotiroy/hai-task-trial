# HAI Assignment 2: Cloudflare AI Trial Artifact

- Author : Rudrajyoti Roy (rudraroy)
- AI Agent Used : OpenAI Codex

**Source:** [limjiayi/hateful_memes_expanded](https://huggingface.co/datasets/limjiayi/hateful_memes_expanded),
original `train.jsonl`, with 100 hateful and 100 nonhateful memes sampled using
seed `5942026`. **Model:** Cloudflare Workers AI `@cf/google/gemma-4-26b-a4b-it`.

## Files

```text
HAI_Assignment_2_AI_Trial/
  README.md
  requirements.txt
  source_dataset.py             HF sampler, data schema, provenance, checkpoint
  run_cloudflare.py             Multimodal image+text API inference
  evaluate_cloudflare.py        Provider-specific scoring entry point
  evaluate_200.py               Confusion matrix, F1, and error review
  test_cloudflare.py            Offline parser tests
  results_cloudflare/
    study_trials_200.csv
    study_trials_200_with_ai.csv
    inference_checkpoint.jsonl
    provenance.json
    evaluation_metrics.json
```

## Prerequisites

Python 3.11 is recommended. From the extracted directory:

```bash
python -m pip install -r requirements.txt
```

## Reproduce the **published evaluation** without API access

These operations use the archived predictions, never contact Cloudflare,
and do not need an API key:

```bash
python -m pytest -q test_cloudflare.py
python evaluate_cloudflare.py
```

The evaluation script recalculates `evaluation_metrics.json`, the full
misclassification sheet `error_review.csv`, and
`error_distribution_preliminary.csv`. 

## Re-run inference (requires internet and Cloudflare account)

To regenerate the predictions, set environment variables:

- `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN`: a Workers AI API token

Run:

```bash
python run_cloudflare.py --limit 5 --delay 3
python run_cloudflare.py --limit 200 --delay 3
```

The script fetches original images from the
source repository; image bytes are not included in this archive. It verifies
the source IDs, captions, image paths and labels against the original JSONL.
Daily Workers Free quotas can require repeated runs. Results are checkpointed
and successful trial IDs are skipped on later runs. Inference is not
bitwise deterministic across model/service revisions.

## Final model results

| Measure | Value |
|---|---:|
| Source examples | 200 |
| Label distribution | 100 hateful / 100 nonhateful |
| Completion | 200 / 200 |
| Accuracy | 63.0% |
| Precision, hateful | 75.0% |
| Recall, hateful | 39.0% |
| F1, hateful | 51.3% |
| True positives | 39 |
| True negatives | 87 |
| False positives | 13 |
| False negatives | 61 |
| Errors | 74 |

Scores are computed against the **original Hugging Face reference labels**.
The model's reported confidence is
subjective and not calibrated.

## AI Usage Disclaimer

I acknowledge extensive usage of AI tools (OpenAI Codex) for coding assistance. Task ideation and planning as well as project structuring is done by me, and I have reviewed the AI generated code and output to ensure it matches my expectations. I also acknowledge CloudFlare's generous free access to their model Gemma 4 (26B parameters) through API. 
