// GreenRoots process-reminders edge function
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 1. Generate due reminders (idempotent — safe to call repeatedly)
    const { error: genError } = await supabase.rpc("generate_due_reminders");
    if (genError) console.error("generate_due_reminders error:", genError);

    // 2. Fetch pending reminders with tree details
    const { data: reminders, error: remError } = await supabase
      .from("update_reminders")
      .select(`
        id,
        tree_id,
        reminder_cycle,
        status,
        trees (
          id,
          tree_uid,
          tree_type,
          planter_name,
          planter_email,
          planting_date,
          location_name
        )
      `)
      .eq("status", "pending")
      .limit(50);

    if (remError) {
      console.error("Failed to fetch reminders:", remError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch reminders" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No pending reminders" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sentCount = 0;
    const trackUrl = `https://uwjkmtmprmblbhkwrdqe.supabase.co/track.html`;

    for (const reminder of reminders) {
      const tree = reminder.trees as Record<string, unknown> | null;
      if (!tree || !tree.planter_email) continue;

      const email = tree.planter_email as string;
      const treeType = (tree.tree_type as string) || "your tree";
      const treeUid = (tree.tree_uid as string) || "";
      const planterName = (tree.planter_name as string) || "Planter";

      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
          body: JSON.stringify({
            to: email,
            subject: "Time to Update Your Tree! 🌿",
            html: `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fff8;border-radius:12px;overflow:hidden;border:1px solid #c8e6c9;">
              <div style="background:linear-gradient(135deg,#2e7d32,#43a047);padding:32px 24px;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:28px;">🌳 GreenRoots</h1>
                <p style="color:#e8f5e9;margin:8px 0 0;font-size:16px;">Restoring Nature, One Tree at a Time</p>
              </div>
              <div style="padding:32px 24px;color:#333;line-height:1.6;">
                <h2 style="color:#2e7d32;margin-top:0;">Your Tree Is Due for an Update</h2>
                <p>Hi ${planterName},</p>
                <p>It's time to share a growth update for your <strong>${treeType}</strong> (UID: ${treeUid}).</p>
                <p>Regular updates help GreenRoots track the health and growth of trees across our community.</p>
                <p>Here's what you'll need:</p>
                <ul>
                  <li>A current photo of your tree</li>
                  <li>Current height (if measurable)</li>
                  <li>Growth stage and health status</li>
                </ul>
                <a href="${trackUrl}" style="display:inline-block;background:#43a047;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;margin:16px 0;">🌿 Submit Update Now</a>
              </div>
              <div style="padding:24px;text-align:center;color:#666;font-size:14px;border-top:1px solid #e0e0e0;">
                <p>GreenRoots — Restoring Nature, One Tree at a Time</p>
              </div>
            </div>`,
            template: "reminder",
          }),
        });

        if (response.ok) {
          sentCount++;
        }

        // Mark as sent regardless (even if email service is down, we don't want to spam retries within the same cycle)
        await supabase
          .from("update_reminders")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", reminder.id);
      } catch (err) {
        console.error(`Failed to send reminder for tree ${reminder.tree_id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: reminders.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("process-reminders error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
