// GreenRoots process-registration edge function
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

const POINTS_REGISTRATION = 100;
const POINTS_5_TREES_BONUS = 200;
const POINTS_10_TREES_BONUS = 500;

function emailTemplate(templateName: string, vars: Record<string, string>): { subject: string; html: string } {
  const baseStyles = `font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fff8;border-radius:12px;overflow:hidden;border:1px solid #c8e6c9;`;
  const headerStyles = `background:linear-gradient(135deg,#2e7d32,#43a047);padding:32px 24px;text-align:center;`;
  const bodyStyles = `padding:32px 24px;color:#333;line-height:1.6;`;
  const btnStyles = `display:inline-block;background:#43a047;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;margin:16px 0;`;
  const footerStyles = `padding:24px;text-align:center;color:#666;font-size:14px;border-top:1px solid #e0e0e0;`;

  if (templateName === "registration") {
    return {
      subject: "Your GreenRoots Journey Begins! 🌱",
      html: `<div style="${baseStyles}">
        <div style="${headerStyles}">
          <h1 style="color:#fff;margin:0;font-size:28px;">🌳 GreenRoots</h1>
          <p style="color:#e8f5e9;margin:8px 0 0;font-size:16px;">Restoring Nature, One Tree at a Time</p>
        </div>
        <div style="${bodyStyles}">
          <h2 style="color:#2e7d32;margin-top:0;">Thank You for Planting!</h2>
          <p>Hi ${vars.planterName},</p>
          <p>Your tree has been successfully registered with GreenRoots. Here are your details:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 0;color:#666;">Tree Species:</td><td style="padding:8px 0;font-weight:600;">${vars.treeType}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Tree UID:</td><td style="padding:8px 0;font-weight:600;color:#2e7d32;">${vars.treeUid}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Planting Date:</td><td style="padding:8px 0;font-weight:600;">${vars.plantingDate}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Location:</td><td style="padding:8px 0;font-weight:600;">${vars.location}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">GreenPoints Earned:</td><td style="padding:8px 0;font-weight:600;color:#2e7d32;">+${vars.points} 🌿</td></tr>
          </table>
          <p>Save your Tree UID — you'll need it to track your tree's growth and submit updates.</p>
          <a href="${vars.trackUrl}" style="${btnStyles}">🌿 Track My Tree</a>
        </div>
        <div style="${footerStyles}">
          <p>GreenRoots — Restoring Nature, One Tree at a Time</p>
          <p style="font-size:12px;color:#999;">© 2024 GreenRoots. Growing a greener future together.</p>
        </div>
      </div>`,
    };
  }

  if (templateName === "update_confirmation") {
    return {
      subject: "Growth Update Recorded! 🌿",
      html: `<div style="${baseStyles}">
        <div style="${headerStyles}">
          <h1 style="color:#fff;margin:0;font-size:28px;">🌳 GreenRoots</h1>
          <p style="color:#e8f5e9;margin:8px 0 0;font-size:16px;">Restoring Nature, One Tree at a Time</p>
        </div>
        <div style="${bodyStyles}">
          <h2 style="color:#2e7d32;margin-top:0;">Update Successfully Recorded!</h2>
          <p>Hi ${vars.planterName},</p>
          <p>Your growth update for <strong>${vars.treeType}</strong> (UID: ${vars.treeUid}) has been recorded.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 0;color:#666;">Points Earned:</td><td style="padding:8px 0;font-weight:600;color:#2e7d32;">+${vars.points} 🌿</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Total GreenPoints:</td><td style="padding:8px 0;font-weight:600;">${vars.totalPoints} 🌿</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Next Update Due:</td><td style="padding:8px 0;font-weight:600;">${vars.nextDueDate}</td></tr>
          </table>
          <a href="${vars.trackUrl}" style="${btnStyles}">🌿 View My Tree</a>
        </div>
        <div style="${footerStyles}">
          <p>GreenRoots — Restoring Nature, One Tree at a Time</p>
        </div>
      </div>`,
    };
  }

  if (templateName === "reminder") {
    return {
      subject: "Time to Update Your Tree! 🌿",
      html: `<div style="${baseStyles}">
        <div style="${headerStyles}">
          <h1 style="color:#fff;margin:0;font-size:28px;">🌳 GreenRoots</h1>
          <p style="color:#e8f5e9;margin:8px 0 0;font-size:16px;">Restoring Nature, One Tree at a Time</p>
        </div>
        <div style="${bodyStyles}">
          <h2 style="color:#2e7d32;margin-top:0;">Your Tree Is Due for an Update</h2>
          <p>Hi ${vars.planterName},</p>
          <p>It's time to share a growth update for your <strong>${vars.treeType}</strong> (UID: ${vars.treeUid}).</p>
          <p>Regular updates help GreenRoots track the health and growth of trees across our community.</p>
          <p>Here's what you'll need:</p>
          <ul>
            <li>A current photo of your tree</li>
            <li>Current height (if measurable)</li>
            <li>Growth stage and health status</li>
          </ul>
          <a href="${vars.trackUrl}" style="${btnStyles}">🌿 Submit Update Now</a>
        </div>
        <div style="${footerStyles}">
          <p>GreenRoots — Restoring Nature, One Tree at a Time</p>
        </div>
      </div>`,
    };
  }

  if (templateName === "achievement") {
    return {
      subject: `Achievement Unlocked: ${vars.achievementName}! 🏆`,
      html: `<div style="${baseStyles}">
        <div style="${headerStyles}">
          <h1 style="color:#fff;margin:0;font-size:28px;">🌳 GreenRoots</h1>
          <p style="color:#e8f5e9;margin:8px 0 0;font-size:16px;">Restoring Nature, One Tree at a Time</p>
        </div>
        <div style="${bodyStyles}">
          <h2 style="color:#2e7d32;margin-top:0;">${vars.achievementIcon} Achievement Unlocked!</h2>
          <p>Hi ${vars.planterName},</p>
          <p>Congratulations! You've unlocked the <strong>${vars.achievementName}</strong> achievement.</p>
          <p>${vars.achievementDescription}</p>
          <p style="font-size:18px;color:#2e7d32;font-weight:600;">Total GreenPoints: ${vars.totalPoints} 🌿</p>
        </div>
        <div style="${footerStyles}">
          <p>GreenRoots — Restoring Nature, One Tree at a Time</p>
        </div>
      </div>`,
    };
  }

  return { subject: "GreenRoots Notification", html: "<p>Notification from GreenRoots.</p>" };
}

