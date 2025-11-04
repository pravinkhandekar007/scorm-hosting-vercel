import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { full_name, email, password, role = "learner", ...otherProfileData } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: "Missing required signup fields." });
    }

    // Step 1: Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const user = authData?.user;
    if (!user || !user.id) {
      return res.status(500).json({ error: "User creation failed." });
    }

    // Step 2: Upsert profile to avoid 409 conflict
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        email,
        full_name,
        role,
        ...otherProfileData,
      });

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    return res.status(201).json({ success: true, message: "Signup and profile creation successful." });
  } catch (error) {
    console.error("signup API error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
