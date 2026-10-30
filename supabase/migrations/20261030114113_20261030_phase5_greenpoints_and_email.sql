/*
# Phase 5: GreenPoints tables, secure functions, and email infrastructure

Creates GreenPoints balances, transaction ledger, achievements, email log, update reminders,
SECURITY DEFINER award functions, and a pg_cron scheduled job for due reminders.
All additive — no existing tables/columns/policies modified.
*/

-- ============================================================
-- 1. greenpoints_balances
-- ============================================================
CREATE TABLE IF NOT EXISTS greenpoints_balances (
    email_key text PRIMARY KEY,
    total_points integer NOT NULL DEFAULT 0,
    trees_count integer NOT NULL DEFAULT 0,
    updates_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE greenpoints_balances ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON greenpoints_balances TO anon, authenticated;
GRANT ALL ON greenpoints_balances TO service_role;

DROP POLICY IF EXISTS "anon_select_greenpoints_balances" ON greenpoints_balances;
CREATE POLICY "anon_select_greenpoints_balances" ON greenpoints_balances FOR SELECT
    TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_greenpoints_balances_total ON greenpoints_balances (total_points DESC);

-- ============================================================
-- 2. greenpoints_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS greenpoints_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id text NOT NULL UNIQUE,
    email_key text NOT NULL,
    points integer NOT NULL,
    reason text NOT NULL,
    tree_id uuid REFERENCES trees(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE greenpoints_transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON greenpoints_transactions TO anon, authenticated;
GRANT ALL ON greenpoints_transactions TO service_role;

DROP POLICY IF EXISTS "anon_select_greenpoints_transactions" ON greenpoints_transactions;
CREATE POLICY "anon_select_greenpoints_transactions" ON greenpoints_transactions FOR SELECT
    TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_greenpoints_transactions_email ON greenpoints_transactions (email_key);
CREATE INDEX IF NOT EXISTS idx_greenpoints_transactions_created ON greenpoints_transactions (created_at DESC);

-- ============================================================
-- 3. achievements
-- ============================================================
CREATE TABLE IF NOT EXISTS achievements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email_key text NOT NULL,
    achievement_key text NOT NULL,
    unlocked_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (email_key, achievement_key)
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON achievements TO anon, authenticated;
GRANT ALL ON achievements TO service_role;

DROP POLICY IF EXISTS "anon_select_achievements" ON achievements;
CREATE POLICY "anon_select_achievements" ON achievements FOR SELECT
    TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_achievements_email ON achievements (email_key);

-- ============================================================
-- 4. email_log
-- ============================================================
CREATE TABLE IF NOT EXISTS email_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient text NOT NULL,
    subject text NOT NULL,
    template text NOT NULL,
    status text NOT NULL DEFAULT 'queued',
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

GRANT ALL ON email_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log (status);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log (created_at DESC);

-- ============================================================
-- 5. update_reminders
-- ============================================================
CREATE TABLE IF NOT EXISTS update_reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tree_id uuid NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
    reminder_cycle text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    UNIQUE (tree_id, reminder_cycle)
);

ALTER TABLE update_reminders ENABLE ROW LEVEL SECURITY;

GRANT ALL ON update_reminders TO service_role;

CREATE INDEX IF NOT EXISTS idx_update_reminders_status ON update_reminders (status);
CREATE INDEX IF NOT EXISTS idx_update_reminders_tree ON update_reminders (tree_id);

-- ============================================================
-- 6. Secure function: award_greenpoints
-- ============================================================
CREATE OR REPLACE FUNCTION award_greenpoints(
    p_email text,
    p_points integer,
    p_reason text,
    p_tree_id uuid DEFAULT NULL,
    p_event_id text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_email_key text;
    v_event_id text;
    v_inserted boolean;
    v_new_balance integer;
BEGIN
    v_email_key := lower(trim(p_email));
    IF v_email_key = '' THEN
        RAISE EXCEPTION 'Email is required for award_greenpoints';
    END IF;

    v_event_id := COALESCE(p_event_id, p_reason || '_' || v_email_key || '_' || COALESCE(p_tree_id::text, 'general'));

    INSERT INTO greenpoints_transactions (event_id, email_key, points, reason, tree_id)
    VALUES (v_event_id, v_email_key, p_points, p_reason, p_tree_id)
    ON CONFLICT (event_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    IF v_inserted THEN
        INSERT INTO greenpoints_balances (email_key, total_points, trees_count, updates_count)
        VALUES (v_email_key, p_points, 0, 0)
        ON CONFLICT (email_key) DO UPDATE
        SET total_points = greenpoints_balances.total_points + p_points,
            updated_at = now();

        SELECT total_points INTO v_new_balance
        FROM greenpoints_balances WHERE email_key = v_email_key;
        RETURN v_new_balance;
    ELSE
        SELECT total_points INTO v_new_balance
        FROM greenpoints_balances WHERE email_key = v_email_key;
        RETURN COALESCE(v_new_balance, 0);
    END IF;
END;
$func$;

REVOKE EXECUTE ON FUNCTION award_greenpoints(text, integer, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION award_greenpoints(text, integer, text, uuid, text) TO service_role;

-- ============================================================
-- 7. Secure function: award_achievement
-- ============================================================
CREATE OR REPLACE FUNCTION award_achievement(
    p_email text,
    p_achievement_key text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_email_key text;
    v_inserted boolean;
BEGIN
    v_email_key := lower(trim(p_email));
    IF v_email_key = '' OR p_achievement_key = '' THEN
        RETURN false;
    END IF;

    INSERT INTO achievements (email_key, achievement_key)
    VALUES (v_email_key, p_achievement_key)
    ON CONFLICT (email_key, achievement_key) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
END;
$func$;

REVOKE EXECUTE ON FUNCTION award_achievement(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION award_achievement(text, text) TO service_role;

-- ============================================================
-- 8. Secure function: log_email
-- ============================================================
CREATE OR REPLACE FUNCTION log_email(
    p_to text,
    p_subject text,
    p_template text,
    p_status text DEFAULT 'queued',
    p_error text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO email_log (recipient, subject, template, status, error_message, sent_at)
    VALUES (p_to, p_subject, p_template, p_status, p_error, CASE WHEN p_status = 'sent' THEN now() ELSE NULL END)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$func$;

REVOKE EXECUTE ON FUNCTION log_email(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION log_email(text, text, text, text, text) TO service_role;

-- ============================================================
-- 9. Secure function: update_balance_counts
-- ============================================================
CREATE OR REPLACE FUNCTION update_balance_counts(
    p_email text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_email_key text;
    v_tree_count integer;
    v_update_count integer;
BEGIN
    v_email_key := lower(trim(p_email));
    IF v_email_key = '' THEN RETURN; END IF;

    SELECT count(*) INTO v_tree_count
    FROM trees WHERE lower(trim(planter_email)) = v_email_key;

    SELECT count(*) INTO v_update_count
    FROM tree_updates tu
    JOIN trees t ON tu.tree_id = t.id
    WHERE lower(trim(t.planter_email)) = v_email_key;

    INSERT INTO greenpoints_balances (email_key, total_points, trees_count, updates_count)
    VALUES (v_email_key, 0, v_tree_count, v_update_count)
    ON CONFLICT (email_key) DO UPDATE
    SET trees_count = v_tree_count,
        updates_count = v_update_count,
        updated_at = now();
END;
$func$;

REVOKE EXECUTE ON FUNCTION update_balance_counts(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_balance_counts(text) TO service_role;

-- ============================================================
-- 10. Secure function: generate_due_reminders
-- ============================================================
CREATE OR REPLACE FUNCTION generate_due_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_count integer := 0;
    v_today date := CURRENT_DATE;
BEGIN
    INSERT INTO update_reminders (tree_id, reminder_cycle)
    SELECT t.id, 'initial_' || t.id::text
    FROM trees t
    WHERE NOT EXISTS (SELECT 1 FROM tree_updates tu WHERE tu.tree_id = t.id)
      AND t.planting_date + 30 <= v_today
      AND NOT EXISTS (
          SELECT 1 FROM update_reminders ur
          WHERE ur.tree_id = t.id AND ur.reminder_cycle = 'initial_' || t.id::text
      )
    ON CONFLICT (tree_id, reminder_cycle) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO update_reminders (tree_id, reminder_cycle)
    SELECT t.id, 'update_' || t.id::text || '_' || (last_upd.update_date + 90)::text
    FROM trees t
    JOIN LATERAL (
        SELECT MAX(update_date) AS update_date
        FROM tree_updates tu WHERE tu.tree_id = t.id
    ) last_upd ON true
    WHERE last_upd.update_date + 90 <= v_today
      AND NOT EXISTS (
          SELECT 1 FROM update_reminders ur
          WHERE ur.tree_id = t.id
            AND ur.reminder_cycle = 'update_' || t.id::text || '_' || (last_upd.update_date + 90)::text
      )
    ON CONFLICT (tree_id, reminder_cycle) DO NOTHING;

    RETURN v_count;
END;
$func$;

REVOKE EXECUTE ON FUNCTION generate_due_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_due_reminders() TO service_role;

-- ============================================================
-- 11. pg_cron schedule: daily at 9:00 AM UTC
-- ============================================================
DO $cron$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Only unschedule if the job already exists
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'greenroots-due-reminders') THEN
            PERFORM cron.unschedule('greenroots-due-reminders');
        END IF;
        PERFORM cron.schedule(
            'greenroots-due-reminders',
            '0 9 * * *',
            'SELECT generate_due_reminders();'
        );
    END IF;
END $cron$;
