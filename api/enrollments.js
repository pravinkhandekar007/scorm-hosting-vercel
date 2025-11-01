import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { course_id, learner_id, learner_email, learner_name } = req.body;

    // Validate required fields
    if (!course_id || !learner_id || !learner_email || !learner_name) {
      return res.status(400).json({
        error: "Missing required fields: course_id, learner_id, learner_email, learner_name",
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

    // Check if user exists
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(learner_id);

    if (userError || !user) {
      return res.status(404).json({ error: "User not found" });
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
      message: "Enrollment created successfully",
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
