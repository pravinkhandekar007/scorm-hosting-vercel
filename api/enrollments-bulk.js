import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import crypto from "crypto";

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

    const errors = [];
    const duplicates = [];
    const alreadyEnrolled = [];
    const toInsert = [];
    const seenEmails = new Set();

    for (let i = 0; i < records.length; i++) {
      const rowNum = i + 2; // for error reporting
      const { learner_email, learner_name } = records[i];

      if (!learner_email || !learner_name) {
        errors.push({ row: rowNum, message: "Missing learner_email or learner_name" });
        continue;
      }

      // Check duplicate emails in CSV
      if (seenEmails.has(learner_email)) {
        duplicates.push(`${learner_email} (duplicate in CSV)`);
        continue;
      }
      seenEmails.add(learner_email);

      // Check if user exists by email using Admin API
      // This method returns { users: [], ... }. Adjusted accordingly.
      const { data: userList, error: userError } = await supabase.auth.admin.listUsers({
        filter: `email=eq.${learner_email}`,
      });

      if (userError) {
        errors.push({ row: rowNum, message: `Failed to query user: ${userError.message}` });
        continue;
      }

      let learner_id;

      // Defensive checks around userList object
      if (
        !userList
        || (Array.isArray(userList) && userList.length === 0)
        || (userList.users && userList.users.length === 0)
      ) {
        // user not found, create new user
        const randomPassword = crypto.randomBytes(16).toString("hex");
        const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
          email: learner_email,
          password: randomPassword,
          user_metadata: { full_name: learner_name },
          email_confirm: true,
        });

        if (createUserError) {
          errors.push({ row: rowNum, message: `Failed to create user: ${createUserError.message}` });
          continue;
        }

        learner_id = newUser.id;
      } else {
        // user found, assign ID
        learner_id = userList.users ? userList.users[0].id : userList[0].id;
      }

      // Check if enrollment already exists
      const { data: existingEnrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("course_id", course_id)
        .eq("learner_id", learner_id)
        .single();

      if (existingEnrollment) {
        alreadyEnrolled.push(learner_email);
        continue;
      }

      toInsert.push({
        course_id,
        learner_id,
        learner_email,
        learner_name,
        status: "active",
      });
    }

    if (toInsert.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          total_rows: records.length,
          created: 0,
          already_enrolled: alreadyEnrolled.length,
          duplicates: duplicates.length,
          errors: errors.length,
        },
        details: { alreadyEnrolled, duplicates, errors },
      });
    }

    // Insert enrollments
    const { data: inserted, error: insertError } = await supabase
      .from("enrollments")
      .insert(toInsert)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.status(500).json({ error: "Failed to insert enrollments" });
    }

    return res.status(200).json({
      success: true,
      summary: {
        total_rows: records.length,
        created: inserted.length,
        already_enrolled: alreadyEnrolled.length,
        duplicates: duplicates.length,
        errors: errors.length,
      },
      details: { alreadyEnrolled, duplicates, errors },
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
