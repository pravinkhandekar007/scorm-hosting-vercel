import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id, email } = req.query;
  
  let query = supabase.from("learners").select("*");

  if (id) {
    query = query.eq("id", id);
  } else if (email) {
    query = query.eq("email", email);
  } else {
    return res.status(400).json({ error: "Missing 'id' or 'email' query parameter." });
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data || []);
}
