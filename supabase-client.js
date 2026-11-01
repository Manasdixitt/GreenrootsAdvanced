/*
  GreenRoots — Supabase Client (single shared instance)
  Uses the public anon key only — never the service-role key.
  This is a no-auth public website, so the anon key is safe to expose
  in browser-side code. RLS policies enforce what the public can do.
*/

window.SUPABASE_URL = "https://uwjkmtmprmblbhkwrdqe.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3amttdG1wcm1ibGJoa3dyZHFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNjE1OTcsImV4cCI6MjEwNTgzNzU5N30.U6SjePx1xHJ8gnXt3uuXc5grWBE9t0FN5b2Sw2LItDY";

var _supabaseClient = null;

window.getSupabaseClient = async function () {
  if (_supabaseClient) return _supabaseClient;

  var mod = await import(
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
  );

  _supabaseClient = mod.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false
    }
  });

  return _supabaseClient;
};
