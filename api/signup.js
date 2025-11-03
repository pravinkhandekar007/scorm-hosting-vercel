import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: Wait for user to exist in auth.users
async function waitForAuthUserExists(userId, maxRetries = 10, delayMs = 500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (data && !error) {
        console.log(`✓ User found on attempt ${i + 1}`);
        return true;
      }
    } catch (e) {
      console.log(`Attempt ${i + 1} to find user: ${e.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  console.log('✗ User not found after all retries');
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { action } = req.body;

    if (action === "create-profile") {
      console.log('=== CREATE PROFILE REQUEST ===');
      console.log('Full request body:', JSON.stringify(req.body, null, 2));

      // Explicit destructuring with null checks
      const user_id = req.body?.user_id;
      const email = req.body?.email;
      const full_name = req.body?.full_name;
      let role = req.body?.role;

      console.log('Extracted values:');
      console.log('  user_id:', user_id, '(type:', typeof user_id + ')');
      console.log('  email:', email, '(type:', typeof email + ')');
      console.log('  full_name:', full_name, '(type:', typeof full_name + ')');
      console.log('  role:', role, '(type:', typeof role + ')');

      // Validation
      if (!user_id || !email || !full_name) {
        console.error('✗ Missing required fields');
        return res.status(400).json({ error: "Missing required fields: user_id, email, full_name" });
      }

      // Validate and set default role
      if (!role || (role !== 'learner' && role !== 'owner')) {
        console.warn('⚠ Invalid or missing role, defaulting to learner');
        role = 'learner';
      }

      console.log('✓ Final role to be inserted:', role);

      // Wait for user to exist
      console.log('Waiting for user to exist in auth.users...');
      const userExists = await waitForAuthUserExists(user_id);
      if (!userExists) {
        console.error('✗ User not found in auth.users after retries');
        return res.status(404).json({ error: "User not found in authentication system. Please try again." });
      }

      // Check if profile already exists
      console.log('Checking if profile already exists for user:', user_id);
      const { data: existingProfile, error: selectError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", user_id)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        console.error('✗ Error checking existing profile:', selectError);
        return res.status(500).json({ error: selectError.message || "Error checking profile" });
      }

      if (existingProfile) {
        console.log('⚠ Profile already exists for user:', user_id);
        return res.status(409).json({ error: "Profile already exists." });
      }

      // Insert profile with explicit role
      console.log('Inserting profile with role:', role);
      const { error: insertError, data: insertData } = await supabase.from("profiles").insert({
        user_id,
        email,
        full_name,
        role
      }).select();

      if (insertError) {
        console.error('✗ Error inserting profile:', insertError);
        throw insertError;
      }

      console.log('✓ Profile created successfully');
      console.log('Inserted data:', insertData);
      return res.status(201).json({ 
        success: true, 
        message: "Profile created successfully",
        role: role,
        data: insertData
      });
    }

    return res.status(400).json({ error: "Missing or invalid action parameter." });
  } catch (error) {
    console.error("✗ Signup API fatal error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
