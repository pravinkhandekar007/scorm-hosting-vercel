async function deleteCourseBySlug(courseSlug, supabase) {
  try {
    // 1. Fetch course info including storage size and user_id
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, user_id, storage_mb, package_path')
      .eq('course_slug', courseSlug)
      .single();

    if (courseError || !course) {
      throw new Error(`Course not found or error fetching: ${courseError?.message || 'No data'}`);
    }

    // 2. Delete all files associated with the course from Supabase storage
    if (course.package_path) {
      const bucket = supabase.storage.from('scorm-packages');

      const { data: files, error: listError } = await bucket.list(course.package_path, { limit: 1000 });
      if (listError) {
        console.warn('Error listing files for deletion:', listError.message);
        // Optional: you may choose to abort here or continue
      }

      if (files && files.length > 0) {
        const pathsToDelete = files.map(f => `${course.package_path}/${f.name}`);
        const { error: deleteFilesError } = await bucket.remove(pathsToDelete);
        if (deleteFilesError) {
          console.warn('Error deleting stored files:', deleteFilesError.message);
          // Optional: decide if you want to abort or continue deletion process
        }
      }
    }

    // 3. Delete the course metadata record from courses table
    const { error: deleteError } = await supabase
      .from('courses')
      .delete()
      .eq('course_slug', courseSlug);

    if (deleteError) {
      throw new Error(`Failed to delete course metadata: ${deleteError.message}`);
    }

    // 4. Determine the current billing period (monthly)
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

    // 5. Decrement the usage_tracking counters using RPC call, ensuring not going below zero
    const { error: usageError } = await supabase.rpc('decrement_usage_tracking', {
      p_user_id: course.user_id,
      p_period_start: periodStart.toISOString(),
      p_period_end: periodEnd.toISOString(),
      p_storage: course.storage_mb || 0,
      p_courses: 1
    });

    if (usageError) {
      console.warn('Failed to decrement usage_tracking counters:', usageError.message);
      // Consider logging to your monitoring or alerting system
    }

    return { success: true, message: 'Course deleted and usage tracking updated.' };

  } catch (error) {
    console.error('Error in deleteCourseBySlug:', error.message);
    return { success: false, error: error.message };
  }
}
