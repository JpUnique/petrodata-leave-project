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

  // New Fields Inputs
  const dateEmployedInput = document.getElementById("dateEmployed");
  const phoneNumberInput = document.getElementById("phoneNumber");
  const allowanceToggle = document.getElementById("allowanceRequest");

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
      date_employed: dateEmployedInput ? dateEmployedInput.value : "", // NEW
      phone_number: phoneNumberInput ? phoneNumberInput.value : "", // NEW
      leave_allowance_request: allowanceToggle
        ? allowanceToggle.checked
        : false, // NEW (Boolean)
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
      const result = await response.json();

      // --- NEW ERROR HANDLING FOR HR POLICY ---
      if (response.status === 400) {
        // Specifically for "Limit Exceeded"
        throw new Error(
          result.error || result.message || "Leave entitlement limit exceeded.",
        );
      } else if (response.status === 403) {
        // Specifically for "Staff not in HR list"
        throw new Error(
          result.error ||
            "Access Denied: You are not registered in the HR Leave Database.",
        );
      } else if (response.status === 401) {
        localStorage.removeItem(CONFIG.STORAGE.AUTH_TOKEN);
        window.location.href = "login.html";
        return;
      } else if (!response.ok) {
        throw new Error(result.error || "Submission failed.");
      }

      // --- SUCCESS CASE ---
      Swal.fire({
        title: "Request Submitted!",
        text:
          result.message ||
          "Your request is within policy and has been sent to your Manager.",
        icon: "success",
        confirmButtonColor: "#004d40",
      }).then(() => {
        leaveForm.reset();
        totalDaysInput.value = "";
        totalDaysInput.classList.remove("has-value");
        if (nameInput) nameInput.value = savedName || "";
        if (noInput) noInput.value = savedStaffNo || "";
      });
    } catch (error) {
      console.error("Submission Error:", error);
      // Enhanced error popup for Policy Violations
      Swal.fire({
        title: "Submission Blocked",
        text: error.message,
        icon: "warning",
        confirmButtonColor: "#b71c1c",
      });
    } finally {
      // --- RESET LOADING STATE ---
      submitBtn.disabled = false;
      if (btnText) btnText.textContent = "Send Request";
      if (btnIcon) btnIcon.style.display = "inline-block";
      if (btnSpinner) btnSpinner.style.display = "none";
    }
  });
});
