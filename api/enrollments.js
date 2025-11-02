import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
  const { data, error } = await supabase.auth.api.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_BASE_URL}/reset-password`,
  });
  if (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
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

    // Insert or confirm learner in the learners table
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

    // Check if already enrolled
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
    console.error("Error in enrollment API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
