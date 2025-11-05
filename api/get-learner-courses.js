import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, PATCH, DELETE, POST, PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { learner_id } = req.body;

    if (!learner_id) {
      return res.status(400).json({ error: "Missing learner_id" });
    }

    // Use service role to bypass RLS
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from("enrollments")
      .select("course_id")
      .eq("learner_id", learner_id);

    if (enrollmentsError) throw enrollmentsError;

    if (!enrollments || enrollments.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const courseIds = enrollments.map(e => e.course_id);

    // Fetch courses using service role (bypasses RLS)
    const { data: courses, error: coursesError } = await supabase
      .from("courses")
      .select("id, course_slug, title, is_public, public_token, expires_at")
      .in("id", courseIds);

    if (coursesError) throw coursesError;

    return res.status(200).json({ success: true, data: courses });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}
