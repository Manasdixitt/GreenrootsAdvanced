// GreenRoots process-update edge function
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

const POINTS_UPDATE = 25;
const POINTS_3_UPDATES_BONUS = 50;
const POINTS_6_UPDATES_BONUS = 100;
const SUBSEQUENT_UPDATE_DAYS = 90;

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split("-");
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { treeId, updateId, siteUrl } = await req.json();

    if (!treeId) {
      return new Response(
        JSON.stringify({ error: "Missing treeId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the tree
    const { data: tree, error: treeError } = await supabase
      .from("trees")
      .select("*")
      .eq("id", treeId)
      .maybeSingle();

    if (treeError || !tree) {
      console.error("Failed to fetch tree:", treeError);
      return new Response(
        JSON.stringify({ error: "Tree not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const email = tree.planter_email;
    if (!email) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No email on tree" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const eventId = `update_${updateId || treeId + "_" + todayStr()}`;

    // 1. Award 25 GreenPoints (idempotent)
    const { data: newBalance, error: awardError } = await supabase.rpc("award_greenpoints", {
      p_email: email,
      p_points: POINTS_UPDATE,
      p_reason: "growth_update",
      p_tree_id: tree.id,
      p_event_id: eventId,
    });
    if (awardError) console.error("Award error:", awardError);

    // 2. Update balance counts
    await supabase.rpc("update_balance_counts", { p_email: email });

    // 3. Count updates for this tree
    const { count: updateCount } = await supabase
      .from("tree_updates")
      .select("*", { count: "exact", head: true })
      .eq("tree_id", tree.id);

    let achievementUnlocked = false;
    let achievementName = "";
    let achievementIcon = "";
    let achievementDescription = "";

    // 3 updates milestone bonus
    if (updateCount !== null && updateCount >= 3) {
      const { data: bonusResult } = await supabase.rpc("award_greenpoints", {
        p_email: email,
        p_points: POINTS_3_UPDATES_BONUS,
        p_reason: "milestone_3_updates",
        p_tree_id: tree.id,
        p_event_id: `milestone_3_updates_${tree.id}`,
      });
    }

    // 6 updates milestone bonus + Growth Champion achievement
    if (updateCount !== null && updateCount >= 6) {
      await supabase.rpc("award_greenpoints", {
        p_email: email,
        p_points: POINTS_6_UPDATES_BONUS,
        p_reason: "milestone_6_updates",
        p_tree_id: tree.id,
        p_event_id: `milestone_6_updates_${tree.id}`,
      });

      const { data: unlockedChamp } = await supabase.rpc("award_achievement", {
        p_email: email,
        p_achievement_key: "growth_champion",
      });
      if (unlockedChamp) {
        achievementUnlocked = true;
        achievementName = "Growth Champion";
        achievementIcon = "🌻";
        achievementDescription = "You completed 6 growth updates for a single tree! +100 bonus GreenPoints!";
      }
    }

    // Check GreenRoots Hero (1000 points)
    const { data: balanceRow } = await supabase
      .from("greenpoints_balances")
      .select("total_points")
      .eq("email_key", email.toLowerCase().trim())
      .maybeSingle();

    if (balanceRow && balanceRow.total_points >= 1000) {
      const { data: unlockedHero } = await supabase.rpc("award_achievement", {
        p_email: email,
        p_achievement_key: "greenroots_hero",
      });
      if (unlockedHero) {
        achievementUnlocked = true;
        achievementName = "GreenRoots Hero";
        achievementIcon = "🏆";
        achievementDescription = "You earned 1,000 GreenPoints!";
      }
    }

    // 4. Send update confirmation email
    const nextDueDate = addDays(todayStr(), SUBSEQUENT_UPDATE_DAYS);
    const trackUrl = (siteUrl || SUPABASE_URL).replace(/\/$/, "") + "/track.html";

    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        to: email,
        subject: "Growth Update Recorded! 🌿",
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fff8;border-radius:12px;overflow:hidden;border:1px solid #c8e6c9;">
          <div style="background:linear-gradient(135deg,#2e7d32,#43a047);padding:32px 24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;">🌳 GreenRoots</h1>
            <p style="color:#e8f5e9;margin:8px 0 0;font-size:16px;">Restoring Nature, One Tree at a Time</p>
          </div>
          <div style="padding:32px 24px;color:#333;line-height:1.6;">
            <h2 style="color:#2e7d32;margin-top:0;">Update Successfully Recorded!</h2>
            <p>Hi ${tree.planter_name || "Planter"},</p>
            <p>Your growth update for <strong>${tree.tree_type}</strong> (UID: ${tree.tree_uid}) has been recorded.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px 0;color:#666;">Points Earned:</td><td style="padding:8px 0;font-weight:600;color:#2e7d32;">+${POINTS_UPDATE} 🌿</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Total GreenPoints:</td><td style="padding:8px 0;font-weight:600;">${balanceRow?.total_points || POINTS_UPDATE} 🌿</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Next Update Due:</td><td style="padding:8px 0;font-weight:600;">${formatDate(nextDueDate)}</td></tr>
            </table>
            <a href="${trackUrl}" style="display:inline-block;background:#43a047;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;margin:16px 0;">🌿 View My Tree</a>
          </div>
          <div style="padding:24px;text-align:center;color:#666;font-size:14px;border-top:1px solid #e0e0e0;">
            <p>GreenRoots — Restoring Nature, One Tree at a Time</p>
          </div>
        </div>`,
        template: "update_confirmation",
      }),
    }).catch((err) => console.error("Failed to send update email:", err));

    // 5. Send achievement email if unlocked
    if (achievementUnlocked) {
      const { data: finalBalance } = await supabase
        .from("greenpoints_balances")
        .select("total_points")
        .eq("email_key", email.toLowerCase().trim())
        .maybeSingle();

      await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
        body: JSON.stringify({
          to: email,
          subject: `Achievement Unlocked: ${achievementName}! 🏆`,
          html: `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fff8;border-radius:12px;overflow:hidden;border:1px solid #c8e6c9;">
            <div style="background:linear-gradient(135deg,#2e7d32,#43a047);padding:32px 24px;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:28px;">🌳 GreenRoots</h1>
              <p style="color:#e8f5e9;margin:8px 0 0;font-size:16px;">Restoring Nature, One Tree at a Time</p>
            </div>
            <div style="padding:32px 24px;color:#333;line-height:1.6;">
              <h2 style="color:#2e7d32;margin-top:0;">${achievementIcon} Achievement Unlocked!</h2>
              <p>Hi ${tree.planter_name || "Planter"},</p>
              <p>Congratulations! You've unlocked the <strong>${achievementName}</strong> achievement.</p>
              <p>${achievementDescription}</p>
              <p style="font-size:18px;color:#2e7d32;font-weight:600;">Total GreenPoints: ${finalBalance?.total_points || 0} 🌿</p>
            </div>
            <div style="padding:24px;text-align:center;color:#666;font-size:14px;border-top:1px solid #e0e0e0;">
              <p>GreenRoots — Restoring Nature, One Tree at a Time</p>
            </div>
          </div>`,
          template: "achievement",
        }),
      }).catch((err) => console.error("Failed to send achievement email:", err));
    }

    return new Response(
      JSON.stringify({ success: true, balance: newBalance, achievementUnlocked, updateCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("process-update error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
