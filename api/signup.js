import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user_id, email, full_name, role } = req.body;

    console.log('=== CREATE PROFILE REQUEST ===');
    console.log('Request body:', req.body);

    // Validate required fields
    if (!user_id || !email || !full_name) {
      return res.status(400).json({ error: "Missing required fields: user_id, email, full_name" });
    }

    // Validate role, default to 'learner' if invalid or missing
    let finalRole = 'learner';
    if (role && typeof role === 'string' && (role === 'learner' || role === 'owner')) {
      finalRole = role;
    }
    console.log('Role to use:', finalRole);

    // Check if profile already exists
    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", user_id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Error checking existing profile:', selectError);
      return res.status(500).json({ error: selectError.message || "Error checking profile" });
    }

    if (existingProfile) {
      console.log('Profile already exists for user_id:', user_id);
      return res.status(409).json({ error: "Profile already exists." });
    }

    // Insert profile
    const { error: insertError, data: insertData } = await supabase
      .from("profiles")
      .insert({
        user_id,
        email,
        full_name,
        role: finalRole
      })
      .select();

    if (insertError) {
      console.error('Error inserting profile:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    console.log('Profile created successfully:', insertData);
    return res.status(201).json({
      success: true,
      message: "Profile created successfully.",
      data: insertData
    });

  } catch (err) {
    console.error('Signup API error:', err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
