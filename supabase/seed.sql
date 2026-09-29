-- TwinOS v2 · seed: Decision DNA question bank (plan §9.3, §11.5)
-- Each option nudges traits by a signed weight in [-1, 1]; scoring lives in src/lib/training/score.ts.
-- 5 questions are `is_retest`: re-asked later to measure the user's own consistency (Self-Consistency Ceiling).
-- Idempotent: safe to run repeatedly.

insert into public.training_questions (slug, question, category, is_retest, sort_order, options) values
('job-offer', 'Two job offers land at once: a steady corporate role, or a startup paying 20% less with equity. You pick…', 'career', true, 1,
 '[{"id":"steady","label":"The steady role","weights":{"risk_tolerance":-0.8,"opportunity_over_stability":-0.8}},
   {"id":"startup","label":"The startup","weights":{"risk_tolerance":0.8,"opportunity_over_stability":0.9}}]'),

('windfall', 'You get an unexpected $2,000. Most of it goes to…', 'money', true, 2,
 '[{"id":"save","label":"Savings","weights":{"frugality":0.9,"long_term_focus":0.6}},
   {"id":"course","label":"A course or skill","weights":{"long_term_focus":0.8,"opportunity_over_stability":0.4}},
   {"id":"treat","label":"Treating myself","weights":{"frugality":-0.8,"long_term_focus":-0.4}}]'),

('big-purchase', 'Before a big purchase you usually…', 'money', false, 3,
 '[{"id":"research","label":"Research for days","weights":{"gut_over_analysis":-0.9}},
   {"id":"feel","label":"Go with what feels right","weights":{"gut_over_analysis":0.9}},
   {"id":"ask","label":"Ask friends what they would do","weights":{"social_influence":0.8,"independence":-0.6}}]'),

('deadline', 'A deadline is two weeks away. Honestly, you usually…', 'learning', true, 4,
 '[{"id":"today","label":"Start today","weights":{"procrastination":-0.9}},
   {"id":"midway","label":"Plan, then start about halfway","weights":{"procrastination":0.1}},
   {"id":"rush","label":"Rush it near the end","weights":{"procrastination":0.9}}]'),

('friends-pick', 'All your friends push a plan you''re unsure about. You…', 'relationships', false, 5,
 '[{"id":"along","label":"Go along with it","weights":{"social_influence":0.8,"independence":-0.4}},
   {"id":"own","label":"Suggest your own plan","weights":{"independence":0.7,"social_influence":-0.5}}]'),

('move-city', 'You''re offered a better role — in a city where you know nobody. You…', 'lifestyle', true, 6,
 '[{"id":"move","label":"Move","weights":{"risk_tolerance":0.7,"opportunity_over_stability":0.8}},
   {"id":"stay","label":"Stay near your people","weights":{"opportunity_over_stability":-0.6,"social_influence":0.3}}]'),

('health-routine', 'A new routine would pay off in five years but costs an hour a day now. You…', 'health', false, 7,
 '[{"id":"now","label":"Start this week","weights":{"long_term_focus":0.9,"procrastination":-0.4}},
   {"id":"later","label":"Start when life is less busy","weights":{"long_term_focus":-0.5,"procrastination":0.6}}]'),

('gut-call', 'A deal looks great on paper, but your gut says no. You…', 'career', true, 8,
 '[{"id":"gut","label":"Trust your gut","weights":{"gut_over_analysis":0.9}},
   {"id":"numbers","label":"Trust the numbers","weights":{"gut_over_analysis":-0.9}}]'),

('free-weekend', 'A completely free weekend. You''d rather…', 'lifestyle', false, 9,
 '[{"id":"project","label":"Start a risky side project","weights":{"risk_tolerance":0.6,"independence":0.5}},
   {"id":"rest","label":"Rest and recharge","weights":{"risk_tolerance":-0.3,"long_term_focus":0.2}},
   {"id":"friends","label":"Say yes to whatever friends plan","weights":{"social_influence":0.6}}]'),

('manager-path', 'Your manager suggests a career path you''re lukewarm about. You…', 'career', false, 10,
 '[{"id":"follow","label":"Follow their advice","weights":{"social_influence":0.6,"independence":-0.7}},
   {"id":"carve","label":"Carve your own path","weights":{"independence":0.9}}]'),

('subscription', 'For something you use daily: pay yearly (cheaper) or monthly (flexible)?', 'money', false, 11,
 '[{"id":"yearly","label":"Yearly","weights":{"frugality":0.7,"long_term_focus":0.5}},
   {"id":"monthly","label":"Monthly","weights":{"frugality":-0.3,"opportunity_over_stability":0.3}}]'),

('skill-choice', 'Learn a skill that pays off now, or one you love that might pay off later?', 'learning', false, 12,
 '[{"id":"now","label":"Pays off now","weights":{"long_term_focus":-0.6,"opportunity_over_stability":-0.3}},
   {"id":"love","label":"The one I love","weights":{"long_term_focus":0.7,"opportunity_over_stability":0.5,"risk_tolerance":0.3}}]')

on conflict (slug) do update
  set question   = excluded.question,
      category   = excluded.category,
      is_retest  = excluded.is_retest,
      sort_order = excluded.sort_order,
      options    = excluded.options;
