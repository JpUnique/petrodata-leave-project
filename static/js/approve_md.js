document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  if (!token) {
    showError("Invalid access link. No security token provided.");
    return;
  }

  try {
    const response = await fetch(`/api/leave/md-details?token=${token}`);
    if (!response.ok)
      throw new Error("Leave request not found or MD link expired.");
    const data = await response.json();
    populateUI(data);
    setupActionButtons(token, data.staff_name);
  } catch (err) {
    showError(err.message);
  }
});

function populateUI(data) {
  // Standard Fields
  document.getElementById("displayStaffName").textContent = data.staff_name;
  document.getElementById("displayStaffNo").textContent = data.staff_no;
  document.getElementById("displayType").textContent = data.leave_type;
  document.getElementById("displayStart").textContent = data.start_date;
  document.getElementById("displayEnd").textContent = data.resumption_date;
  document.getElementById("displayTotalDays").textContent =
    `${data.total_days} Working Days`;
  document.getElementById("currentStatus").textContent = data.status;

  // --- CHAIN OF CUSTODY: SHOW MANAGER & HR DECISIONS ---
  const mgrField = document.getElementById("displayManagerDecision");
  mgrField.textContent = data.manager_decision;
  mgrField.style.color =
    data.manager_decision === "Approved" ? "#00c853" : "#ff5252";

  const hrField = document.getElementById("displayHRDecision");
  hrField.textContent = data.hr_decision;
  hrField.style.color = data.hr_decision === "Approved" ? "#00c853" : "#ff5252";

  // Hide buttons if MD has already finished
  if (data.status === "Approved" || data.status === "Rejected") {
    document.getElementById("actionButtons").classList.add("hidden");
    const banner = document.getElementById("statusMessage");
    banner.classList.remove("hidden");
    banner.textContent = `Notification: This request is finalized as '${data.status}'.`;
  }
}

function setupActionButtons(token, staffName) {
  document
    .getElementById("approveBtn")
    .addEventListener("click", () => processFinalDecision(token, "Approved"));
  document
    .getElementById("rejectBtn")
    .addEventListener("click", () => processFinalDecision(token, "Rejected"));
}

async function processFinalDecision(token, decision) {
  const confirmResult = await Swal.fire({
    title: `Final Decision: ${decision}`,
    text: "Are you sure? This will finalize the leave request.",
    icon: "warning",
    showCancelButton: true,
  });

  if (confirmResult.isConfirmed) {
    try {
      const response = await fetch("/api/leave/md-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token, status: decision }),
      });

      if (!response.ok) throw new Error("Failed to finalize request.");

      await Swal.fire(
        "Finalized",
        `The request has been ${decision.toLowerCase()}.`,
        "success",
      );
      window.location.reload();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  }
}

function showError(msg) {
  Swal.fire({
    icon: "error",
    title: "Denied",
    text: msg,
    confirmButtonColor: "#004d40",
  });
}
