import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { action } = req.body;

    if (action === "create-profile") {
      const { user_id, email, full_name, role = "learner" } = req.body;

      if (!user_id || !email || !full_name) {
        return res.status(400).json({ error: "Missing required fields for profile creation." });
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          user_id,
          email,
          full_name,
          role
        });

      if (profileError) {
        return res.status(400).json({ error: profileError.message });
      }

      return res.status(201).json({ success: true, message: "Profile created." });
    } else {
      return res.status(400).json({ error: "Missing or invalid action parameter." });
    }
  } catch (error) {
    console.error("signup API error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
