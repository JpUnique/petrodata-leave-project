/**
 * form-handler.js - Leave Request Form Handler
 * Manages leave request form submission, date calculations, and user authentication
 */

// ============================================================================
// CONSTANTS
// ============================================================================
const CONFIG = {
  API: {
    SUBMIT_LEAVE: "/api/leave/submit",
  },
  DOM_IDS: {
    LEAVE_FORM: "leaveForm",
    STAFF_NAME: "staffName",
    STAFF_NO: "staffNo",
    DESIGNATION: "designation",
    DEPARTMENT: "department",
    LEAVE_TYPE: "leaveType",
    START_DATE: "startDate",
    RESUMPTION_DATE: "resumptionDate",
    TOTAL_DAYS: "totalDays",
    RELIEF_STAFF: "reliefStaff",
    CONTACT_ADDRESS: "contactAddress",
    MANAGER_EMAIL: "managerEmail",
  },
  STORAGE: {
    USER_NAME: "userName",
    USER_EMAIL: "userEmail",
  },
  COLORS: {
    SUCCESS: "#00e676",
    ERROR: "#ff4d4d",
    PRIMARY: "#004d40",
  },
  MESSAGES: {
    SESSION_EXPIRED: "Session Expired",
    SESSION_EXPIRED_MSG: "Please login to access the portal.",
    INVALID_DATES: "Invalid Dates",
    SUBMISSION_FAILED: "Submission Failed",
    SUBMISSION_SUCCESS: "Request Submitted",
    SUBMISSION_SUCCESS_MSG: "Your leave request has been sent to your manager.",
    SERVER_ERROR: "Server Error",
    SERVER_ERROR_MSG: "Could not connect to the PetroData server.",
  },
  PAGES: {
    LOGIN: "login.html",
  },
  TIME: {
    MS_PER_DAY: 1000 * 60 * 60 * 24,
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
 * Show alert using SweetAlert
 * @param {string} icon - Alert icon ('success', 'error', 'warning', 'info')
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {Object} options - Additional SweetAlert options
 * @returns {Promise} SweetAlert promise
 */
function showAlert(icon, title, message, options = {}) {
  const defaultColor =
    icon === "success" ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.ERROR;

  return Swal.fire({
    icon,
    title,
    text: message,
    confirmButtonColor: defaultColor,
    ...options,
  });
}

/**
 * Show error alert
 * @param {string} title - Alert title
 * @param {string} message - Error message
 */
function showError(title, message) {
  return showAlert("error", title, message);
}

/**
 * Show success alert
 * @param {string} title - Alert title
 * @param {string} message - Success message
 */
function showSuccess(title, message) {
  return showAlert("success", title, message);
}

/**
 * Show warning alert
 * @param {string} title - Alert title
 * @param {string} message - Warning message
 */
function showWarning(title, message) {
  return showAlert("warning", title, message);
}

/**
 * Get value from localStorage
 * @param {string} key - Storage key
 * @returns {string|null} Stored value or null
 */
function getFromStorage(key) {
  return localStorage.getItem(key);
}

/**
 * Set value in localStorage
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 */
function setInStorage(key, value) {
  localStorage.setItem(key, value);
}

/**
 * Navigate to a specified page
 * @param {string} page - Page path
 */
function navigateTo(page) {
  window.location.href = page;
}

// ============================================================================
// DATE CALCULATION
// ============================================================================

/**
 * Calculate the number of days between two dates
 * @param {string} startDateStr - Start date in YYYY-MM-DD format
 * @param {string} endDateStr - End date in YYYY-MM-DD format
 * @returns {number} Number of days (minimum 1)
 */
function calculateDaysDifference(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) {
    return 0;
  }

  try {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return 0;
    }

    const timeDifference = Math.abs(endDate - startDate);
    const daysDifference = Math.ceil(timeDifference / CONFIG.TIME.MS_PER_DAY);

    return daysDifference > 0 ? daysDifference : 1;
  } catch (error) {
    console.error("Date calculation error:", error);
    return 0;
  }
}

/**
 * Format days for display in the total days field
 * @param {number} days - Number of days
 * @returns {string} Formatted days string
 */
function formatDaysDisplay(days) {
  if (days <= 0) {
    return CONFIG.MESSAGES.INVALID_DATES;
  }

  if (days === 1) {
    return "1 Working Day";
  }

  return `${days} Working Days`;
}

/**
 * Update the total days display based on start and end dates
 * @param {HTMLElement} startDateInput - Start date input element
 * @param {HTMLElement} endDateInput - End date input element
 * @param {HTMLElement} totalDaysInput - Total days input element
 */