async function sendEmail(to: string, templateName: string, vars: Record<string, string>): Promise<void> {
  const { subject, html } = emailTemplate(templateName, vars);
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ to, subject, html, template: templateName }),
    });
  } catch (err) {
    console.error(`Failed to send ${templateName} email:`, err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { treeId, siteUrl } = await req.json();

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

    const eventId = `registration_${tree.id}`;
    const trackUrl = (siteUrl || SUPABASE_URL).replace(/\/$/, "") + "/track.html";

    // 1. Award 100 GreenPoints (idempotent)
    const { data: newBalance, error: awardError } = await supabase.rpc("award_greenpoints", {
      p_email: email,
      p_points: POINTS_REGISTRATION,
      p_reason: "tree_registration",
      p_tree_id: tree.id,
      p_event_id: eventId,
    });
    if (awardError) console.error("Award error:", awardError);

    // 2. Update balance counts
    await supabase.rpc("update_balance_counts", { p_email: email });

    // 3. Check milestones — 5 trees
    const { count: treeCount } = await supabase
      .from("trees")
      .select("*", { count: "exact", head: true })
      .ilike("planter_email", email);

    let achievementUnlocked = false;
    let achievementName = "";
    let achievementIcon = "";
    let achievementDescription = "";

    if (treeCount !== null && treeCount >= 1) {
      const { data: unlocked } = await supabase.rpc("award_achievement", {
        p_email: email,
        p_achievement_key: "first_seed",
      });
      if (unlocked) {
        achievementUnlocked = true;
        achievementName = "First Seed";
        achievementIcon = "🌱";
        achievementDescription = "You registered your first tree with GreenRoots!";
      }
    }

    if (treeCount !== null && treeCount >= 5) {
      const { data: unlocked5 } = await supabase.rpc("award_achievement", {
        p_email: email,
        p_achievement_key: "nature_guardian",
      });
      if (unlocked5) {
        const { data: bonusBal } = await supabase.rpc("award_greenpoints", {
          p_email: email,
          p_points: POINTS_5_TREES_BONUS,
          p_reason: "milestone_5_trees",
          p_event_id: `milestone_5_${email}`,
        });
        achievementUnlocked = true;
        achievementName = "Nature Guardian";
        achievementIcon = "🌿";
        achievementDescription = "You registered 5 trees! +200 bonus GreenPoints!";
        if (bonusBal) {
          // Use the bonus balance for the email
        }
      }
    }

    if (treeCount !== null && treeCount >= 10) {
      const { data: unlocked10 } = await supabase.rpc("award_achievement", {
        p_email: email,
        p_achievement_key: "forest_builder",
      });
      if (unlocked10) {
        await supabase.rpc("award_greenpoints", {
          p_email: email,
          p_points: POINTS_10_TREES_BONUS,
          p_reason: "milestone_10_trees",
          p_event_id: `milestone_10_${email}`,
        });
        achievementUnlocked = true;
        achievementName = "Forest Builder";
        achievementIcon = "🌳";
        achievementDescription = "You registered 10 trees! +500 bonus GreenPoints!";
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

    // 4. Send registration confirmation email
    await sendEmail(email, "registration", {
      planterName: tree.planter_name || "Planter",
      treeType: tree.tree_type || "Tree",
      treeUid: tree.tree_uid || "",
      plantingDate: tree.planting_date || "",
      location: tree.location_name || "Not specified",
      points: String(POINTS_REGISTRATION),
      trackUrl: trackUrl,
    });

    // 5. Send achievement email if unlocked
    if (achievementUnlocked) {
      const { data: finalBalance } = await supabase
        .from("greenpoints_balances")
        .select("total_points")
        .eq("email_key", email.toLowerCase().trim())
        .maybeSingle();

      await sendEmail(email, "achievement", {
        planterName: tree.planter_name || "Planter",
        achievementName,
        achievementIcon,
        achievementDescription,
        totalPoints: String(finalBalance?.total_points || 0),
      });
    }

    return new Response(
      JSON.stringify({ success: true, balance: newBalance, achievementUnlocked }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("process-registration error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
