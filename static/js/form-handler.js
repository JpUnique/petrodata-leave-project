document.addEventListener("DOMContentLoaded", () => {
  // 1. DATA SELECTORS
  const leaveForm = document.getElementById("leaveForm");
  const startDate = document.getElementById("startDate");
  const resumptionDate = document.getElementById("resumptionDate");
  const totalDays = document.getElementById("totalDays");

  // Helper function for consistent PetroData styling
  const toast = (icon, title, text) => {
    return Swal.fire({
      icon: icon,
      title: title,
      text: text,
      confirmButtonColor: icon === 'success' ? '#00e676' : '#ff4d4d',
    });
  };

  // 2. AUTH CHECK & AUTO-FILL
  const savedName = localStorage.getItem("userName");
  const savedEmail = localStorage.getItem("userEmail");

  if (savedName) {
    const staffNameInput = document.getElementById("staffName");
    if (staffNameInput) {
      staffNameInput.value = savedName;
      staffNameInput.readOnly = true;
    }
  } else {
    // Replaced local alert with SweetAlert2
    Swal.fire({
      icon: 'warning',
      title: 'Session Expired',
      text: 'Please login to access the portal.',
      confirmButtonColor: '#ff4d4d'
    }).then(() => {
      window.location.href = "login.html";
    });
    return;
  }

  // 3. DATE CALCULATION LOGIC
  function updateDays() {
    if (startDate.value && resumptionDate.value) {
      const start = new Date(startDate.value);
      const end = new Date(resumptionDate.value);

      const diff = end - start;
      const days = diff / (1000 * 60 * 60 * 24);

      if (days > 0) {
        totalDays.value = `${days} Working Days`;
      } else if (days === 0) {
        totalDays.value = "1 Working Day";
      } else {
        totalDays.value = "Invalid Dates";
      }
    }
  }

  if (startDate && resumptionDate) {
    startDate.addEventListener("change", updateDays);
    resumptionDate.addEventListener("change", updateDays);
  }

  // 4. FORM SUBMISSION (BACKEND CONNECTION)
  if (leaveForm) {
    leaveForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      //calculate total days before submission
      const start = new Date(startDate.value);
      const end = new Date(resumptionDate.value);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const leaveRequestData = {
        staff_name: document.getElementById("staffName").value,
        staff_no: document.getElementById("staffNo").value,
        designation: document.getElementById("designation").value,
        department: document.getElementById("department").value,
        leave_type: document.getElementById("leaveType").value,
        start_date: startDate.value,
        resumption_date: resumptionDate.value,
        total_days: diffDays > 0 ? diffDays : 1,
        relief_staff: document.getElementById("reliefStaff").value,
        contact_address: document.getElementById("contactAddress").value,
        manager_email: document.getElementById("managerEmail").value,
        status: "Pending",
      };

      try {
        const response = await fetch("/api/leave/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leaveRequestData),
        });

        if (response.ok) {
          const result = await response.json();

          // Replaced local alert with SweetAlert2 success
          Swal.fire({
            icon: 'success',
            title: 'Request Submitted',
            text: result.message || 'Your leave request has been sent to your manager.',
            confirmButtonColor: '#00e676'
          }).then(() => {
            leaveForm.reset();
            // Restore auto-filled name after reset
            document.getElementById("staffName").value = savedName;
          });

        } else {
          const errorText = await response.text();
          toast("error", "Submission Failed", errorText);
        }
      } catch (err) {
        console.error("Submission Error:", err);
        toast("error", "Server Error", "Could not connect to the PetroData server.");
      }
    });
  }
});