async function deleteCourseBySlug(courseSlug, supabase) {
  try {
    console.log(`Starting delete process for courseSlug: ${courseSlug}`);

    // 1. Fetch course info including storage size and user_id
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, user_id, storage_mb, package_path')
      .eq('course_slug', courseSlug)
      .single();

    if (courseError || !course) {
      throw new Error(`Course not found or error fetching: ${courseError?.message || 'No data'}`);
    }
    console.log(`Fetched course data: user_id=${course.user_id}, storage_mb=${course.storage_mb}, package_path=${course.package_path}`);

    // 2. Delete all files associated with the course from Supabase storage
    if (course.package_path) {
      const bucket = supabase.storage.from('scorm-packages');

      console.log(`Listing files for deletion in storage path: ${course.package_path}`);
      const { data: files, error: listError } = await bucket.list(course.package_path, { limit: 1000 });
      if (listError) {
        console.warn('Error listing files for deletion:', listError.message);
        // You can decide to abort here or continue gracefully
      }

      if (files && files.length > 0) {
        const pathsToDelete = files.map(f => `${course.package_path}/${f.name}`);
        console.log(`Deleting files: ${pathsToDelete.join(', ')}`);
        const { error: deleteFilesError } = await bucket.remove(pathsToDelete);
        if (deleteFilesError) {
          console.warn('Error deleting stored files:', deleteFilesError.message);
          // You can decide to abort here or continue gracefully
        } else {
          console.log('Storage files deleted successfully.');
        }
      } else {
        console.log('No files found to delete in storage.');
      }
    } else {
      console.log('No package_path specified, skipping file deletion.');
    }

    // 3. Delete the course metadata record from courses table
    console.log('Deleting course metadata from database...');
    const { error: deleteError } = await supabase
      .from('courses')
      .delete()
      .eq('course_slug', courseSlug);

    if (deleteError) {
      throw new Error(`Failed to delete course metadata: ${deleteError.message}`);
    }
    console.log('Course metadata deleted successfully.');

    // 4. Determine the current billing period (UTC month)
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    console.log(`Billing period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

    // 5. Decrement the usage_tracking counters using RPC call
    console.log('Calling decrement_usage_tracking RPC...');
    const { error: usageError } = await supabase.rpc('decrement_usage_tracking', {
      p_user_id: course.user_id,
      p_period_start: periodStart.toISOString(),
      p_period_end: periodEnd.toISOString(),
      p_storage: course.storage_mb || 0,
      p_courses: 1
    });

    if (usageError) {
      console.warn('Failed to decrement usage_tracking counters:', usageError.message);
    } else {
      console.log('decrement_usage_tracking RPC call succeeded.');
    }

    console.log('Delete process completed successfully.');
    return { success: true, message: 'Course deleted and usage tracking updated.' };

  } catch (error) {
    console.error('Error in deleteCourseBySlug:', error.message);
    return { success: false, error: error.message };
  }
}
