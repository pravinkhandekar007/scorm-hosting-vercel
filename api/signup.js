import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password, full_name, role } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: "Email, password, and full name required." });
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.admin.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.APP_URL}/email-verified.html`
      }
    });

    if (signUpError) {
      return res.status(400).json({ error: signUpError.message });
    }

    const user_id = signUpData.user.id;

    // Insert or upsert profile with role along with full_name and email
    const { error: profileError, data: profileData } = await supabase
      .from("profiles")
      .upsert({
        user_id,
        email,
        full_name,
        role: role && (role === 'owner' || role === 'learner') ? role : 'learner',
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      return res.status(500).json({ error: "Error creating profile: " + profileError.message });
    }

    res.status(201).json({
      success: true,
      message: "User signed up and profile created successfully. Please check your email for verification.",
      user: signUpData.user,
      profile: profileData
    });

  } catch (error) {
    console.error("Signup API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
