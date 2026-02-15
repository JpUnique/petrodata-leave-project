/**
 * approve.js - Manager Leave Approval Handler
 * Handles fetching leave request details and processing manager decisions
 */

// ============================================================================
// CONSTANTS
// ============================================================================
const CONFIG = {
  API: {
    FETCH_DETAILS: "/api/leave/details",
    SUBMIT_ACTION: "/api/leave/action",
  },
  STATUS: {
    PENDING: "Pending",
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
    FETCH_ERROR: "Leave request not found or the link has expired.",
    EMAIL_REQUIRED:
      "Please provide a valid HR Manager email to forward this request.",
    EMAIL_INVALID: "Email must be valid (contain @).",
    ACTION_FAILED: "Failed to update the request status on the server.",
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely get element by ID
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
    text: message || "An unexpected error occurred",
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
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  return email && email.includes("@");
}

/**
 * Get URL query parameter
 * @param {string} param - Parameter name
 * @returns {string|null} Parameter value or null
 */
function getUrlParameter(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
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

  // Handle processed requests
  if (data.status !== CONFIG.STATUS.PENDING) {
    const actionButtons = getElement("actionButtons");
    const statusMessage = getElement("statusMessage");

    if (actionButtons) {
      actionButtons.classList.add("hidden");
    }

    if (statusMessage) {
      statusMessage.classList.remove("hidden");
      const formattedDate = new Date(data.created_at).toLocaleDateString();
      statusMessage.textContent = `Notification: This request was ${data.status.toLowerCase()} on ${formattedDate}.`;
    }
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Setup approve/reject button listeners
 * @param {string} token - Request token
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
 * Handle initial page load
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
 * Process approval/rejection decision
 * @param {string} token - Request token
 * @param {string} decision - 'Approved' or 'Rejected'
 * @param {string} staffName - Staff member name
 */
async function processDecision(token, decision, staffName) {
  // Validate inputs
  if (!token || !decision || !staffName) {
    console.error("Missing required parameters for processDecision");
    showError("Invalid request parameters");
    return;
  }

  // Get and validate HR email
  const hrEmailInput = getElement("hrEmail");
  if (!hrEmailInput) {
    console.error("HR Email input element not found");
    showError("System configuration error");
    return;
  }

  const hrEmail = hrEmailInput.value.trim();

  if (!hrEmail) {
    Swal.fire({
      title: "Required",
      text: CONFIG.MESSAGES.EMAIL_REQUIRED,
      icon: "warning",
      confirmButtonColor: CONFIG.COLORS.PRIMARY,
    });
    return;
  }

  if (!isValidEmail(hrEmail)) {
    Swal.fire({
      title: "Invalid Email",
      text: CONFIG.MESSAGES.EMAIL_INVALID,
      icon: "warning",
      confirmButtonColor: CONFIG.COLORS.PRIMARY,
    });
    return;
  }

  // Confirm decision
  const confirmResult = await Swal.fire({
    title: `Confirm ${decision}?`,
    text: `Are you sure you want to ${decision.toLowerCase()} the request for ${staffName} and forward it to HR?`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor:
      decision === CONFIG.STATUS.APPROVED
        ? CONFIG.COLORS.SUCCESS
        : CONFIG.COLORS.ERROR,
    cancelButtonColor: CONFIG.COLORS.NEUTRAL,
    confirmButtonText: `Yes, ${decision}!`,
  });

  if (!confirmResult.isConfirmed) {
    return;
  }

  // Submit decision to backend
  try {
    const payload = {
      token,
      status: decision,
      hr_email: hrEmail,
    };

    const response = await fetch(CONFIG.API.SUBMIT_ACTION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(CONFIG.MESSAGES.ACTION_FAILED);
    }

    await showSuccess(
      "Action Recorded",
      `The request has been ${decision.toLowerCase()} and forwarded to HR (${hrEmail}).`,
    );

    // Reload to refresh data
    window.location.reload();
  } catch (error) {
    console.error("Action Error:", error);
    showError(error.message || CONFIG.MESSAGES.ACTION_FAILED);
  }
}
