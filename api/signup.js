import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { action } = req.body;

    if (action === "create-profile") {
      const { user_id, email, full_name, role } = req.body;

      if (!user_id || !email || !full_name || !role) {
        return res.status(400).json({ error: "Missing required fields for profile creation including role." });
      }

      if (!['learner', 'owner'].includes(role)) {
        return res.status(400).json({ error: "Invalid role specified." });
      }

      // Check if profile exists
      const { data: profile, error: selectError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', user_id)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        return res.status(500).json({ error: selectError.message });
      }

      if (profile) {
        return res.status(409).json({ error: "Profile already exists." });
      }

      // Insert new profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ user_id, email, full_name, role });

      if (insertError) {
        if (insertError.code === '23503') {
          // Foreign key violation: user_id does not exist in auth.users yet
          return res.status(404).json({ error: "User not found yet. Please try again." });
        }
        return res.status(500).json({ error: insertError.message });
      }

      return res.status(201).json({ success: true, message: "Profile created." });
    }

    return res.status(400).json({ error: "Invalid or missing action parameter." });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
