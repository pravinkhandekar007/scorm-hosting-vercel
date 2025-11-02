import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const frontendUrl = process.env.FRONTEND_BASE_URL;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ email });
  if (error) {
    console.error("Error fetching user by email:", error);
    return null;
  }
  const matchedUser = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  return matchedUser || null;
}

async function createUser(email, fullName) {
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: Math.random().toString(36).slice(-10) + "A1!",
    email_confirm: false,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    console.error("User creation error:", createError);
    throw createError;
  }

  return newUser;
}

async function sendPasswordResetEmail(email) {
  const url = `${supabaseUrl}/auth/v1/recover`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      redirect_to: `${frontendUrl}/reset-password`, // Adjust to your reset-password route
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to send password reset email: ${errorText}`);
    throw new Error(`Failed to trigger password reset email: ${errorText}`);
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
      return res.status(400).json({
        error: "Missing required fields: course_id, learner_email, learner_name",
      });
    }

    console.log(`Received request to enroll learner: ${learner_email} into course: ${course_id}`);

    // Verify course exists
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Check user existence
    let user = await fetchUserByEmail(learner_email);

    if (!user) {
      user = await createUser(learner_email, learner_name);
      await sendPasswordResetEmail(learner_email);
    }

    const learner_id = user.id;

    // Insert or confirm learner in learners table
    const { data: learnerInTable } = await supabase
      .from("learners")
      .select("id")
      .eq("id", learner_id)
      .single();

    if (!learnerInTable) {
      const { error: learnerInsertError } = await supabase
        .from("learners")
        .insert({
          id: learner_id,
          email: learner_email,
          name: learner_name,
        });

      if (learnerInsertError) {
        return res.status(500).json({ error: "Failed to insert learner record" });
      }
    }

    // Check for existing enrollment
    const { data: existingEnrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("course_id", course_id)
      .eq("learner_id", learner_id)
      .single();

    if (existingEnrollment) {
      return res.status(409).json({ error: "Learner already enrolled in this course" });
    }

    // Insert enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .insert({
        course_id,
        learner_id,
        learner_email,
        learner_name,
        status: "active",
      })
      .select();

    if (enrollmentError) {
      return res.status(500).json({ error: "Failed to create enrollment" });
    }

    return res.status(201).json({
      success: true,
      enrollment: enrollment[0],
      message: "Enrollment created. Password reset email sent if user was newly created.",
    });
  } catch (error) {
    console.error("Error in enrollments API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
