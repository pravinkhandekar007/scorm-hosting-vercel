async function deleteCourseBySlug(courseSlug, supabase) {
  // 1. Get course info with storage size and user
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, user_id, storage_mb')
    .eq('course_slug', courseSlug)
    .single();

  if (courseError) throw new Error('Course not found or error fetching');

  // 2. Delete files from storage bucket if needed...
  // (Your existing logic here)

  // 3. Delete course metadata
  const { error: deleteError } = await supabase
    .from('courses')
    .delete()
    .eq('course_slug', courseSlug);

  if (deleteError) throw new Error('Failed to delete course metadata');

  // 4. Calculate billing period
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

  // 5. Call decrement_usage_tracking RPC
  const { error: usageError } = await supabase.rpc('decrement_usage_tracking', {
    p_user_id: course.user_id,
    p_period_start: periodStart.toISOString(),
    p_period_end: periodEnd.toISOString(),
    p_storage: course.storage_mb || 0,
    p_courses: 1
  });

  if (usageError) {
    console.warn('Failed to decrement usage_tracking:', usageError.message);
  }

  return true;
}
