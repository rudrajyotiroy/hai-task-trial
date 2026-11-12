# CSE 594 Assignment 3 — Human Study Results and Reflections

**Data cutoff:** 12 November 2026. **Study:** hateful meme classification with optional AI trigger shielding and post-answer AI explanations. This Markdown report accompanies the longer editable DOCX/PDF generated for course submission.

## Collection and provenance
- Source: an exported Supabase \`task_trial_events\` table, **211 events**: 21 starts, 179 responses, 11 finishes.
- **21 session attempts** from 20 session identifiers; 10 of those attempts had voluntarily provided uniqnames, corresponding to **five distinct named participants who used both study conditions**. Eleven attempts have no name, so they are not linked across conditions.
- 94 assisted example responses and 85 independent example responses; **82** and **68** carried an initial binary hateful/not-hateful judgment, respectively. Remaining items were skipped or historically unrated.
- The export mixes v2.0, v3.1 and v3.3 interfaces. Do not fill missing questionnaire fields with false/zero.
- Each meme is joined on \`trial_id\` to the original 200-item Assignment 2 benchmark (100 hateful, 100 nonhateful), archived AI predictions and sensitivity flags. The source AI was **Gemma 4 26B A4B via Cloudflare**. This analysis did not call a live model.
- Some sessions ended without a finish event: an absent finish should not be treated as a proof of participant dropout versus page closure. Only **3 independent attempts and 8 assisted attempts** included a finish record; the assignment's target of ≥5 *completed* participants per arm is **not yet demonstrated by the independent finish count**.

## Main outcomes

| Measure | Assisted | Independent |
|---|---:|---:|
| Total item response events | 94 | 85 |
| Rated initial decisions | 82 | 68 |
| Entire-item skips | 12 (12.8%) | 17 (20.0%) |
| Initial accuracy vs reference | **58/82 (70.7%)** | **40/68 (58.8%)** |
| Final accuracy after any AI review | 60/82 (73.2%) | 40/68 (58.8%) |
| Reported triggering | 12/69 (17.4%) | 9/68 (13.2%) |
| Median seconds per item | 20.0 | 18.5 |
| Mean confidence (1–5) | 3.76 | 3.78 |

**Causal caution:** The +11.9-point initial raw accuracy difference cannot be attributed to AI assistance. Participants saw overlapping but largely different sets of random memes, responses within participants are correlated, and the protocol evolved during collection. The AI-only benchmark was 126/200 (63.0%) accurate, with hateful recall of only 39% and nonhateful specificity of 87%.

## Within-participant matching
The five participants who entered the same uniqname in both conditions were matched at the **participant level only**. Their average **assisted minus independent** initial accuracy difference was **+9.7 percentage points** (5 paired people; paired bootstrap 95% interval **−6.7 to +28.0 points**; exact two-sided sign test **p = 1.00**). Results do **not establish** an improvement.

In these matched participants, there were 53 assisted responses (53 rated) and 49 independent responses (47 rated). However, the same person rated the **same meme** in both conditions only **five times**, across two participants. This is insufficient for a robust within-item comparison. The prospective protocol now selects the same randomized sample for participants who supply the same uniqname in both routes.

## AI explanation review
There were 23 assisted AI-disagreement screens. **8/23** participants switched to the model's label; **15/23** retained their original judgment. Among reviewed items, accuracy moved from **9/23 (39.1%)** before reasoning to **11/23 (47.8%)** after reasoning; five initially wrong answers became correct, while three initially correct answers became wrong. Exact McNemar **p = 0.727**. AI reasoning can help and hurt; initial and final answers must be retained separately. This is a *within-reviewed-item before/after* contrast, not randomized proof of the explanation's effect.

## Triggering experience, shielding and preference
- Archived AI flagged 89/200 items as potentially sensitive (44.5%). Participants reported triggering in 21/137 fully rated, trigger-answered exposures (15.3%).
- Of the 69 assisted trigger-voted samples, **12/32 (37.5%) flagged** samples elicited a triggering vote versus **0/37 (0%) unflagged** samples. The independent counts were **8/24 (33.3%)** flagged and **1/44 (2.3%)** unflagged. These do not establish a universal sensitivity/specificity for trigger detection.
- Assisted exposures: 46/94 were initially shielded; 37 of those images were voluntarily revealed and four captions were revealed. User decisions to reveal content complicate analysis of shielding efficacy.
- The historical independent condition elicited **7/68 (10.3%)** 'prefer not shown' answers; **five** blamed text, **two** imagery, **none** both. This field was not present in the old assisted protocol. Consequently historical cross-arm avoidance preference is **not measurable**.

## Further comparisons
- Correctness by reference label: **assisted** hateful 58.1%, nonhateful 78.4%; **independent** hateful 50.0%, nonhateful 66.7%. Hidden or contextual hate remains more difficult than identifying benign items.
- Median item time: assisted 19.95 s, independent 18.50 s; paired-person mean of median differences **+6.29 s** (bootstrap interval −3.11 to +18.40 s). Not reliably different.
- Paired-person mean confidence difference: **+0.13** on a five-point scale (interval −0.22 to +0.55). Again inconclusive.
- Among five paired people, mean trigger-vote rate difference was +10.7 points (paired exact sign test p = 0.125). Differences could reflect item mix and the visibility/salience of warnings.
- AI-flagged prevalence differed in the actual item sets: 48.9% of assisted exposures vs 34.1% of independent exposures. Reference hateful prevalence was 42.6% vs 45.9%. These mix differences matter.
- Later responses were often faster than the first four, consistent with practice, fatigue, or selection. Do not interpret as evidence of any one cause.
- Confidence and accuracy were positively associated in this sample, but confidence was subjective and not a calibrated probability.
- There were 119 different memes presented and 104 different memes rated. Sparse per-meme repeats limit item-level comparisons.

## Reflection on Assignment 2 predictions
Assignment 2 expected humans to outperform the AI-only baseline, with combined assistance improving mainly the reviewer experience rather than strongly boosting hateful classification. Initial assisted accuracy (70.7%) exceeds the historical AI benchmark (63.0%) descriptively, while independent accuracy (58.8%) does not. These are **not controlled comparisons**; the 200-item AI benchmark and the observed, selected human trial subsets differ. The user-experience hypothesis remains unproven because historical avoidance preference was recorded only for independent participants.

The model's weakest point, hateful recall, is plausibly linked to ambiguity and contextual sarcasm, though the sample is too small to attribute exact error mechanisms. Five switches toward the model fixed errors and three caused errors: human oversight of AI explanations remains crucial.

## Limitations and updated protocol
Five paired individuals are a very small sample; anonymized sessions cannot safely be merged. Self-reported triggering is subjective and is not universal ground truth. Version drift, changing survey questions, nonidentical meme samples, response censoring from skips and absent finish records all constrain inference.

**Prospective protocol (not retroactive):** PR updates both routes to include a gentle attention check, 1–12 randomly drawn memes (default 12; intended completion under ten minutes), a five-point hateful-intensity Likert response (1–2 nonhateful, 3 unsure/no binary label, 4–5 hateful), triggering and avoid-view questions in both arms, and a reason for avoid-view preference. The independent site remains unfiltered; assisted filtering and archived AI disagreement review remain. All skip responses set judgment fields to null. Named participants receive the same sampled memes across both URLs. This change adds a new version identifier, and must be kept separate from the 12-Nov historical results.

## Privacy and reproducibility
**Never commit the raw Supabase export**. It contains volunteered uniqnames and other session details. \`merged_deidentified_trials.csv\` removes names, original UUIDs, exact event timestamps, and free-text responses and uses arbitrary Pxx / Uxx / Sxx aliases. These outputs are **pseudonymized**, not guaranteed anonymous. Do not attempt to reidentify participants. The GitHub PR includes \`results/reproduce.py\` and paired summary data to reproduce major descriptive and exact matched-person tests. For full charts, statistics and interpretation, use the accompanying editable DOCX/PDF report.

## Course submission requirements
The assignment asks for two live interface links, report with hypotheses and results, collected data, code, attention check, and ≥5 valid completed participants **per condition**. Supply actual Netlify links for \`/assisted/\` and \`/independent/\` in the course submission, rather than guessing the domain. Do not claim the attendance, questionnaire, or completion quota was satisfied unless separately verified.
