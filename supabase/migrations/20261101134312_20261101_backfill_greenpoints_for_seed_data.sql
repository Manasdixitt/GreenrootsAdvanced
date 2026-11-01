/*
# Backfill GreenPoints for seed/dummy tree data

## What this does
The 50 dummy trees and 30 growth updates were inserted via SQL directly,
bypassing the process-registration and process-update edge functions.
This means greenpoints_balances, greenpoints_transactions, and achievements
only contain data for the 1 real user who registered through the website.
This migration backfills GreenPoints for all existing dummy planters using
the same point logic as the edge functions:

- 100 points per tree registration
- 25 points per growth update
- +200 bonus at 5 trees (Nature Guardian milestone)
- +500 bonus at 10 trees (Forest Builder milestone)
- +50 bonus at 3 updates on a single tree
- +100 bonus at 6 updates on a single tree
- Achievements: first_seed (1+ trees), nature_guardian (5+ trees),
  forest_builder (10+ trees), growth_champion (6+ updates on one tree),
  greenroots_hero (1000+ total points)

The existing real user (dixit.manas22@gmail.com) is preserved.
All point awards use idempotent event_id patterns so re-running is safe.
No emails are sent — this is a data-only backfill.
*/

-- Step 1: Backfill tree registration transactions (100 pts each) for dummy users
INSERT INTO greenpoints_transactions (event_id, email_key, points, reason, tree_id, created_at)
SELECT
  'registration_' || t.id,
  lower(trim(t.planter_email)),
  100,
  'tree_registration',
  t.id,
  t.created_at
FROM trees t
WHERE t.planter_email IS NOT NULL
  AND lower(trim(t.planter_email)) NOT IN (SELECT email_key FROM greenpoints_balances)
ON CONFLICT (event_id) DO NOTHING;

-- Step 2: Backfill growth update transactions (25 pts each) for dummy users
INSERT INTO greenpoints_transactions (event_id, email_key, points, reason, tree_id, created_at)
SELECT
  'update_' || tu.id,
  lower(trim(t.planter_email)),
  25,
  'growth_update',
  t.id,
  tu.created_at
FROM tree_updates tu
JOIN trees t ON tu.tree_id = t.id
WHERE t.planter_email IS NOT NULL
  AND lower(trim(t.planter_email)) NOT IN (SELECT email_key FROM greenpoints_balances)
ON CONFLICT (event_id) DO NOTHING;

-- Step 3: Award milestone bonuses for dummy users

-- 5 trees bonus (200 pts) — Nature Guardian
INSERT INTO greenpoints_transactions (event_id, email_key, points, reason, tree_id, created_at)
SELECT
  'milestone_5_' || lower(trim(email)),
  lower(trim(email)),
  200,
  'milestone_5_trees',
  NULL,
  now()
FROM (
  SELECT planter_email as email
  FROM trees
  WHERE planter_email IS NOT NULL
    AND lower(trim(planter_email)) NOT IN (SELECT email_key FROM greenpoints_balances)
  GROUP BY planter_email
  HAVING count(*) >= 5
) milestones
ON CONFLICT (event_id) DO NOTHING;

-- 10 trees bonus (500 pts) — Forest Builder
INSERT INTO greenpoints_transactions (event_id, email_key, points, reason, tree_id, created_at)
SELECT
  'milestone_10_' || lower(trim(email)),
  lower(trim(email)),
  500,
  'milestone_10_trees',
  NULL,
  now()
FROM (
  SELECT planter_email as email
  FROM trees
  WHERE planter_email IS NOT NULL
    AND lower(trim(planter_email)) NOT IN (SELECT email_key FROM greenpoints_balances)
  GROUP BY planter_email
  HAVING count(*) >= 10
) milestones
ON CONFLICT (event_id) DO NOTHING;

-- 3 updates on a single tree bonus (50 pts)
INSERT INTO greenpoints_transactions (event_id, email_key, points, reason, tree_id, created_at)
SELECT
  'milestone_3_updates_' || tree_id,
  lower(trim(planter_email)),
  50,
  'milestone_3_updates',
  tree_id,
  now()
FROM (
  SELECT t.planter_email, tu.tree_id
  FROM tree_updates tu
  JOIN trees t ON tu.tree_id = t.id
  WHERE t.planter_email IS NOT NULL
    AND lower(trim(t.planter_email)) NOT IN (SELECT email_key FROM greenpoints_balances)
  GROUP BY t.planter_email, tu.tree_id
  HAVING count(*) >= 3
) milestones
ON CONFLICT (event_id) DO NOTHING;

-- 6 updates on a single tree bonus (100 pts) — Growth Champion
INSERT INTO greenpoints_transactions (event_id, email_key, points, reason, tree_id, created_at)
SELECT
  'milestone_6_updates_' || tree_id,
  lower(trim(planter_email)),
  100,
  'milestone_6_updates',
  tree_id,
  now()
