import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Enable CORS headers omitted for brevity, add them just as in your existing file

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

    // Check if course exists
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Check if user exists in Supabase Auth by email
    const { data: existingUser, error: userError } = await supabase.auth.admin.getUserByEmail(learner_email);

    let learner_id;

    if (userError && userError.status === 404) {
      // User not found, create new user which triggers confirmation email
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: learner_email,
        password: Math.random().toString(36).slice(-8), // temporary random password
        email_confirm: false,
        user_metadata: { full_name: learner_name }
      });

      if (createUserError) {
        return res.status(500).json({ error: "Failed to create user in Auth" });
      }
      learner_id = newUser.id;
    } else if (existingUser) {
      learner_id = existingUser.id;
    } else {
      return res.status(500).json({ error: "Unexpected error checking user in Auth" });
    }

    // Check if enrollment already exists
    const { data: existingEnrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("course_id", course_id)
      .eq("learner_id", learner_id)
      .single();

    if (existingEnrollment) {
      return res.status(409).json({
        error: "Enrollment already exists for this course and learner",
      });
    }

    // Create enrollment
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
      console.error("Enrollment creation error:", enrollmentError);
      return res.status(500).json({ error: "Failed to create enrollment" });
    }

    return res.status(201).json({
      success: true,
      enrollment: enrollment[0],
      message: "Enrollment created, email notification sent if new user.",
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
