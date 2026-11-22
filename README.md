# CSE 594 — Assignment 2 inference and human task-trial source package

**Snapshot:** 22 November 2026. **Purpose:** share source code and **unlabelled input datasets**, not evaluation ground truth or personally identifying participant responses.

## Contents

| Folder | Description |
| --- | --- |
| `inference/` | Original Python source for Cloudflare Workers AI / Gemma 4 26B A4B inference, prompt, schema, benchmark/evaluation scripts, and a new label-blind runner for the 200 supplied memes. |
| `datasets/unlabelled_inference_200.csv` | All **200** fixed study inputs: trial ID, original Hugging Face image URL, meme text, relative image path. **No reference label, AI verdict, accuracy, participant information, or evaluation field.** |
| `datasets/unlabelled_inference_200.jsonl` | The same 200 unlabelled inputs as JSONL. |
| `datasets/unlabelled_task_trials_all_200.csv` | The full 200-meme input pool available for participant sampling, with IDs, captions and image URLs only. |
| `datasets/unlabelled_task_trials_observed_146.csv` | The **146 distinct meme IDs actually encountered** in the corrected human-trial export, joined to original *unlabelled* captions and URLs. This is a subset, not 146 separate participants. |
| `datasets/observed_trial_ids_corrected_export.csv` | The 146 distinct trial IDs present in the **replacement** event export `task_trial_events(1).csv`. |
| `task_trials/` | Actual browser study app, Netlify/Vercel API adapters, Supabase schema, survey and attention-check flows, HTML and CSS, and the app's archived AI model-output fixture. |

**Important distinction:** The **unlabelled datasets under `datasets/` contain no ground truth or predictions**. The deployed study app's `task_trials/data/trials.json` additionally includes *archived model-generated predictions, explanations, trigger flags* because the historical assisted experiment displayed those AI suggestions. They are **model outputs, NOT ground-truth dataset labels**. Removing this runtime fixture would prevent faithful reproduction of the assisted condition. The **unmerged live Cloudflare redesign (PR #9)** was **not** the source of the historical human-trial responses and is intentionally not included in this snapshot.

## Run AI inference with no evaluation labels

Requires Python 3 and a Cloudflare account/token authorized to call Workers AI:

```bash
pip install -r inference/requirements.txt
export CLOUDFLARE_ACCOUNT_ID=...  # your own account ID
export CLOUDFLARE_API_TOKEN=...   # set privately; never commit
python inference/run_unlabelled_200.py --limit 5
python inference/run_unlabelled_200.py --limit 200
```

This reads **only** the unlabelled input CSV and writes prediction outputs in `output/cloudflare_predictions.jsonl`. Results are checkpointed by trial ID. The original `inference/run_cloudflare.py` and `inference/source_dataset.py` are retained for historical replication of how the 200-item fixed seed was originally sampled and validated; those reference-data scripts may read upstream source labels during dataset construction but **do not transmit reference labels to the AI API**. Prefer the label-blind runner above for inference evaluation.

The image binaries are **not included**; input rows contain publicly hosted Hugging Face `image_url` values that the runners retrieve when needed. Internet access and compliance with source dataset terms are required.

## Run the human task-trial app

```bash
cd task_trials
npm install
npm run dev
```

For production deployment, see `task_trials/README.md` and `task_trials/.env.example`; set Supabase secret values **server-side only**, initialize `task_trials/supabase/schema.sql`, and deploy the Netlify project from the `task_trials` directory. The independent and assisted conditions are exposed at their respective routes. **Never put private service-role keys in frontend builds.**

Original study versions varied during collection; this source reflects the **current main-branch v6.x code**, rather than every prior historical revision. For older exact interface versions, consult repository commit history. The 146 observed-item subset reflects the corrected export, not previous datasets.

## Privacy and provenance

- **Not in this package:** ground-truth labels, raw event export, personal uniqnames, API tokens, Supabase service keys, and identifiable participant feedback.
- **Included:** public meme input records and one archival runtime fixture containing generated AI assessments. The responses themselves belong in restricted research storage; the corrected deidentified research-data/reproducibility package can be distributed separately as appropriate.
- Source: `https://github.com/rudrajyotiroy/hai-task-trial`, main branch as of package construction.
- Original image records: `https://huggingface.co/datasets/limjiayi/hateful_memes_expanded`.