function updateTotalDays(startDateInput, endDateInput, totalDaysInput) {
  if (!startDateInput || !endDateInput || !totalDaysInput) {
    console.error("Date input elements not found");
    return;
  }

  const startDate = startDateInput.value;
  const endDate = endDateInput.value;

  if (!startDate || !endDate) {
    return;
  }

  const days = calculateDaysDifference(startDate, endDate);
  totalDaysInput.value = formatDaysDisplay(days);
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Check if user is authenticated (has saved session data)
 * @returns {Object|null} User data or null if not authenticated
 */
function checkAuthentication() {
  const userName = getFromStorage(CONFIG.STORAGE.USER_NAME);
  const userEmail = getFromStorage(CONFIG.STORAGE.USER_EMAIL);

  if (!userName) {
    return null;
  }

  return { userName, userEmail };
}

/**
 * Auto-fill staff name from session storage
 * @param {string} staffName - Staff name from storage
 */
function autoFillStaffName(staffName) {
  const staffNameInput = getElement(CONFIG.DOM_IDS.STAFF_NAME);
  if (!staffNameInput) {
    console.error("Staff name input not found");
    return;
  }

  staffNameInput.value = staffName;
  staffNameInput.readOnly = true;
  console.log("Staff name auto-filled");
}

/**
 * Handle unauthenticated user redirect
 */
function handleUnauthenticatedUser() {
  showWarning(
    CONFIG.MESSAGES.SESSION_EXPIRED,
    CONFIG.MESSAGES.SESSION_EXPIRED_MSG,
  ).then(() => {
    navigateTo(CONFIG.PAGES.LOGIN);
  });
}

// ============================================================================
// FORM VALIDATION
// ============================================================================

/**
 * Validate leave form inputs
 * @param {Object} formData - Form data object
 * @returns {boolean} True if valid
 */
function validateLeaveForm(formData) {
  const requiredFields = [
    "staff_name",
    "staff_no",
    "designation",
    "department",
    "leave_type",
    "start_date",
    "resumption_date",
    "relief_staff",
    "contact_address",
    "manager_email",
  ];

  for (const field of requiredFields) {
    if (!formData[field] || formData[field].trim() === "") {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }

  // Validate email format
  if (!formData.manager_email.includes("@")) {
    console.error("Invalid manager email format");
    return false;
  }

  return true;
}

/**
 * Collect form data from the DOM
 * @returns {Object} Form data object
 */
function collectFormData() {
  const startDateInput = getElement(CONFIG.DOM_IDS.START_DATE);
  const endDateInput = getElement(CONFIG.DOM_IDS.RESUMPTION_DATE);

  const startDate = startDateInput ? startDateInput.value : "";
  const endDate = endDateInput ? endDateInput.value : "";
  const totalDays = calculateDaysDifference(startDate, endDate);

  return {
    staff_name: getElement(CONFIG.DOM_IDS.STAFF_NAME)?.value || "",
    staff_no: getElement(CONFIG.DOM_IDS.STAFF_NO)?.value || "",
    designation: getElement(CONFIG.DOM_IDS.DESIGNATION)?.value || "",
    department: getElement(CONFIG.DOM_IDS.DEPARTMENT)?.value || "",
    leave_type: getElement(CONFIG.DOM_IDS.LEAVE_TYPE)?.value || "",
    start_date: startDate,
    resumption_date: endDate,
    total_days: totalDays,
    relief_staff: getElement(CONFIG.DOM_IDS.RELIEF_STAFF)?.value || "",
    contact_address: getElement(CONFIG.DOM_IDS.CONTACT_ADDRESS)?.value || "",
    manager_email: getElement(CONFIG.DOM_IDS.MANAGER_EMAIL)?.value || "",
    status: "Pending",
  };
}

// ============================================================================
// FORM SUBMISSION
// ============================================================================

/**
 * Submit leave request to backend API
 * @param {Object} leaveRequestData - Leave request form data
 */
async function submitLeaveRequest(leaveRequestData) {
  try {
    const response = await fetch(CONFIG.API.SUBMIT_LEAVE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leaveRequestData),
    });

    if (response.ok) {
      const result = await response.json();

      await showSuccess(
        CONFIG.MESSAGES.SUBMISSION_SUCCESS,
        result.message || CONFIG.MESSAGES.SUBMISSION_SUCCESS_MSG,
      );

      // Reset form
      const leaveForm = getElement(CONFIG.DOM_IDS.LEAVE_FORM);
      if (leaveForm) {
        leaveForm.reset();
        // Restore auto-filled staff name
        const savedName = getFromStorage(CONFIG.STORAGE.USER_NAME);
        if (savedName) {
          autoFillStaffName(savedName);
        }
      }
    } else {
      const errorText = await response.text();
      showError(
        CONFIG.MESSAGES.SUBMISSION_FAILED,
        errorText || CONFIG.MESSAGES.SUBMISSION_FAILED,
      );
    }
  } catch (error) {
    console.error("Leave Submission Error:", error);
    showError(CONFIG.MESSAGES.SERVER_ERROR, CONFIG.MESSAGES.SERVER_ERROR_MSG);
  }
}

/**
 * Handle leave form submission
 * @param {Event} event - Form submit event
 */
async function handleLeaveFormSubmit(event) {
  event.preventDefault();

  // Collect form data
  const leaveRequestData = collectFormData();

  // Validate form
  if (!validateLeaveForm(leaveRequestData)) {
    showError("Validation Error", "Please fill all required fields correctly.");
    return;
  }

  // Submit to backend
  await submitLeaveRequest(leaveRequestData);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize form handler on DOM ready
 */
document.addEventListener("DOMContentLoaded", () => {
  // Check authentication
  const user = checkAuthentication();
  if (!user) {
    handleUnauthenticatedUser();
    return;
  }

  // Auto-fill staff name
  autoFillStaffName(user.userName);

  // Get form elements
  const leaveForm = getElement(CONFIG.DOM_IDS.LEAVE_FORM);
  const startDateInput = getElement(CONFIG.DOM_IDS.START_DATE);
  const resumptionDateInput = getElement(CONFIG.DOM_IDS.RESUMPTION_DATE);
  const totalDaysInput = getElement(CONFIG.DOM_IDS.TOTAL_DAYS);

  // Setup date change listeners for real-time calculation
  if (startDateInput && resumptionDateInput && totalDaysInput) {
    startDateInput.addEventListener("change", () =>
      updateTotalDays(startDateInput, resumptionDateInput, totalDaysInput),
    );

    resumptionDateInput.addEventListener("change", () =>
      updateTotalDays(startDateInput, resumptionDateInput, totalDaysInput),
    );

    console.log("Date change listeners attached");
  }

  // Setup form submission
  if (leaveForm) {
    leaveForm.addEventListener("submit", handleLeaveFormSubmit);
    console.log("Leave form submission handler attached");
  }

  console.log("Form handler initialized");
});
