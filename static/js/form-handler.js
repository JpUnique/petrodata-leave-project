document.addEventListener("DOMContentLoaded", () => {
  // 1. DATA SELECTORS
  const leaveForm = document.getElementById("leaveForm");
  const startDate = document.getElementById("startDate");
  const resumptionDate = document.getElementById("resumptionDate");
  const totalDays = document.getElementById("totalDays");

  // 2. AUTH CHECK & AUTO-FILL
  // Pull data saved during Signup/Login from localStorage
  const savedName = localStorage.getItem("userName");
  const savedEmail = localStorage.getItem("userEmail");

  if (savedName) {
    const staffNameInput = document.getElementById("staffName");
    if (staffNameInput) {
      staffNameInput.value = savedName;
      staffNameInput.readOnly = true; // Protect official name
    }
  } else {
    // Guard: If no user is found in storage, send them back to login
    alert("Session not found. Please login first.");
    window.location.href = "login.html";
    return;
  }

  // 3. DATE CALCULATION LOGIC
  function updateDays() {
    if (startDate.value && resumptionDate.value) {
      const start = new Date(startDate.value);
      const end = new Date(resumptionDate.value);

      // Calculate difference in milliseconds
      const diff = end - start;
      // Convert to days
      const days = diff / (1000 * 60 * 60 * 24);

      if (days > 0) {
        totalDays.value = `${days} Working Days`;
      } else {
        totalDays.value = "Invalid Dates";
      }
    }
  }

  // Listen for date changes
  if (startDate && resumptionDate) {
    startDate.addEventListener("change", updateDays);
    resumptionDate.addEventListener("change", updateDays);
  }

  // 4. FORM SUBMISSION (BACKEND CONNECTION)
  if (leaveForm) {
    leaveForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Gather all form data into a JSON object
      const leaveRequestData = {
        staff_name: document.getElementById("staffName").value,
        staff_no: document.getElementById("staffNo").value,
        designation: document.getElementById("designation").value,
        department: document.getElementById("department").value,
        leave_type: document.getElementById("leaveType").value,
        start_date: startDate.value,
        resumption_date: resumptionDate.value,
        relief_staff: document.getElementById("reliefStaff").value,
        contact_address: document.getElementById("contactAddress").value,
        manager_email: document.getElementById("managerEmail").value,
        status: "Pending", // Default status
      };

      try {
        // Send the data to your Go API endpoint
        const response = await fetch("/api/leave/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(leaveRequestData),
        });

        if (response.ok) {
          const result = await response.json();
          alert("Success: " + result.message);

          // Optional: Reset form or redirect to a 'Success' page
          leaveForm.reset();
          // Keep the name filled after reset
          document.getElementById("staffName").value = savedName;
        } else {
          const errorText = await response.text();
          alert("Submission Failed: " + errorText);
        }
      } catch (err) {
        console.error("Submission Error:", err);
        alert(
          "Could not connect to the server.",
        );
      }
    });
  }
});
