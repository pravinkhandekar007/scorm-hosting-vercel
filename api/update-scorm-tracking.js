import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4?bundle";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      enrollment_id,
      course_id,
      learner_id,
      scorm_version = "1.2",
      session_id,
      cmi_data = {}
    } = body;

    if (!enrollment_id || !course_id || !learner_id) {
      throw new Error("Missing required fields: enrollment_id, course_id, learner_id");
    }

    // Confirm enrollment exists
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("*")
      .eq("id", enrollment_id)
      .eq("course_id", course_id)
      .eq("learner_id", learner_id)
      .single();

    if (enrollmentError || !enrollment) {
      throw new Error("Enrollment record not found or mismatched");
    }

    // Map SCORM fields to table columns (extend this as per your schema)
    let mappedData = {
      enrollment_id,
      course_id,
      learner_id,
      scorm_version,
      session_id,
      cmi_core_score_raw: cmi_data["cmi.core.score.raw"] || null,
      cmi_core_lesson_status: cmi_data["cmi.core.lesson_status"] || null,
      cmi_core_suspend_data: cmi_data["cmi.suspend_data"] || null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    // Insert into scorm_tracking
    const { error: insertError } = await supabase
      .from("scorm_tracking")
      .insert(mappedData);

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, message: "Tracking data saved" }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
