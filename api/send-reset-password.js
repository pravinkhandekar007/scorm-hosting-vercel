import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const frontendUrl = process.env.FRONTEND_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing 'email' in request body." });

  const url = `${supabaseUrl}/auth/v1/recover`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      redirect_to: `${frontendUrl}/reset-password`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return res.status(500).json({ error: `Failed to send password reset email: ${errorText}` });
  }

  res.status(200).json({ success: true, message: "Password reset email sent." });
}
