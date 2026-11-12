#!/usr/bin/env python3
"""Reproduce descriptive and paired analyses from public de-identified CSE594 data.

Usage: python results/reproduce.py
Install: pip install pandas scipy numpy
This public script intentionally never accesses uniqnames, UUIDs, timestamps or comments.
The data joined on trial_id already include original Assignment 2 reference labels.
"""
from pathlib import Path
import pandas as pd
import numpy as np
from scipy.stats import binomtest
P=Path(__file__).resolve().parent
d=pd.read_csv(P/'merged_deidentified_trials.csv')
for col in ['skipped','correct_initial','correct_final','ai_review_shown','changed_after_ai','matched_participant']:
 d[col]=d[col].astype('boolean')
r=d[d['classification_initial'].notna()].copy()
for condition in ['assisted','independent']:
 a=d[d.condition==condition]; b=r[r.condition==condition]
 t=a[a.triggering_vote.notna()]
 print(condition, 'exposures',len(a),'rated',len(b),'skipped',int(a.skipped.sum()),
       'initial_accuracy',round(b.correct_initial.mean(),3),'trigger_yes',int((t.triggering_vote==1).sum()),
       'trigger_votes',len(t),'median_time_s',round(a.elapsed_s.median(),2))
participants=pd.read_csv(P/'paired_participant_comparison.csv')
difference=participants.assisted_minus_independent_accuracy.dropna()
positive=int((difference>0).sum());negative=int((difference<0).sum())
print('named_matched_people',len(difference),'paired_mean_accuracy_difference',round(difference.mean(),4),
      'exact_sign_p',binomtest(positive,positive+negative).pvalue if positive+negative else 1.)
reviews=d[(d.condition=='assisted')&(d.ai_review_shown==True)]
print('AI_disagreement_reviews',len(reviews),'changed',int(reviews.changed_after_ai.sum()),
      'initial_correct',int(reviews.correct_initial.sum()),'final_correct',int(reviews.correct_final.sum()))
loss=int(((reviews.correct_initial==True)&(reviews.correct_final==False)).sum())
gain=int(((reviews.correct_initial==False)&(reviews.correct_final==True)).sum())
print('review_correct_to_wrong',loss,'wrong_to_correct',gain,
      'exact_McNemar_p',binomtest(min(loss,gain),loss+gain).pvalue if loss+gain else 1.)
print('CAVEAT: 5 matched uniqnames, mostly different items per condition, historical protocol drift.')
