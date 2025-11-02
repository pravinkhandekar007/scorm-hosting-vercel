import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Expects API call to /api/profiles?id=USER_ID
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing 'id' query param." });

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json(data || []);
}
