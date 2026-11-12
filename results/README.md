# Public study analysis files (pseudonymized)

**Source:** original Supabase CSV export \`task_trial_events_rows.csv\` from 12 November 2026. It contains identifying uniqnames and is **not** included in GitHub.

## Files
- \`merged_deidentified_trials.csv\` — one row per study response after grouping by session attempt and item, retaining the earliest event for repeated items. 179 rows across 21 attempts. Joins \`trial_id\` to the original balanced 200-item Assignment 2 reference labels, the archived AI hateful classification and AI potential-trigger flag.
- \`paired_participant_comparison.csv\` — summary table for the five uniqnames that occurred in both conditions (pseudonyms \`P01\`–\`P05\`).
- \`reproduce.py\` — lightweight replication of key descriptive metrics, matched-person sign test, and AI review exact McNemar test.
- \`report.md\` — narrative summary with research conclusions, limitations, and protocol improvements.

## Sensitive data handling
The CSVs contain **no uniqnames, personal names, real UUIDs, raw free text, or exact timestamps**. \`participant_id\` = arbitrary Pxx for named matching or Uxx for an unidentified session. \`session_id_public\` = arbitrary Sxx by chronological session order. These are **pseudonyms, not mathematically anonymous IDs**; do not link them to identifiable external records. No raw input file is committed.

## Selected trial columns

| Field | Meaning |
|---|---|
| \`participant_id\` | Pxx = matched name-derived pseudonym; Uxx = unknown session |
| \`session_id_public\` | Stable *public alias* of a session attempt; a historical restart could generate more than one attempt per original session ID |
| \`condition\` | \`assisted\` or \`independent\` |
| \`version\` | Study interface version from session start, e.g. 2.0.0 / 3.1.0 / 3.3.0 |
| \`trial_id\` | ID \`A2_001\`–\`A2_200\` of the original reference meme |
| \`skipped\` | Whether the entire item was skipped; skipped rows must not enter accuracy / triggering denominators |
| \`classification_initial\` | First binary human classification, 1 hateful / 0 not hateful / blank if skipped or unavailable |
| \`classification_final\` | Human classification after any AI review, or unchanged from initial |
| \`confidence\` | Subjective confidence, 1–5; blank for skipped |
| \`triggering_vote\` | 1 respondent felt triggering / 0 not triggering / blank when unasked/skipped |
| \`preferred_not_shown\` | 1 respondent preferred not to view / 0 comfortable viewing / blank when unasked/skipped |
| \`preferred_not_shown_reason\` | \`imagery\`, \`text\`, \`both\` or blank |
| \`ai_review_shown\` | Whether the participant viewed AI explanation after a first-label disagreement |
| \`ai_review_verdict\` | \`ai_correct_changed\`, \`ai_wrong_kept\` or blank |
| \`changed_after_ai\` | Boolean whether AI explanation led to a changed binary label |
| \`image_initially_blurred\` | Whether the image was blurred at initial presentation |
| \`image_revealed\` | Whether original image was voluntarily revealed |
| \`caption_revealed\` | Whether original caption was voluntarily revealed |
| \`elapsed_s\` | Duration from sample opening to saved trial response in seconds; not a total session time |
| \`truth\` | Original dataset hateful ground truth |
| \`ai_classification\` | Archived model hateful prediction |
| \`ai_flag\` | Archived model potential distress flag |
| \`ai_confidence\` | Archived model self-assessed confidence; **not calibrated** |
| \`correct_initial\`, \`correct_final\` | Human classification equals reference label; blank when no classification |
| \`matched_participant\` | Named matched person in both conditions, even if item overlap absent |
| \`response_schema\` | \`v2-legacy\` or \`v3+\` initial/final labels schema |

## Validity caveats
Only five named people can be linked across conditions. All other sessions are kept independent; do not deduce identity from time, pattern, or device characteristics. Trial samples were historically randomized separately per condition; only five **same-person, same-item** rated pairs exist. Current study UI v4 will intentionally give named participants the same randomly selected items when counts match, but these prospective responses are not in this historical export.

At least 5 *valid completed participants* are requested **per condition** by Assignment 3. This dataset has 8 assisted and 3 independent attempts with finish events; follow up with more data collection if needed.
