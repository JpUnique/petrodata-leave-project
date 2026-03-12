/**
 * approve_md.js - Managing Director Leave Approval Handler
 * Handles fetching leave request details and processing final MD decisions
 * Finalizes the approval workflow and triggers archiving
 */

// ============================================================================
// CONSTANTS
// ============================================================================
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
    WARNING: "#ff9800",
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
  if (!element) {
    console.warn(`Element with ID '${id}' not found`);
  }
  return element;
}

function showError(message) {
  Swal.fire({
    icon: "error",
    title: "Access Denied",
    text: message || "An unexpected error occurred.",
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

function showWarning(title, message) {
  return Swal.fire({
    icon: "warning",
    title,
    text: message,
    confirmButtonColor: CONFIG.COLORS.PRIMARY,
  });
}

function getUrlParameter(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
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
  if (!data) {
    console.error("No data provided to populateUI");
    return;
  }

  const fieldMapping = {
    displayStaffName: "staff_name",
    displayStaffNo: "staff_no",
    displayType: "leave_type",
    displayStart: "start_date",
    displayEnd: "resumption_date",
  };

  Object.entries(fieldMapping).forEach(([elementId, dataKey]) => {
    const element = getElement(elementId);
    if (element) {
      element.textContent = data[dataKey] || "N/A";
    }
  });

  const totalDaysElement = getElement("displayTotalDays");
  if (totalDaysElement) {
    totalDaysElement.textContent = `${data.total_days || 0} Working Days`;
  }

  displayAuditTrail(data);
  handleFinalizedRequests(data);
}

function displayAuditTrail(data) {
  const managerField = getElement("displayManagerDecision");
  if (managerField) {
    const managerDecision = data.manager_decision || "No Decision";
    managerField.textContent = managerDecision;
    managerField.style.color = getDecisionColor(managerDecision);
  }

  const hrField = getElement("displayHRDecision");
  if (hrField) {
    const hrDecision = data.hr_decision || "No Decision";
    hrField.textContent = hrDecision;
    hrField.style.color = getDecisionColor(hrDecision);
  }
}

function handleFinalizedRequests(data) {
  if (data.status === CONFIG.STATUS.PENDING_MD_REVIEW) {
    return;
  }

  const actionButtons = getElement("actionButtons");
  if (actionButtons) {
    actionButtons.style.display = "none";
  }

  const statusBanner = getElement("statusMessage");
  if (statusBanner) {
    statusBanner.classList.remove("hidden");
    statusBanner.innerHTML = `
      <i class="fas fa-check-double"></i>
      This request has been finalized as
      <strong>${data.status || "Unknown"}</strong>.
      The audit trail is now closed.
    `;
  }
}

// ============================================================================
// UI STATE HELPERS
// ============================================================================

/**
 * Toggles the loading state for the MD action buttons
 * @param {string} decision - 'Approved' or 'Rejected'
 * @param {boolean} isLoading - State
 */
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

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupActionButtons(token, staffName) {
  const approveBtn = getElement("approveBtn");
  const rejectBtn = getElement("rejectBtn");

  if (!approveBtn || !rejectBtn) return;

  approveBtn.addEventListener("click", () =>
    processFinalDecision(token, CONFIG.STATUS.APPROVED, staffName),
  );

  rejectBtn.addEventListener("click", () =>
    processFinalDecision(token, CONFIG.STATUS.REJECTED, staffName),
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = getUrlParameter("token");

  if (!token) {
    showError(CONFIG.MESSAGES.INVALID_TOKEN);
    return;
  }

  try {
    const response = await fetch(`${CONFIG.API.FETCH_DETAILS}?token=${token}`);
    if (!response.ok) throw new Error(CONFIG.MESSAGES.FETCH_ERROR);

    const data = await response.json();
    populateUI(data);
    setupActionButtons(token, data.staff_name);
  } catch (error) {
    showError(error.message || CONFIG.MESSAGES.FETCH_ERROR);
  }
});

// ============================================================================
// FINAL DECISION PROCESSING
// ============================================================================

async function processFinalDecision(token, decision, staffName) {
  if (!token || !decision || !staffName) {
    showError(CONFIG.MESSAGES.SYSTEM_ERROR);
    return;
  }

  const confirmResult = await Swal.fire({
    title: `Final Decision: ${decision}`,
    text: `You are about to ${decision.toLowerCase()} the leave request for ${staffName}. This action is final.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: getDecisionColor(decision),
    cancelButtonColor: CONFIG.COLORS.NEUTRAL,
    confirmButtonText: "Confirm & Finalize",
  });

  if (!confirmResult.isConfirmed) return;

  // Start Spinner
  toggleLoading(decision, true);

  try {
    const payload = { token, status: decision };

    const response = await fetch(CONFIG.API.SUBMIT_ACTION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(CONFIG.MESSAGES.ACTION_FAILED);

    await showSuccess(
      "Workflow Finalized",
      `Request for ${staffName} has been ${decision.toLowerCase()}. Notification emails have been dispatched.`,
    );

    window.location.reload();
  } catch (error) {
    console.error("MD Action Error:", error);
    showError(error.message || CONFIG.MESSAGES.ACTION_FAILED);
    // Reset Spinner on Error
    toggleLoading(decision, false);
  }
}
