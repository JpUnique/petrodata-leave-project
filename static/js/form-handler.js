/**
 * form-handler.js - PetroData Leave Portal
 * Aligned with Go Backend Struct: StaffName, StaffNo, etc.
 */

document.addEventListener("DOMContentLoaded", () => {
  const leaveForm = document.getElementById("leaveForm");
  const startDateInput = document.getElementById("startDate");
  const resumptionDateInput = document.getElementById("resumptionDate");
  const totalDaysInput = document.getElementById("totalDays");

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

    // --- MATCHING GO STRUCT JSON TAGS ---
    const payload = {
      staff_name: document.getElementById("staffName").value,
      staff_no: document.getElementById("staffNo").value,
      designation: document.getElementById("designation").value,
      department: document.getElementById("department").value,
      leave_type: document.getElementById("leaveType").value,
      start_date: startDateInput.value,
      resumption_date: resumptionDateInput.value,
      total_days: parseInt(numericDays), // Sent as an INT to match your Go model
      relief_staff: document.getElementById("reliefStaff").value,
      contact_address: document.getElementById("contactAddress").value,
      manager_email: document.getElementById("managerEmail").value,
    };

    console.log("Sending Payload to Backend:", payload);

    try {
      // Updated to your local hosting URL
      const response = await fetch("http://localhost:8080/api/leave/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Swal.fire({
          title: "Success!",
          text: "Request saved and link sent to Manager.",
          icon: "success",
          confirmButtonColor: "#004d40",
        }).then(() => {
          leaveForm.reset();
          totalDaysInput.value = "";
          totalDaysInput.classList.remove("has-value");
        });
      } else {
        const errorText = await response.text();
        throw new Error(errorText || "Server error");
      }
    } catch (error) {
      console.error("Submission Error:", error);
      Swal.fire(
        "Error",
        "Submission failed. Ensure your Go server is running on port 8080.",
        "error",
      );
    }
  });
});
