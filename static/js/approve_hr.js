document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  if (!token) {
    showError("Invalid access link. No security token provided.");
    return;
  }

  try {
    // 1. Fetch details from HR-specific endpoint
    const response = await fetch(`/api/leave/hr-details?token=${token}`);

    if (!response.ok) {
      throw new Error("Leave request not found or the HR link has expired.");
    }

    const data = await response.json();

    // 2. Populate the UI
    populateUI(data);

    // 3. Setup Button Listeners
    setupActionButtons(token, data.staff_name);
  } catch (err) {
    console.error("Fetch Error:", err);
    showError(err.message);
  }
});

function populateUI(data) {
  // Standard Staff Details
  document.getElementById("displayStaffName").textContent = data.staff_name;
  document.getElementById("displayStaffNo").textContent = data.staff_no;
  document.getElementById("displayDesignation").textContent = data.designation;
  document.getElementById("displayDept").textContent = data.department;
  document.getElementById("displayType").textContent = data.leave_type;
  document.getElementById("displayStart").textContent = data.start_date;
  document.getElementById("displayEnd").textContent = data.resumption_date;
  document.getElementById("displayTotalDays").textContent =
    `${data.total_days} Working Days`;
  document.getElementById("displayRelief").textContent = data.relief_staff;
  document.getElementById("displayAddress").textContent = data.contact_address;
  document.getElementById("currentStatus").textContent = data.status;

  // --- CHAIN OF CUSTODY: SHOW MANAGER DECISION ---
  const managerDecisionField = document.getElementById(
    "displayManagerDecision",
  );
  managerDecisionField.textContent = data.manager_decision;
  managerDecisionField.style.color =
    data.manager_decision === "Approved" ? "#00c853" : "#ff5252";

  // Handle Logic for already processed HR requests
  if (data.status !== "Pending HR Review") {
    document.getElementById("actionButtons").classList.add("hidden");
    document.getElementById("mdEmailContainer").classList.add("hidden");
    const banner = document.getElementById("statusMessage");
    banner.classList.remove("hidden");
    banner.textContent = `Notification: HR has already processed this as '${data.hr_decision}'.`;
  }
}

function setupActionButtons(token, staffName) {
  document
    .getElementById("approveBtn")
    .addEventListener("click", () =>
      processDecision(token, "Approved", staffName),
    );
  document
    .getElementById("rejectBtn")
    .addEventListener("click", () =>
      processDecision(token, "Rejected", staffName),
    );
}

async function processDecision(token, decision, staffName) {
  const mdEmail = document.getElementById("mdEmail").value.trim();

  if (!mdEmail) {
    Swal.fire(
      "MD Email Required",
      "Please enter the MD's email to forward this request.",
      "warning",
    );
    return;
  }

  const confirmResult = await Swal.fire({
    title: `Confirm HR ${decision}?`,
    text: `Forwarding decision to MD (${mdEmail})`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: decision === "Approved" ? "#00c853" : "#ff5252",
  });

  if (confirmResult.isConfirmed) {
    try {
      const response = await fetch("/api/leave/hr-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token,
          status: decision,
          md_email: mdEmail,
        }),
      });

      if (!response.ok) throw new Error("Failed to process HR action.");

      await Swal.fire("Success", `Request forwarded to MD.`, "success");
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
