/**
 * approve_hr.js - HR Leave Approval Handler
 * Handles fetching leave request details and processing HR decisions
 * Forwards approval chain to Managing Director
 */

// ============================================================================
// CONSTANTS
// ============================================================================
const CONFIG = {
  API: {
    FETCH_DETAILS: "/api/leave/hr-details",
    SUBMIT_ACTION: "/api/leave/hr-action",
  },
  STATUS: {
    PENDING_HR_REVIEW: "Pending HR Review",
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
    FETCH_ERROR: "Leave request not found or the HR link has expired.",
    MD_EMAIL_REQUIRED:
      "Please provide a valid Managing Director email to forward this audit trail.",
    MD_EMAIL_INVALID: "Email must be valid (contain @).",
    ACTION_FAILED: "Failed to process action on the server.",
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
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  return email && email.includes("@");
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
 * Populate UI with leave request data
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
    displayDesignation: "designation",
    displayDept: "department",
    displayType: "leave_type",
    displayStart: "start_date",
    displayEnd: "resumption_date",
    displayRelief: "relief_staff",
    displayAddress: "contact_address",
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

  // Display manager's decision (audit trail)
  displayManagerDecision(data);

  // Handle processed requests (lock UI)
  handleProcessedRequests(data);
}

/**
 * Display manager's decision in the UI with appropriate color
 * @param {Object} data - Leave request data
 */
function displayManagerDecision(data) {
  const managerDecisionField = getElement("displayManagerDecision");
  if (!managerDecisionField) {
    return;
  }

  const decision = data.manager_decision || "No decision recorded";
  managerDecisionField.textContent = decision;
  managerDecisionField.style.color = getDecisionColor(decision);
}

/**
 * Handle UI state for already processed requests
 * @param {Object} data - Leave request data
 */
function handleProcessedRequests(data) {
  if (data.status === CONFIG.STATUS.PENDING_HR_REVIEW) {
    return; // Request is still pending, UI should be active
  }

  // Lock the UI - request has already been processed
  const actionButtons = getElement("actionButtons");
  if (actionButtons) {
    actionButtons.classList.add("hidden");
  }

  const mdEmailContainer = getElement("mdEmailContainer");
  if (mdEmailContainer) {
    mdEmailContainer.classList.add("hidden");
  }

  // Show status banner
  const statusBanner = getElement("statusMessage");
  if (statusBanner) {
    statusBanner.classList.remove("hidden");
    statusBanner.innerHTML = `
      <i class="fas fa-info-circle"></i>
      This request was processed by HR as
      <strong>${data.hr_decision || "Unknown"}</strong>
      and forwarded to the MD.
    `;
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Setup approve/reject button event listeners
 * @param {string} token - HR request token
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
    processDecision(token, CONFIG.STATUS.APPROVED, staffName),
  );

  rejectBtn.addEventListener("click", () =>
    processDecision(token, CONFIG.STATUS.REJECTED, staffName),
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
    console.error("Fetch Error:", error);
    showError(error.message || CONFIG.MESSAGES.FETCH_ERROR);
  }
});

// ============================================================================
// DECISION PROCESSING
// ============================================================================

/**
 * Process HR approval/rejection decision and forward to MD
 * @param {string} token - HR request token
 * @param {string} decision - 'Approved' or 'Rejected'
 * @param {string} staffName - Staff member name
 */
async function processDecision(token, decision, staffName) {
  // Validate inputs
  if (!token || !decision || !staffName) {
    console.error("Missing required parameters for processDecision", {
      token,
      decision,
      staffName,
    });
    showError(CONFIG.MESSAGES.SYSTEM_ERROR);
    return;
  }

  // Get and validate MD email
  const mdEmailInput = getElement("mdEmail");
  if (!mdEmailInput) {
    console.error("MD Email input element not found");
    showError(CONFIG.MESSAGES.SYSTEM_ERROR);
    return;
  }

  const mdEmail = mdEmailInput.value.trim();

  // Validate email presence
  if (!mdEmail) {
    showWarning("MD Email Required", CONFIG.MESSAGES.MD_EMAIL_REQUIRED);
    return;
  }

  // Validate email format
  if (!isValidEmail(mdEmail)) {
    showWarning("Invalid Email", CONFIG.MESSAGES.MD_EMAIL_INVALID);
    return;
  }

  // Confirm decision
  const confirmResult = await Swal.fire({
    title: `Confirm HR ${decision}?`,
    text: `The request for ${staffName} will be marked as ${decision.toLowerCase()} and forwarded to the MD for final review.`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: getDecisionColor(decision),
    cancelButtonColor: CONFIG.COLORS.NEUTRAL,
    confirmButtonText: "Yes, Proceed",
  });

  if (!confirmResult.isConfirmed) {
    return; // User cancelled
  }

  // Submit decision to backend
  await submitHRDecision(token, decision, mdEmail, staffName);
}

/**
 * Submit HR decision to backend API
 * @param {string} token - HR request token
 * @param {string} decision - HR's decision ('Approved' or 'Rejected')
 * @param {string} mdEmail - Managing Director's email
 * @param {string} staffName - Staff member name
 */
async function submitHRDecision(token, decision, mdEmail, staffName) {
  try {
    const payload = {
      token,
      status: decision,
      md_email: mdEmail,
    };

    const response = await fetch(CONFIG.API.SUBMIT_ACTION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(CONFIG.MESSAGES.ACTION_FAILED);
    }

    // Success - show confirmation and reload
    await showSuccess(
      "Decision Recorded",
      `The audit trail has been successfully forwarded to ${mdEmail}.`,
    );

    // Reload to refresh data and lock the UI
    window.location.reload();
  } catch (error) {
    console.error("HR Action Error:", error);
    showError(error.message || CONFIG.MESSAGES.ACTION_FAILED);
  }
}
