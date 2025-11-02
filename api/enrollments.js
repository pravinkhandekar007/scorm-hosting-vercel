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
      console.log(`fetchUserByEmail: No user found for email ${email}. Status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data && data.users && data.users.length > 0) {
      console.log(`fetchUserByEmail: Found user with id ${data.users[0].id} for email ${email}`);
      return data.users[0];
    }
    return null;
  } catch (error) {
    console.error(`fetchUserByEmail: Error fetching user by email ${email}:`, error);
    return null;
  }
}

async function inviteUser(email, fullName) {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/invite`, {
      method: "POST",
      headers: {
        apiKey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        data: { full_name: fullName },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`inviteUser: Invite failed for email ${email}, Status: ${response.status}, Response: ${errorText}`);
      throw new Error(`Failed to invite user: ${errorText}`);
    }

    const invitedUser = await response.json();
    console.log(`inviteUser: Invited user with id ${invitedUser.id} email ${email}`);
    return invitedUser;
  } catch (error) {
    console.error(`inviteUser: Error inviting user with email ${email}:`, error);
    throw error;
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

    console.log(`Received request to enroll learner: ${learner_email} into course: ${course_id}`);

    // Verify course exists
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      console.log(`Course not found: ${course_id}`);
      return res.status(404).json({ error: "Course not found" });
    }

    // Check user existence in Auth
    let user = await fetchUserByEmail(learner_email);

    let learner_id;

    if (!user) {
      // User does not exist, send invite email
      try {
        const invitedUser = await inviteUser(learner_email, learner_name);
        learner_id = invitedUser.id;
      } catch (error) {
        console.log(`Failed to invite user ${learner_email}, retry fetch`);
        // Try fetch user again, user may exist
        user = await fetchUserByEmail(learner_email);
        if (!user) {
          return res.status(500).json({ error: `Failed to invite user or find existing user with email ${learner_email}` });
        }
        learner_id = user.id;
      }
    } else {
      learner_id = user.id;
    }

    console.log(`Using learner_id: ${learner_id} to check existing enrollments`);

    // Ensure learner present in learners table
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
        console.error(`Failed to insert learner record for ID ${learner_id}:`, learnerInsertError);
        return res.status(500).json({ error: "Failed to insert learner record" });
      }
      console.log(`Inserted new learner record for ID ${learner_id}`);
    }

    // Check existing enrollment
    const { data: existingEnrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("course_id", course_id)
      .eq("learner_id", learner_id)
      .single();

    if (existingEnrollment) {
      console.log(`Learner ${learner_email} is already enrolled in course ${course_id}`);
      return res.status(409).json({ error: "Learner already enrolled in this course" });
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
      console.error(`Failed to create enrollment for learner ${learner_email}:`, enrollmentError);
      return res.status(500).json({ error: "Failed to create enrollment" });
    }

    console.log(`Enrollment created successfully for learner ${learner_email} in course ${course_id}`);

    return res.status(201).json({
      success: true,
      enrollment: enrollment[0],
      message: "Enrollment created and invite sent if applicable.",
    });
  } catch (error) {
    console.error("Unhandled error in enrollment API:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