FROM (
  SELECT t.planter_email, tu.tree_id
  FROM tree_updates tu
  JOIN trees t ON tu.tree_id = t.id
  WHERE t.planter_email IS NOT NULL
    AND lower(trim(t.planter_email)) NOT IN (SELECT email_key FROM greenpoints_balances)
  GROUP BY t.planter_email, tu.tree_id
  HAVING count(*) >= 6
) milestones
ON CONFLICT (event_id) DO NOTHING;

-- Step 4: Rebuild greenpoints_balances for dummy users from transactions
INSERT INTO greenpoints_balances (email_key, total_points, trees_count, updates_count, created_at, updated_at)
SELECT
  gt.email_key,
  sum(gt.points),
  count(DISTINCT CASE WHEN gt.reason = 'tree_registration' THEN gt.tree_id END),
  count(DISTINCT CASE WHEN gt.reason = 'growth_update' THEN gt.tree_id END),
  now(),
  now()
FROM greenpoints_transactions gt
WHERE gt.email_key NOT IN (SELECT email_key FROM greenpoints_balances)
GROUP BY gt.email_key;

-- Fix updates_count: should count actual update transactions
UPDATE greenpoints_balances
SET updates_count = sub.updates_count,
    total_points = sub.total_points,
    trees_count = sub.trees_count,
    updated_at = now()
FROM (
  SELECT
    email_key,
    sum(points) as total_points,
    count(DISTINCT CASE WHEN reason = 'tree_registration' THEN tree_id END) as trees_count,
    count(*) as updates_count
  FROM greenpoints_transactions
  WHERE reason IN ('growth_update', 'milestone_3_updates', 'milestone_6_updates')
  GROUP BY email_key
) sub
WHERE greenpoints_balances.email_key = sub.email_key
  AND greenpoints_balances.email_key != 'dixit.manas22@gmail.com';

-- Actually, updates_count should count growth_update transactions only
UPDATE greenpoints_balances
SET updates_count = (
  SELECT count(*)
  FROM greenpoints_transactions gt
  WHERE gt.email_key = greenpoints_balances.email_key
    AND gt.reason = 'growth_update'
),
total_points = (
  SELECT sum(points)
  FROM greenpoints_transactions gt
  WHERE gt.email_key = greenpoints_balances.email_key
),
trees_count = (
  SELECT count(DISTINCT tree_id)
  FROM greenpoints_transactions gt
  WHERE gt.email_key = greenpoints_balances.email_key
    AND gt.reason = 'tree_registration'
),
updated_at = now()
WHERE email_key != 'dixit.manas22@gmail.com';

-- Step 5: Award achievements for dummy users

-- first_seed: 1+ trees
INSERT INTO achievements (email_key, achievement_key, unlocked_at)
SELECT DISTINCT lower(trim(t.planter_email)), 'first_seed', now()
FROM trees t
WHERE t.planter_email IS NOT NULL
  AND lower(trim(t.planter_email)) NOT IN (
    SELECT email_key FROM achievements WHERE achievement_key = 'first_seed'
  )
ON CONFLICT DO NOTHING;

-- nature_guardian: 5+ trees
INSERT INTO achievements (email_key, achievement_key, unlocked_at)
SELECT lower(trim(email)), 'nature_guardian', now()
FROM (
  SELECT planter_email as email
  FROM trees
  WHERE planter_email IS NOT NULL
  GROUP BY planter_email
  HAVING count(*) >= 5
) m
WHERE lower(trim(email)) NOT IN (
  SELECT email_key FROM achievements WHERE achievement_key = 'nature_guardian'
)
ON CONFLICT DO NOTHING;

-- forest_builder: 10+ trees
INSERT INTO achievements (email_key, achievement_key, unlocked_at)
SELECT lower(trim(email)), 'forest_builder', now()
FROM (
  SELECT planter_email as email
  FROM trees
  WHERE planter_email IS NOT NULL
  GROUP BY planter_email
  HAVING count(*) >= 10
) m
WHERE lower(trim(email)) NOT IN (
  SELECT email_key FROM achievements WHERE achievement_key = 'forest_builder'
)
ON CONFLICT DO NOTHING;

-- growth_champion: 6+ updates on a single tree
INSERT INTO achievements (email_key, achievement_key, unlocked_at)
SELECT DISTINCT lower(trim(t.planter_email)), 'growth_champion', now()
FROM tree_updates tu
JOIN trees t ON tu.tree_id = t.id
WHERE t.planter_email IS NOT NULL
GROUP BY t.planter_email, tu.tree_id
HAVING count(*) >= 6
ON CONFLICT DO NOTHING;

-- greenroots_hero: 1000+ total points
INSERT INTO achievements (email_key, achievement_key, unlocked_at)
SELECT email_key, 'greenroots_hero', now()
FROM greenpoints_balances
WHERE total_points >= 1000
  AND email_key NOT IN (
    SELECT email_key FROM achievements WHERE achievement_key = 'greenroots_hero'
  )
ON CONFLICT DO NOTHING;
