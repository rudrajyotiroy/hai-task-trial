# Study app runtime AI fixture

This `trials.json` is the **exact application-side input fixture** used by the
archival assisted task-trial code. The fields beginning with `ai_` are
**precomputed model predictions, explanations and screening advice** (not
reference/ground-truth labels). Original ground truth is intentionally absent.

For an entirely unlabelled participant input manifest, use
`../datasets/unlabelled_task_trials_all_200.csv` from the package root.
