async function verifyStudent(id) {
    if (!confirm("Are you sure you want to verify this student?")) return;

    try {
        const response = await fetch(`/api/verify-student/${id}`, {
            method: 'POST'
        });

        if (response.ok) {
            alert("Student verified successfully!");
            location.reload(); // Refresh the list to show the new status
        } else {
            alert("Failed to verify student.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}