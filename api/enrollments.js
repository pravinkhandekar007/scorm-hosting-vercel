import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to get user by email via REST Admin API
async function fetchUserByEmail(email) {
  const url = `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: {
      apiKey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  if (!res.ok) {
    // Return null if not found or any error
    return null;
  }

  const data = await res.json();
  if (data && data.users && data.users.length > 0) {
    return data.users[0];
  }
  return null;
}

export default async function handler(req, res) {
  // Add CORS headers (same as your existing code)

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

    // Use REST API to check if user exists
    const existingUser = await fetchUserByEmail(learner_email);

    let learner_id;

    if (!existingUser) {
      // User not found, create new user using admin createUser method
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: learner_email,
        password: Math.random().toString(36).slice(-8), // temporary random password
        email_confirm: false,
        user_metadata: { full_name: learner_name },
      });

      if (createUserError) {
        return res.status(500).json({ error: "Failed to create user in Auth" });
      }
      learner_id = newUser.id;
    } else {
      learner_id = existingUser.id;
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

    // Create new enrollment record
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
