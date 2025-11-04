import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Extract fields from request body
    const { user_id, email, full_name, role } = req.body;

    console.log('=== PROFILE CREATION REQUEST ===');
    console.log('Received body:', JSON.stringify(req.body, null, 2));
    console.log('Extracted - user_id:', user_id, 'email:', email, 'full_name:', full_name, 'role:', role);

    // Validate required fields
    if (!user_id || !email) {
      console.error('Missing required fields');
      return res.status(400).json({ error: "Missing required fields: user_id, email" });
    }

    // Use provided role or default to 'learner'
    const finalRole = role && (role === 'learner' || role === 'owner') ? role : 'learner';
    console.log('Final role to be inserted:', finalRole);

    // Check if profile already exists for this user_id
    console.log('Checking if profile exists for user_id:', user_id);
    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", user_id)
      .single();

    // Handle selection error (PGRST116 = no rows found, which is OK)
    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Error checking existing profile:', selectError);
      return res.status(500).json({ error: "Error checking profile: " + selectError.message });
    }

    if (existingProfile) {
      console.log('Profile already exists with role:', existingProfile.role);
      return res.status(409).json({ error: "Profile already exists." });
    }

    // Insert new profile with all fields including role
    console.log('Inserting profile with:');
    console.log('  user_id:', user_id);
    console.log('  email:', email);
    console.log('  full_name:', full_name);
    console.log('  role:', finalRole);

    const { error: insertError, data: insertData } = await supabase
      .from("profiles")
      .insert({
        user_id,
        email,
        full_name: full_name || '',
        role: finalRole
      })
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    console.log('Profile created successfully:', insertData);

    return res.status(201).json({
      success: true,
      message: "Profile created successfully with role: " + finalRole,
      data: insertData
    });

  } catch (error) {
    console.error("signup API error:", error);
    return res.status(500).json({ 
      error: error.message || "Internal server error",
      details: error.details || null
    });
  }
}
