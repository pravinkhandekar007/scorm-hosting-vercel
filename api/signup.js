import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { learner_id, email, name, role = "learner", otherProfileData } = req.body;

    if (!learner_id || !email || !name) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", learner_id)
      .single();

    if (existingProfile) {
      return res.status(409).json({ error: "Profile already exists." });
    }

    const { error: insertError } = await supabase.from("profiles").insert({
      id: learner_id,
      email,
      name,
      role,
      ...otherProfileData,
    });

    if (insertError) throw insertError;

    res.status(201).json({
      success: true,
      message: "Signup complete, profile created.",
    });
  } catch (error) {
    console.error("signup API error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}
