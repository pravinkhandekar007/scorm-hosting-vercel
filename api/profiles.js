import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  console.log('profiles.js API called with id:', id);

  if (!id) {
    console.log('Missing id param in request');
    return res.status(400).json({ error: "Missing 'id' query param." });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: error.message });
  }

  console.log('Profile fetched:', data);

  // Return as array for compatibility with frontend handling
  res.status(200).json(data ? [data] : []);
}
