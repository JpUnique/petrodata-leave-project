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

/**
 * Safely get element by ID with warning if not found
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} The element or null
 */
function getElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with ID '${id}' not found`);
  }
  return element;
}

/**
 * Show error alert using SweetAlert
 * @param {string} message - Error message to display
 */
function showError(message) {
  Swal.fire({
    icon: "error",
    title: "Access Denied",
    text: message || "An unexpected error occurred.",
    confirmButtonColor: CONFIG.COLORS.PRIMARY,
  });
}

/**
 * Show success alert using SweetAlert
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @returns {Promise} SweetAlert promise
 */
function showSuccess(title, message) {
  return Swal.fire({
    icon: "success",
    title,
    text: message,
    confirmButtonColor: CONFIG.COLORS.PRIMARY,
  });
}

/**
 * Show warning alert using SweetAlert
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @returns {Promise} SweetAlert promise
 */
function showWarning(title, message) {
  return Swal.fire({
    icon: "warning",
    title,
    text: message,
    confirmButtonColor: CONFIG.COLORS.PRIMARY,
  });
}

/**
 * Get URL query parameter value
 * @param {string} param - Parameter name
 * @returns {string|null} Parameter value or null
 */
function getUrlParameter(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

/**
 * Get text color based on decision status
 * @param {string} decision - Decision status ('Approved' or 'Rejected')
 * @returns {string} Hex color code
 */
function getDecisionColor(decision) {
  return decision === CONFIG.STATUS.APPROVED
    ? CONFIG.COLORS.SUCCESS
    : CONFIG.COLORS.ERROR;
}

// ============================================================================
// DOM POPULATION
// ============================================================================

/**
 * Populate UI with leave request data and full audit trail
 * @param {Object} data - Leave request data from backend
 */
function populateUI(data) {
  if (!data) {
    console.error("No data provided to populateUI");
    return;
  }

  // Field mapping: DOM element ID -> data property
  const fieldMapping = {
    displayStaffName: "staff_name",
    displayStaffNo: "staff_no",
    displayType: "leave_type",
    displayStart: "start_date",
    displayEnd: "resumption_date",
    currentStatus: "status",
  };

  // Populate standard fields
  Object.entries(fieldMapping).forEach(([elementId, dataKey]) => {
    const element = getElement(elementId);
    if (element) {
      element.textContent = data[dataKey] || "N/A";
    }
  });

  // Handle total days with formatting
  const totalDaysElement = getElement("displayTotalDays");
  if (totalDaysElement) {
    totalDaysElement.textContent = `${data.total_days || 0} Working Days`;
  }

  // Display audit trail (chain of custody)
  displayAuditTrail(data);

  // Handle finalized requests (lock UI)
  handleFinalizedRequests(data);
}

/**
 * Display the full audit trail showing all previous decisions
 * @param {Object} data - Leave request data
 */
function displayAuditTrail(data) {
  // Display Line Manager's Decision
  const managerField = getElement("displayManagerDecision");
  if (managerField) {
    const managerDecision = data.manager_decision || "No Decision";
    managerField.textContent = managerDecision;
    managerField.style.color = getDecisionColor(managerDecision);
  }

  // Display HR Manager's Decision
  const hrField = getElement("displayHRDecision");
  if (hrField) {
    const hrDecision = data.hr_decision || "No Decision";
    hrField.textContent = hrDecision;
    hrField.style.color = getDecisionColor(hrDecision);
  }
}

/**
 * Handle UI state for already finalized requests
 * @param {Object} data - Leave request data
 */
function handleFinalizedRequests(data) {
  if (data.status === CONFIG.STATUS.PENDING_MD_REVIEW) {
    return; // Request is still pending, UI should be active
  }

  // Lock the UI - request has already been finalized
  const actionButtons = getElement("actionButtons");
  if (actionButtons) {
    actionButtons.classList.add("hidden");
  }

  // Show finalization banner
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
// EVENT LISTENERS
// ============================================================================

/**
 * Setup approve/reject button event listeners
 * @param {string} token - MD request token
 * @param {string} staffName - Staff member name
 */
function setupActionButtons(token, staffName) {
  const approveBtn = getElement("approveBtn");
  const rejectBtn = getElement("rejectBtn");

  if (!approveBtn || !rejectBtn) {
    console.error("Action buttons not found in DOM");
    return;
  }

  approveBtn.addEventListener("click", () =>
    processFinalDecision(token, CONFIG.STATUS.APPROVED, staffName),
  );

  rejectBtn.addEventListener("click", () =>
    processFinalDecision(token, CONFIG.STATUS.REJECTED, staffName),
  );
}

/**
 * Handle initial page load and data fetching
 */
document.addEventListener("DOMContentLoaded", async () => {
  const token = getUrlParameter("token");

  if (!token) {
    showError(CONFIG.MESSAGES.INVALID_TOKEN);
    return;
  }

  try {
    const response = await fetch(`${CONFIG.API.FETCH_DETAILS}?token=${token}`);

    if (!response.ok) {
      throw new Error(CONFIG.MESSAGES.FETCH_ERROR);
    }

    const data = await response.json();
    populateUI(data);
    setupActionButtons(token, data.staff_name);
  } catch (error) {
    console.error("MD Fetch Error:", error);
    showError(error.message || CONFIG.MESSAGES.FETCH_ERROR);
  }
});

// ============================================================================
// FINAL DECISION PROCESSING
// ============================================================================

/**
 * Process final MD decision and finalize workflow
 * @param {string} token - MD request token
 * @param {string} decision - 'Approved' or 'Rejected'
 * @param {string} staffName - Staff member name
 */
async function processFinalDecision(token, decision, staffName) {
  // Validate inputs
  if (!token || !decision || !staffName) {
    console.error("Missing required parameters for processFinalDecision", {
      token,
      decision,
      staffName,
    });
    showError(CONFIG.MESSAGES.SYSTEM_ERROR);
    return;
  }

  // Request confirmation from MD
  const confirmResult = await Swal.fire({
    title: `Final Decision: ${decision}`,
    text: `You are about to ${decision.toLowerCase()} the leave request for ${staffName}. This action is final and will be archived.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: getDecisionColor(decision),
    cancelButtonColor: CONFIG.COLORS.NEUTRAL,
    confirmButtonText: "Confirm & Finalize",
  });

  if (!confirmResult.isConfirmed) {
    return; // User cancelled
  }

  // Submit final decision to backend
  await submitMDDecision(token, decision, staffName);
}

/**
 * Submit final MD decision to backend API
 * @param {string} token - MD request token
 * @param {string} decision - MD's final decision ('Approved' or 'Rejected')
 * @param {string} staffName - Staff member name
 */
async function submitMDDecision(token, decision, staffName) {
  try {
    const payload = {
      token,
      status: decision,
    };

    const response = await fetch(CONFIG.API.SUBMIT_ACTION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(CONFIG.MESSAGES.ACTION_FAILED);
    }

    // Parse response (optional, for logging)
    const result = await response.json();
    console.log("MD Action Response:", result);

    // Success - show confirmation and reload
    await showSuccess(
      "Workflow Finalized",
      `Request for ${staffName} has been ${decision.toLowerCase()}. HR has been notified for archiving.`,
    );

    // Reload to refresh data and lock the UI
    window.location.reload();
  } catch (error) {
    console.error("MD Action Error:", error);
    showError(error.message || CONFIG.MESSAGES.ACTION_FAILED);
  }
}
