/**
 * form-handler.js - PetroData Leave Portal
 * Aligned with Go Backend Struct & UI Spinner Initiative
 */

document.addEventListener("DOMContentLoaded", () => {
  const leaveForm = document.getElementById("leaveForm");
  const startDateInput = document.getElementById("startDate");
  const resumptionDateInput = document.getElementById("resumptionDate");
  const totalDaysInput = document.getElementById("totalDays");
  const nameInput = document.getElementById("staffName");
  const noInput = document.getElementById("staffNo");

  // Spinner Elements
  const submitBtn = document.getElementById("sendRequestBtn");
  const btnText = document.getElementById("btnText");
  const btnIcon = document.getElementById("btnIcon");
  const btnSpinner = document.getElementById("btnSpinner");

  // 1. Auto-fill from LocalStorage (Using keys defined in config.js)
  const savedName = localStorage.getItem(CONFIG.STORAGE.USER_NAME);
  const savedStaffNo = localStorage.getItem(CONFIG.STORAGE.STAFF_NO);

  if (nameInput) {
    nameInput.value = savedName || "";
    nameInput.readOnly = true; // Make it read-only for security
  }
  if (noInput) {
    noInput.value = savedStaffNo || "";
    noInput.readOnly = true; // Make it read-only for security
  }

  // 2. Real-time Calculation Trigger
  const handleDateChange = () => {
    const startVal = startDateInput.value;
    const resumptionVal = resumptionDateInput.value;

    if (startVal && resumptionVal) {
      // Uses utility.js to calculate working days
      const days = Utils.calculateLeaveDays(startVal, resumptionVal);
      totalDaysInput.value = Utils.formatDaysText(days);

      // Visual feedback
      totalDaysInput.classList.toggle("has-value", days > 0);
    }
  };

  // Using 'input' listener for immediate feedback across all browsers
  [startDateInput, resumptionDateInput].forEach((input) => {
    input.addEventListener("input", handleDateChange);
  });

  // 3. Form Submission
  leaveForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem(CONFIG.STORAGE.AUTH_TOKEN);
    if (!token) {
      Swal.fire({
        title: "Session Expired",
        text: "Please login again to continue.",
        icon: "warning",
        confirmButtonColor: "#004d40",
      }).then(() => {
        window.location.href = "login.html";
      });
      return;
    }

    const numericDays = Utils.calculateLeaveDays(
      startDateInput.value,
      resumptionDateInput.value,
    );

    if (numericDays <= 0) {
      Swal.fire(
        "Invalid Dates",
        "Resumption date must be after commencement date.",
        "error",
      );
      return;
    }

    // Prepare Payload
    const payload = {
      designation: document.getElementById("designation").value,
      department: document.getElementById("department").value,
      leave_type: document.getElementById("leaveType").value,
      start_date: startDateInput.value,
      resumption_date: resumptionDateInput.value,
      total_days: parseInt(numericDays),
      relief_staff: document.getElementById("reliefStaff").value,
      contact_address: document.getElementById("contactAddress").value,
      manager_email: document.getElementById("managerEmail").value,
    };

    // --- START LOADING STATE ---
    submitBtn.disabled = true;
    if (btnText) btnText.textContent = "Processing...";
    if (btnIcon) btnIcon.style.display = "none";
    if (btnSpinner) btnSpinner.style.display = "inline-block";

    try {
      const response = await fetch(
        "https://petrodata-portal.onrender.com/api/leave/submit",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (response.ok) {
        const result = await response.json();
        Swal.fire({
          title: "Success!",
          text: result.message || "Request saved and link sent to Manager.",
          icon: "success",
          confirmButtonColor: "#004d40",
        }).then(() => {
          leaveForm.reset();
          totalDaysInput.value = "";
          totalDaysInput.classList.remove("has-value");
          // Re-fill non-form staff details after reset
          if (nameInput) nameInput.value = savedName || "";
          if (noInput) noInput.value = savedStaffNo || "";
        });
      } else if (response.status === 401) {
        localStorage.removeItem(CONFIG.STORAGE.AUTH_TOKEN);
        window.location.href = "login.html";
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server error");
      }
    } catch (error) {
      console.error("Submission Error:", error);
      Swal.fire("Error", error.message || "Submission failed.", "error");
    } finally {
      // --- RESET LOADING STATE ---
      submitBtn.disabled = false;
      if (btnText) btnText.textContent = "Send Request";
      if (btnIcon) btnIcon.style.display = "inline-block";
      if (btnSpinner) btnSpinner.style.display = "none";
    }
  });
});
