import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { learner_id, email, name, role = "learner", otherProfileData } = req.body;

    if (!learner_id || !email || !name) {
      console.log('Missing required fields:', { learner_id, email, name });
      return res.status(400).json({ error: "Missing required fields." });
    }

    console.log('Received learner_id:', learner_id);
    console.log('Checking for existing profile with id:', learner_id);

    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", learner_id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Error querying existing profile:', selectError);
      return res.status(500).json({ error: selectError.message || 'Error checking profile existence' });
    }

    if (existingProfile) {
      console.log('Profile already exists for:', learner_id);
      return res.status(409).json({ error: "Profile already exists." });
    }

    console.log('Inserting new profile:', { id: learner_id, email, name, role, ...otherProfileData });

    const { error: insertError } = await supabase.from("profiles").insert({
      id: learner_id,
      email,
      name,
      role,
      ...otherProfileData,
    });

    if (insertError) {
      console.error('Error inserting profile:', insertError);
      throw insertError;
    }

    console.log('Profile inserted successfully for user:', learner_id);

    res.status(201).json({
      success: true,
      message: "Signup complete, profile created.",
    });
  } catch (error) {
    console.error("signup API error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}
