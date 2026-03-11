/**
 * form-handler.js - PetroData Leave Portal
 * Aligned with Go Backend Struct: StaffName, StaffNo, etc.
 */

document.addEventListener("DOMContentLoaded", () => {
  const leaveForm = document.getElementById("leaveForm");
  const startDateInput = document.getElementById("startDate");
  const resumptionDateInput = document.getElementById("resumptionDate");
  const totalDaysInput = document.getElementById("totalDays");
  const staffName = localStorage.getItem(CONFIG.STORAGE.USER_NAME);
  const staffNo = localStorage.getItem(CONFIG.STORAGE.STAFF_NO);

  document.getElementById("displayStaffName").textContent = staffName || "User";
  document.getElementById("displayStaffNo").textContent = staffNo || "N/A";

  // --- 1. Real-time Calculation Trigger ---
  const handleDateChange = () => {
    const startVal = startDateInput.value;
    const resumptionVal = resumptionDateInput.value;

    if (startVal && resumptionVal) {
      // Uses utility.js to calculate working days (excluding weekends & resumption day)
      const days = Utils.calculateLeaveDays(startVal, resumptionVal);
      totalDaysInput.value = Utils.formatDaysText(days);

      // Visual feedback: highlights the field when a value exists
      totalDaysInput.classList.toggle("has-value", days > 0);
    }
  };

  [startDateInput, resumptionDateInput].forEach((input) => {
    input.addEventListener("change", handleDateChange);
  });

  // --- 2. Form Submission ---
  leaveForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Check authentication first
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

    // Recalculate pure integer for the backend
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

    // --- PAYLOAD: Only send fields backend needs from form ---
    // Backend gets staff_name, staff_email, staff_no from JWT token
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
      // REMOVED: staff_name, staff_email, staff_no (backend gets from JWT)
    };

    console.log("Sending Payload to Backend:", payload);

    try {
      const response = await fetch(
        "https://petrodata-portal.onrender.com/api/leave/submit", // Fixed: removed space
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // ← ADD THIS
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
        });
      } else if (response.status === 401) {
        // Token expired or invalid
        Swal.fire({
          title: "Session Expired",
          text: "Your session has expired. Please login again.",
          icon: "warning",
          confirmButtonColor: "#004d40",
        }).then(() => {
          localStorage.removeItem(CONFIG.STORAGE.AUTH_TOKEN);
          window.location.href = "login.html";
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server error");
      }
    } catch (error) {
      console.error("Submission Error:", error);
      Swal.fire("Error", error.message || "Submission failed.", "error");
    }
  });
});
