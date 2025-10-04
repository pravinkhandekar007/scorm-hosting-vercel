async function deleteCourse(courseSlug) {
  if (!confirm("Are you sure you want to delete this course?")) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert("Login required to delete courses.");
    return;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-course?course=${encodeURIComponent(courseSlug)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });
    const result = await response.json();

    if (response.ok) {
      alert("Course deleted successfully.");
      loadCourses(); // refresh the list
    } else {
      alert(`Delete failed: ${result.error || "Unknown error"}`);
    }
  } catch (error) {
    alert("Delete error: " + error.message);
  }
}
