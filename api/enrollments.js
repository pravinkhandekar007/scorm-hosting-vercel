import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchUserByEmail(email) {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      headers: {
        apiKey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data && data.users && data.users.length > 0) {
      return data.users[0];
    }
    return null;
  } catch (error) {
    console.error("Error fetching user by email via REST admin API:", error);
    return null;
  }
}

export default async function handler(req, res) {
  // Add your CORS headers here if needed

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

    // Check course existence
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Check user existence in Auth
    let existingUser = await fetchUserByEmail(learner_email);

    let learner_id;

    if (!existingUser) {
      // create new user
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: learner_email,
        password: Math.random().toString(36).slice(-8),
        email_confirm: false,
        user_metadata: { full_name: learner_name },
      });

      if (createUserError) {
        console.error("Error creating new user:", createUserError);
        return res.status(500).json({ error: "Failed to create user in Auth" });
      }
      learner_id = newUser.id;
    } else {
      learner_id = existingUser.id;
    }

    // Ensure learner exists in learners table
    const { data: learnerInTable } = await supabase
      .from("learners")
      .select("id")
      .eq("email", learner_email)
      .single();

    if (!learnerInTable) {
      // Insert learner without id (auto-generated)
      const { data: newLearner, error: learnerInsertError } = await supabase
        .from("learners")
        .insert({
          email: learner_email,
          name: learner_name,
        })
        .select('id')
        .single();

      if (learnerInsertError) {
        console.error("Error inserting learner:", learnerInsertError);
        return res.status(500).json({ error: `Failed to insert learner record: ${learnerInsertError.message}` });
      }

      learner_id = newLearner.id; // update learner_id with inserted learner's id
    } else {
      learner_id = learnerInTable.id;
    }

    // Check for existing enrollment
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

    // Insert new enrollment
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
      console.error("Error creating enrollment:", enrollmentError);
      return res.status(500).json({ error: "Failed to create enrollment" });
    }

    return res.status(201).json({
      success: true,
      enrollment: enrollment[0],
      message: "Enrollment created, email notification sent if new user.",
    });
  } catch (error) {
    console.error("Unhandled error in enrollments API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
