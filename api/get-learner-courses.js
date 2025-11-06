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

    // Fetch enrollments joined with course data, no expires_at in enrollment select
    const { data: enrollments, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        course: courses (
          id,
          course_slug,
          title,
          is_public,
          public_token,
          expires_at
        )
      `)
      .eq("learner_id", learner_id);

    if (error) throw error;

    if (!enrollments) {
      return res.status(200).json({ success: true, data: [] });
    }

    return res.status(200).json({ success: true, data: enrollments });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
}
