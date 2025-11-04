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
      // Profile creation logic
      const { user_id, email, full_name, role = "learner", otherProfileData } = req.body;

      if (!user_id || !email || !full_name) {
        return res.status(400).json({ error: "Missing required fields for profile creation." });
      }

      const { data: existingProfile, error: selectError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", user_id)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        return res.status(500).json({ error: selectError.message || "Error checking profile existence" });
      }

      if (existingProfile) {
        return res.status(409).json({ error: "Profile already exists." });
      }

      const { error: insertError } = await supabase.from("profiles").insert({
        user_id,
        email,
        full_name,
        role,
        ...otherProfileData,
      });

      if (insertError) {
        throw insertError;
      }

      return res.status(201).json({ success: true, message: "Profile created." });
    } else {
      // Existing signup logic (if any)
      // If you previously created profiles here, you can omit or handle other signup actions.

      return res.status(400).json({ error: "Missing or invalid action parameter." });
    }
  } catch (error) {
    console.error("signup API error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
