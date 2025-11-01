import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

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
    const { csv_data, course_id } = req.body;

    if (!csv_data || !course_id) {
      return res
        .status(400)
        .json({ error: "Missing csv_data or course_id" });
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

    // Parse CSV
    let records;
    try {
      records = parse(csv_data, {
        columns: true,
        skip_empty_lines: true,
      });
    } catch (parseError) {
      return res.status(400).json({ error: "Invalid CSV format" });
    }

    // Validate and prepare data
    const enrollments = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNum = i + 2; // +2 because of header and 0-indexing

      const learner_id = record.learner_id?.trim();
      const learner_email = record.learner_email?.trim();
      const learner_name = record.learner_name?.trim();

      if (!learner_id || !learner_email || !learner_name) {
        errors.push({
          row: rowNum,
          message: "Missing learner_id, learner_email, or learner_name",
        });
        continue;
      }

      enrollments.push({
        course_id,
        learner_id,
        learner_email,
        learner_name,
        status: "active",
      });
    }

    if (enrollments.length === 0) {
      return res.status(400).json({ error: "No valid rows in CSV", errors });
    }

    // Check for duplicates in request
    const uniqueKey = (e) => `${e.course_id}-${e.learner_id}`;
    const seen = new Set();
    const duplicates = [];

    for (const enrollment of enrollments) {
      const key = uniqueKey(enrollment);
      if (seen.has(key)) {
        duplicates.push(
          `${enrollment.learner_email} (duplicate in CSV)`
        );
      } else {
        seen.add(key);
      }
    }

    // Check for existing enrollments in database
    const { data: existingEnrollments } = await supabase
      .from("enrollments")
      .select("learner_id")
      .eq("course_id", course_id)
      .in(
        "learner_id",
        enrollments.map((e) => e.learner_id)
      );

    const existingIds = new Set(existingEnrollments?.map((e) => e.learner_id) || []);
    const alreadyEnrolled = [];
    const toInsert = [];

    for (const enrollment of enrollments) {
      if (existingIds.has(enrollment.learner_id)) {
        alreadyEnrolled.push(enrollment.learner_email);
      } else {
        toInsert.push(enrollment);
      }
    }

    // Insert new enrollments
    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: insertError, data: insertedData } = await supabase
        .from("enrollments")
        .insert(toInsert)
        .select();

      if (insertError) {
        console.error("Insert error:", insertError);
        return res.status(500).json({ error: "Failed to insert enrollments" });
      }

      inserted = insertedData?.length || 0;
    }

    return res.status(200).json({
      success: true,
      summary: {
        total_rows: records.length,
        created: inserted,
        already_enrolled: alreadyEnrolled.length,
        errors: errors.length + duplicates.length,
      },
      details: {
        already_enrolled: alreadyEnrolled,
        duplicates,
        errors,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
