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
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error, { id });
    return res.status(500).json({ error: error.message, detail: error.details || null, hint: error.hint || null });
  }

  if (!data) {
    console.log('No profile found for id:', id);
    return res.status(200).json([]);
  }

  console.log('Profile fetched:', data);
  return res.status(200).json([data]);
}
