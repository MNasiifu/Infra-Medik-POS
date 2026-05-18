// INFRA MEDIK POS — Create User Edge Function
//
// Required secrets (set via Supabase dashboard → Settings → Edge Functions):
//   SUPABASE_URL               Injected automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY  Injected automatically by Supabase
//   SMTP_HOST                  Your SMTP server hostname
//   SMTP_PORT                  Your SMTP server port (e.g. 465 or 587)
//   SMTP_USER                  SMTP authentication username
//   SMTP_PASS                  SMTP authentication password
//   EMAIL_FROM                 Sender address, e.g. "Infra Medik POS <noreply@yourdomain.com>"
//   APP_NAME                   Optional display name in emails (default: "Infra Medik POS")

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

// ── Environment ────────────────────────────────────────────
const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY        = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SMTP_HOST          = Deno.env.get("SMTP_HOST");
const SMTP_PORT          = parseInt(Deno.env.get("SMTP_PORT") ?? "465", 10);
const SMTP_USER          = Deno.env.get("SMTP_USER");
const SMTP_PASS          = Deno.env.get("SMTP_PASS");
const EMAIL_FROM         = Deno.env.get("EMAIL_FROM") ?? "noreply@inframedik.com";
const APP_NAME           = Deno.env.get("APP_NAME")  ?? "Infra Medik POS";

// ── Allowed CORS origins ───────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "https://portal.inframedikafrika.com",
  "https://inframedikafrika.com",
]);

/**
 * Build CORS headers for the given request origin.
 * If the origin is in the allowlist it is reflected back; otherwise the
 * header is omitted so the browser blocks the preflight.
 */
function corsHeaders(requestOrigin: string | null): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)) {
    base["Access-Control-Allow-Origin"] = requestOrigin;
    // Required when credentials (Authorization header) are sent
    base["Vary"] = "Origin";
  }

  return base;
}

// ── Helpers ────────────────────────────────────────────────
function generateTempPassword(): string {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes)
    .map((b) => charset[b % charset.length])
    .join("");
}

/**
 * Send a welcome e-mail via SMTP using nodemailer (npm:nodemailer).
 * Failures are logged but do NOT abort the request — the user was already
 * created successfully.
 */
async function sendWelcomeEmail(
  email: string,
  fullName: string,
  tempPassword: string,
): Promise<void> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn(
      "[create-user] SMTP secrets not fully configured — skipping email.",
    );
    return;
  }

  try {
    // Determine whether to use TLS based on port:
    //   port 465  → secure: true  (implicit TLS / SMTPS)
    //   port 587  → secure: false (STARTTLS — nodemailer upgrades automatically)
    const secure = SMTP_PORT === 465;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: `Your ${APP_NAME} account has been created`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#1a1a2e">${APP_NAME}</h2>
          <p>Hello <strong>${fullName}</strong>,</p>
          <p>Your account has been created by an administrator.
             Use the credentials below to sign in.</p>
          <table style="border:1px solid #e0e0e0;border-radius:8px;
                        padding:16px 24px;background:#f9f9f9;width:100%">
            <tr>
              <td style="padding:6px 0;color:#555">Email</td>
              <td style="padding:6px 0;font-weight:600">${email}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#555">Temporary password</td>
              <td style="padding:6px 0;font-weight:600;
                         font-family:monospace;font-size:1.1em">
                ${tempPassword}
              </td>
            </tr>
          </table>
          <p style="color:#d32f2f;font-size:0.9em;margin-top:16px">
            ⚠ You will be required to change your password immediately
            after your first login.<br>
            Keep these credentials private and do not share them.
          </p>
        </div>
      `,
    });

    console.info("[create-user] Welcome email sent to", email);
  } catch (err) {
    console.error("[create-user] Failed to send email:", err);
  }
}

// ── Main handler ───────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    // ── 1. Verify caller token ───────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers,
      });
    }

    // Admin client — service role, full DB access
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Caller-scoped client — forwards user JWT so auth.uid() resolves in RPCs
    const callerClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await callerClient.auth.getUser();

    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers,
      });
    }

    // Verify caller is an admin
    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (
      profileErr ||
      (callerProfile as { role: string } | null)?.role !== "admin"
    ) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin access required" }),
        { status: 403, headers },
      );
    }

    // ── 2. Parse & validate payload ──────────────────────
    const body = await req.json();
    const { full_name, email, role, branch_id } = body as {
      full_name: string;
      email: string;
      role: string;
      branch_id: string;
    };

    if (!full_name || !email || !role || !branch_id) {
      return new Response(
        JSON.stringify({
          error: "full_name, email, role, and branch_id are required",
        }),
        { status: 400, headers },
      );
    }

    if (!["admin", "manager", "teller"].includes(role)) {
      return new Response(
        JSON.stringify({
          error: "Invalid role. Must be admin, manager, or teller",
        }),
        { status: 400, headers },
      );
    }

    // ── 3. Generate temporary password ───────────────────
    const tempPassword = generateTempPassword();

    // ── 4. Create auth user ──────────────────────────────
    const { data: authData, error: createErr } =
      await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name },
      });

    if (createErr) {
      return new Response(
        JSON.stringify({ error: createErr.message }),
        { status: 422, headers },
      );
    }

    const userId = authData.user!.id;

    // ── 5. Setup profile via RPC ─────────────────────────
    const { error: rpcErr } = await callerClient.rpc("admin_setup_new_user", {
      p_user_id:   userId,
      p_full_name: full_name,
      p_email:     email,
      p_role:      role,
      p_branch_id: branch_id,
    });

    if (rpcErr) {
      // Rollback: remove the auth user to keep the DB consistent
      await adminClient.auth.admin.deleteUser(userId);
      console.error("[create-user] RPC error:", rpcErr.message);
      return new Response(
        JSON.stringify({ error: rpcErr.message }),
        { status: 500, headers },
      );
    }

    // ── 6. Send welcome email (non-blocking on failure) ──
    await sendWelcomeEmail(email, full_name, tempPassword);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        temp_password: tempPassword,
      }),
      { headers },
    );
  } catch (err) {
    console.error("[create-user] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers },
    );
  }
});