// GreenRoots send-email edge function
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { to, subject, html, template } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Log the attempt
    const { error: logError } = await supabase.rpc("log_email", {
      p_to: to,
      p_subject: subject,
      p_template: template || "generic",
      p_status: "queued",
    });
    if (logError) console.error("Failed to log email (queued):", logError);

    // If no Resend API key is configured, log and return a clear message
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured — email was not sent");
      await supabase.rpc("log_email", {
        p_to: to,
        p_subject: subject,
        p_template: template || "generic",
        p_status: "failed",
        p_error: "RESEND_API_KEY not configured",
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured. Set RESEND_API_KEY edge function secret.",
          delivered: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GreenRoots <onboarding@resend.dev>",
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errorText);
      await supabase.rpc("log_email", {
        p_to: to,
        p_subject: subject,
        p_template: template || "generic",
        p_status: "failed",
        p_error: `Resend ${resendResponse.status}: ${errorText}`,
      });
      return new Response(
        JSON.stringify({ success: false, error: "Email delivery failed", delivered: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendData = await resendResponse.json();

    // Log success
    await supabase.rpc("log_email", {
      p_to: to,
      p_subject: subject,
      p_template: template || "generic",
      p_status: "sent",
    });

    return new Response(
      JSON.stringify({ success: true, id: resendData.id, delivered: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message, delivered: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
