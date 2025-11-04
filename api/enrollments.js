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
  const { data: newUser, error } = await supabase.auth.admin.createUser({
    email,
    password: Math.random().toString(36).slice(-10) + "A1!",
    email_confirm: false,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return newUser;
}

async function sendInviteEmail(email) {
  // Use Supabase admin invite user email function (adjust depending on your SDK)
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${frontendUrl}/invite-accept`, // Change to your invite acceptance page
  });
  if (error) throw error;
  return data;
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

    // Check if learner exists by email in learners table
    const { data: existingLearner, error: learnerError } = await supabase
      .from("learners")
      .select("id")
      .eq("email", learner_email.toLowerCase())
      .single();

    if (learnerError && learnerError.code !== 'PGRST116') { // ignore no rows found
      throw learnerError;
    }

    let learner_id;

    if (existingLearner) {
      learner_id = existingLearner.id;
    } else {
      // Check if user exists in supabase auth users
      let user = await fetchUserByEmail(learner_email);

      if (!user) {
        user = await createUser(learner_email, learner_name);
        await sendInviteEmail(learner_email);
      }
      learner_id = user.id;

      // Insert learner record in learners table
      const { error: insertLearnerError } = await supabase
        .from("learners")
        .insert({
          id: learner_id,
          email: learner_email.toLowerCase(),
          name: learner_name,
        });

      if (insertLearnerError) throw insertLearnerError;
    }

    // Check existing enrollment for learner for the course
    const { data: existingEnrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("course_id", course_id)
      .eq("learner_id", learner_id)
      .single();

    if (existingEnrollment) return res.status(409).json({ error: "Already enrolled." });

    // Insert enrollment record
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
      message: "Enrolled user; invitation email sent if user new.",
    });
  } catch (error) {
    console.error("enrollments API error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}
