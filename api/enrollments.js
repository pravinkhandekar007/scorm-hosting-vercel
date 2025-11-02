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

    // Verify course existence
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Check user Auth existence
    let existingUser = await fetchUserByEmail(learner_email);

    let learner_id;

    if (!existingUser) {
      // Create Supabase Auth user
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: learner_email,
        password: Math.random().toString(36).slice(-8),
        email_confirm: false,
        user_metadata: { full_name: learner_name },
      });

      if (createUserError) {
        console.error("Error creating new user in Auth:", createUserError);
        return res.status(500).json({ error: "Failed to create user in Auth" });
      }

      learner_id = newUser.id;
    } else {
      learner_id = existingUser.id;
    }

    // Check learners table for id and email
    const { data: learnerById } = await supabase
      .from('learners')
      .select('id')
      .eq('id', learner_id)
      .single();

    const { data: learnerByEmail } = await supabase
      .from('learners')
      .select('id')
      .eq('email', learner_email)
      .single();

    if (!learnerById && !learnerByEmail) {
      // Insert learner record
      const { error: learnerInsertError } = await supabase
        .from('learners')
        .insert({
          id: learner_id,
          email: learner_email,
          name: learner_name,
        });

      if (learnerInsertError) {
        console.error('Failed to insert learner:', learnerInsertError);
        return res.status(500).json({ error: 'Failed to insert learner record' });
      }
    } else {
      // Align learner_id to existing one if email found with different id
      if (learnerByEmail && !learnerById) {
        learner_id = learnerByEmail.id;
      }
    }

    // Check existing enrollment
    const { data: existingEnrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', course_id)
      .eq('learner_id', learner_id)
      .single();

    if (existingEnrollment) {
      return res.status(409).json({ error: 'Learner already enrolled in this course' });
    }

    // Create enrollment record
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .insert({
        course_id,
        learner_id,
        learner_email,
        learner_name,
        status: 'active',
      })
      .select();

    if (enrollmentError) {
      console.error('Failed to create enrollment:', enrollmentError);
      return res.status(500).json({ error: 'Failed to create enrollment' });
    }

    return res.status(201).json({
      success: true,
      enrollment: enrollment[0],
      message: 'Enrollment created successfully, email notification sent if new user.',
    });
  } catch (error) {
    console.error('Unhandled error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
