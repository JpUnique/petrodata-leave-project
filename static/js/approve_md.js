const CONFIG = {
  API: {
    FETCH_DETAILS: "/api/leave/md-details",
    SUBMIT_ACTION: "/api/leave/md-action",
  },
  STATUS: {
    PENDING_MD_REVIEW: "Pending MD Review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  },
  COLORS: {
    SUCCESS: "#00c853",
    ERROR: "#ff5252",
    NEUTRAL: "#888",
    PRIMARY: "#004d40",
  },
  MESSAGES: {
    INVALID_TOKEN: "Invalid access link. No security token provided.",
    FETCH_ERROR: "Leave request not found or the MD link has expired.",
    ACTION_FAILED: "Failed to finalize request on the server.",
    SYSTEM_ERROR: "System configuration error.",
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getElement(id) {
  const element = document.getElementById(id);
  if (!element) console.warn(`Element with ID '${id}' not found`);
  return element;
}

function showError(message) {
  Swal.fire({
    icon: "error",
    title: "Access Denied",
    text: message,
    confirmButtonColor: CONFIG.COLORS.PRIMARY,
  });
}

function showSuccess(title, message) {
  return Swal.fire({
    icon: "success",
    title,
    text: message,
    confirmButtonColor: CONFIG.COLORS.PRIMARY,
  });
}

function getUrlParameter(param) {
  return new URLSearchParams(window.location.search).get(param);
}

function getDecisionColor(decision) {
  return decision === CONFIG.STATUS.APPROVED
    ? CONFIG.COLORS.SUCCESS
    : CONFIG.COLORS.ERROR;
}

// ============================================================================
// DOM POPULATION
// ============================================================================

function populateUI(data) {
  if (!data) return;

  const fieldMapping = {
    displayStaffName: "staff_name",
    displayStaffNo: "staff_no",
    displayDesignation: "designation",
    displayDept: "department",
    displayPhone: "phone_number",
    displayDateEmployed: "date_employed",
    displayType: "leave_type",
    displayStart: "start_date",
    displayEnd: "resumption_date",
    displayRelief: "relief_staff",
    displayAddress: "contact_address",
  };

  Object.entries(fieldMapping).forEach(([id, key]) => {
    const el = getElement(id);
    if (el) el.textContent = data[key] || "N/A";
  });

  const totalDaysEl = getElement("displayTotalDays");
  if (totalDaysEl) {
    totalDaysEl.textContent = `${data.total_days || 0} Working Days`;
  }

  displayAuditTrail(data);
}

function displayAuditTrail(data) {
  const managerField = getElement("displayManagerDecision");
  if (managerField) {
    const decision = data.manager_decision || "Pending";
    managerField.textContent = decision;
    managerField.style.color = getDecisionColor(decision);
  }

  const hrField = getElement("displayHRDecision");
  if (hrField) {
    const decision = data.resource_decision || "Pending";
    hrField.textContent = decision;
    hrField.style.color = getDecisionColor(decision);
  }
}

// ============================================================================
// ACTION PROCESSING
// ============================================================================

function toggleLoading(decision, isLoading) {
  const isApprove = decision === CONFIG.STATUS.APPROVED;
  const btn = getElement(isApprove ? "approveBtn" : "rejectBtn");
  const icon = getElement(isApprove ? "approveIcon" : "rejectIcon");
  const spinner = getElement(isApprove ? "approveSpinner" : "rejectSpinner");

  if (!btn) return;
  btn.disabled = isLoading;

  if (isLoading) {
    if (icon) icon.style.display = "none";
    if (spinner) spinner.style.display = "inline-block";
    btn.style.opacity = "0.7";
  } else {
    if (icon) icon.style.display = "inline-block";
    if (spinner) spinner.style.display = "none";
    btn.style.opacity = "1";
  }
}

async function processFinalDecision(token, decision, staffName) {
  // Simple confirmation for both Approve and Reject
  const confirmResult = await Swal.fire({
    title: `Confirm ${decision}?`,
    text: `Are you sure you want to ${decision.toLowerCase()} the request for ${staffName}?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: getDecisionColor(decision),
    cancelButtonColor: CONFIG.COLORS.NEUTRAL,
    confirmButtonText: "Yes, Finalize",
  });

  if (!confirmResult.isConfirmed) return;

  toggleLoading(decision, true);

  try {
    const response = await fetch(CONFIG.API.SUBMIT_ACTION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: token,
        status: decision,
        reason: "", // Sending empty string to satisfy the struct
      }),
    });

    const result = await response.json();

    if (!response.ok)
      throw new Error(result.error || CONFIG.MESSAGES.ACTION_FAILED);

    await showSuccess("Success", `Request has been ${decision.toLowerCase()}.`);
    window.location.reload();
  } catch (error) {
    showError(error.message);
    toggleLoading(decision, false);
  }
}
// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  const token = getUrlParameter("director_token");

  if (!token) {
    showError(CONFIG.MESSAGES.INVALID_TOKEN);
    return;
  }

  try {
    const response = await fetch(`${CONFIG.API.FETCH_DETAILS}?token=${token}`);
    if (!response.ok) throw new Error(CONFIG.MESSAGES.FETCH_ERROR);

    const data = await response.json();
    populateUI(data);

    // Bind Event Listeners
    const approveBtn = getElement("approveBtn");
    const rejectBtn = getElement("rejectBtn");

    if (approveBtn) {
      approveBtn.onclick = () =>
        processFinalDecision(token, CONFIG.STATUS.APPROVED, data.staff_name);
    }
    if (rejectBtn) {
      rejectBtn.onclick = () =>
        processFinalDecision(token, CONFIG.STATUS.REJECTED, data.staff_name);
    }
  } catch (error) {
    showError(error.message);
  }
});
