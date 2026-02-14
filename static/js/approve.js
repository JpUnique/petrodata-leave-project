document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  if (!token) {
    showError("Invalid access link. No security token provided.");
    return;
  }

  try {
    // 1. Fetch details from Go Backend
    const response = await fetch(`/api/leave/details?token=${token}`);

    if (!response.ok) {
      throw new Error("Leave request not found or the link has expired.");
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
  // Mapping the JSON fields from your Go Model to the HTML IDs
  document.getElementById("displayStaffName").textContent = data.staff_name;
  document.getElementById("displayStaffNo").textContent = data.staff_no;
  document.getElementById("displayDesignation").textContent = data.designation; // Updated
  document.getElementById("displayDept").textContent = data.department;
  document.getElementById("displayType").textContent = data.leave_type;
  document.getElementById("displayStart").textContent = data.start_date;
  document.getElementById("displayEnd").textContent = data.resumption_date;
  document.getElementById("displayTotalDays").textContent =
    `${data.total_days} Working Days`;
  document.getElementById("displayRelief").textContent = data.relief_staff;
  document.getElementById("displayAddress").textContent = data.contact_address; // Updated
  document.getElementById("currentStatus").textContent = data.status;

  // Handle Logic for processed requests
  if (data.status !== "Pending") {
    document.getElementById("actionButtons").classList.add("hidden");
    const banner = document.getElementById("statusMessage");
    banner.classList.remove("hidden");
    banner.textContent = `Notification: This request was ${data.status.toLowerCase()} on ${new Date(data.created_at).toLocaleDateString()}.`;
  }
}

// Function to handle the Approve/Reject clicks
function setupActionButtons(token, staffName) {
  const approveBtn = document.getElementById("approveBtn");
  const rejectBtn = document.getElementById("rejectBtn");

  approveBtn.addEventListener("click", () =>
    processDecision(token, "Approved", staffName),
  );
  rejectBtn.addEventListener("click", () =>
    processDecision(token, "Rejected", staffName),
  );
}

async function processDecision(token, decision, staffName) {
  const confirmResult = await Swal.fire({
    title: `Confirm ${decision}?`,
    text: `Are you sure you want to ${decision.toLowerCase()} the leave request for ${staffName}?`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: decision === "Approved" ? "#00c853" : "#ff5252",
    cancelButtonColor: "#888",
    confirmButtonText: `Yes, ${decision}!`,
  });

  if (confirmResult.isConfirmed) {
    try {
      // 1. Call the Go Backend API
      const response = await fetch("/api/leave/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token,
          status: decision,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update the request status on the server.");
      }

      // 2. Show Success Message
      await Swal.fire({
        icon: "success",
        title: decision,
        text: `The request for ${staffName} has been ${decision.toLowerCase()} and forwarded.`,
        confirmButtonColor: "#004d40",
      });

      // 3. Refresh the page to hide buttons and show the new status
      window.location.reload();
    } catch (err) {
      console.error("Action Error:", err);
      Swal.fire(
        "Error",
        "Could not process decision. Check your server terminal.",
        "error",
      );
    }
  }
}

function showError(msg) {
  // Use SweetAlert for a cleaner error display
  Swal.fire({
    icon: "error",
    title: "Access Denied",
    text: msg,
    confirmButtonColor: "#004d40",
  });
}
