import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const frontendUrl = process.env.FRONTEND_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ email });
  if (error) throw error;
  const matchedUser = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  return matchedUser || null;
}

async function createUser(email, fullName) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: Math.random().toString(36).slice(-10) + "A1!", // temp password
    email_confirm: false,
    user_metadata: { full_name: fullName }
  });
  if (error) throw error;
  return data.user;
}

async function sendInviteEmail(email) {
  // Send magic link reset password email to let user set password at custom page
  const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      redirect_to: `${frontendUrl}/set-password.html` // your custom password set page
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send magic link email: ${errorText}`);
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { course_id, learner_email, learner_name } = req.body;
    if (!course_id || !learner_email || !learner_name) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", course_id)
      .single();

    if (courseError || !course) return res.status(404).json({ error: "Course not found." });

    const { data: existingLearner, error: learnerError } = await supabase
      .from("learners")
      .select("id")
      .eq("email", learner_email.toLowerCase())
      .single();

    if (learnerError && learnerError.code !== 'PGRST116') {
      throw learnerError;
    }

    let learner_id;

    if (existingLearner) {
      learner_id = existingLearner.id;
    } else {
      let user = await fetchUserByEmail(learner_email);

      if (!user) {
        user = await createUser(learner_email, learner_name);
        await sendInviteEmail(learner_email);
      }

      learner_id = user?.id;

      if (!learner_id) {
        return res.status(500).json({ error: "Failed to determine learner id." });
      }

      const { error: insertLearnerError } = await supabase
        .from("learners")
        .insert({
          id: learner_id,
          email: learner_email.toLowerCase(),
          name: learner_name
        });

      if (insertLearnerError) throw insertLearnerError;
    }

    const { data: existingEnrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("course_id", course_id)
      .eq("learner_id", learner_id)
      .single();

    if (existingEnrollment) return res.status(409).json({ error: "Already enrolled." });

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .insert({
        course_id,
        learner_id,
        learner_email: learner_email.toLowerCase(),
        learner_name,
        status: "active",
      })
      .select();

    if (enrollmentError) throw enrollmentError;

    res.status(201).json({
      success: true,
      enrollment: enrollment[0],
      message: "User enrolled; magic link email sent if user new.",
    });

  } catch (error) {
    console.error("enrollments API error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}
