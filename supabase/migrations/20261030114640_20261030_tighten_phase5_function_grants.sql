/*
# Tighten Phase 5 SECURITY DEFINER function execution grants

## Problem
The security advisor flagged that 5 SECURITY DEFINER functions are still executable
by the `authenticated` role. While this is a no-auth app (frontend uses only the anon key),
defense in depth requires revoking from authenticated too — only service_role should call these.

## Changes
- REVOKE EXECUTE on all 5 SECURITY DEFINER functions FROM authenticated
- GRANT EXECUTE only TO service_role
- No table or policy changes — only function execution grants
*/

REVOKE EXECUTE ON FUNCTION award_greenpoints(text, integer, text, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION award_greenpoints(text, integer, text, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION award_achievement(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION award_achievement(text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION log_email(text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION log_email(text, text, text, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION update_balance_counts(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION update_balance_counts(text) TO service_role;

REVOKE EXECUTE ON FUNCTION generate_due_reminders() FROM authenticated;
GRANT EXECUTE ON FUNCTION generate_due_reminders() TO service_role;
