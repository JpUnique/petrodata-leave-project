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
    console.warn(` [ELEMENT] Element with ID '${id}' not found`);
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
// DATE CALCULATION (uses utility.js)
// ============================================================================

/**
 * Update the total days display based on start and resumption dates
 */
function updateTotalDays() {
  const startDateInput = getElement(CONFIG.DOM_IDS.START_DATE);
  const resumptionDateInput = getElement(CONFIG.DOM_IDS.RESUMPTION_DATE);
  const totalDaysInput = getElement(CONFIG.DOM_IDS.TOTAL_DAYS);

  // Validate elements exist
  if (!startDateInput || !resumptionDateInput || !totalDaysInput) {
    console.error("[DATE_CALC] Missing date input elements");
    return;
  }

  const startDate = startDateInput.value;
  const resumptionDate = resumptionDateInput.value;

  // Debug logging
  console.log(
    `[DATE_CALC] Raw input values: Start="${startDate}", End="${resumptionDate}"`,
  );
  console.log(
    `[DATE_CALC] Input elements found: startDateInput=${!!startDateInput}, resumptionDateInput=${!!resumptionDateInput}, totalDaysInput=${!!totalDaysInput}`,
  );

  if (!startDate || !resumptionDate) {
    console.log("[DATE_CALC] Dates incomplete - clearing field");
    totalDaysInput.value = "";
    updateTotalDaysStyle(totalDaysInput);
    return;
  }

  // Ensure Utils is available
  if (typeof Utils === "undefined") {
    console.error(
      "[DATE_CALC] Utils not loaded! Check that utility.js is loaded before form-handler.js",
    );
    totalDaysInput.value = "Error: Utils not loaded";
    return;
  }

  // Calculate working days
  const workingDays = Utils.calculateLeaveDays(startDate, resumptionDate);
  const formattedText = Utils.formatDaysText(workingDays);

  console.log(
    `[DATE_CALC] Result: ${workingDays} days, formatted as: "${formattedText}"`,
  );

  // Update field
  totalDaysInput.value = formattedText;
  console.log(`[DATE_CALC] Updated total days field to: "${formattedText}"`);

  // Update styling
  updateTotalDaysStyle(totalDaysInput);
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Check if user is authenticated by verifying session storage
 * @returns {Object|null} User data {userName, userEmail} or null if not authenticated
 */
function checkAuthentication() {
  const userName = getFromStorage(CONFIG.STORAGE.USER_NAME);
  const userEmail = getFromStorage(CONFIG.STORAGE.USER_EMAIL);

  // User must have a name to be considered authenticated
  if (!userName) {
    return null;
  }

  return { userName, userEmail };
}

/**
 * Auto-fill staff name from session storage
 * Sets the field as readonly to prevent manual editing
 * @param {string} staffName - Staff name to auto-fill
 */
function autoFillStaffName(staffName) {
  const staffNameInput = getElement(CONFIG.DOM_IDS.STAFF_NAME);
  if (!staffNameInput) {
    console.error("[AUTH] Staff name input not found");
    return;
  }

  // Set the value and make it readonly
  staffNameInput.value = staffName;
  staffNameInput.readOnly = true;
  console.log(`[AUTH] Staff name auto-filled: "${staffName}"`);
}

/**
 * Handle unauthenticated user by showing warning and redirecting to login
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
 * Validate leave form inputs for required fields and formats
 * @param {Object} formData - Form data object to validate
 * @returns {boolean} True if form is valid, false otherwise
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

  // Check that all required fields have values
  for (const field of requiredFields) {
    if (!formData[field] || formData[field].toString().trim() === "") {
      console.error(`[VALIDATION] Missing required field: ${field}`);
      return false;
    }
  }

  // Validate email format
  if (!formData.manager_email.includes("@")) {
    console.error(" [VALIDATION] Invalid manager email format");
    return false;
  }

  console.log("[VALIDATION] Form validation passed");
  return true;
}

/**
 * Collect form data from all input fields
 * Aggregates data from DOM elements into a single object
 * Uses Utils.calculateLeaveDays() for total_days
 * @returns {Object} Form data object with all field values
 */
function collectFormData() {
  const startDateInput = getElement(CONFIG.DOM_IDS.START_DATE);
  const endDateInput = getElement(CONFIG.DOM_IDS.RESUMPTION_DATE);

  const startDate = startDateInput ? startDateInput.value : "";
  const endDate = endDateInput ? endDateInput.value : "";

  // Calculate total days using Utils from utility.js
  let totalDays = 0;
  if (startDate && endDate && typeof Utils !== "undefined") {
    totalDays = Utils.calculateLeaveDays(startDate, endDate);
  }

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
 * Handles success/error responses and form reset
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

      // Show success message
      await showSuccess(
        CONFIG.MESSAGES.SUBMISSION_SUCCESS,
        result.message || CONFIG.MESSAGES.SUBMISSION_SUCCESS_MSG,
      );

      // Reset form after successful submission
      const leaveForm = getElement(CONFIG.DOM_IDS.LEAVE_FORM);
      if (leaveForm) {
        leaveForm.reset();

        // Restore auto-filled staff name after reset
        const savedName = getFromStorage(CONFIG.STORAGE.USER_NAME);
        if (savedName) {
          autoFillStaffName(savedName);
        }

        // Clear total days field
        const totalDaysInput = getElement(CONFIG.DOM_IDS.TOTAL_DAYS);
        if (totalDaysInput) {
          totalDaysInput.value = "";
          updateTotalDaysStyle(totalDaysInput);
        }
      }

      console.log("[SUBMISSION] Leave request submitted successfully");
    } else {
      const errorText = await response.text();
      showError(
        CONFIG.MESSAGES.SUBMISSION_FAILED,
        errorText || CONFIG.MESSAGES.SUBMISSION_FAILED,
      );
      console.error("[SUBMISSION] Server returned error:", errorText);
    }
  } catch (error) {
    console.error("[SUBMISSION] Leave submission error:", error);
    showError(CONFIG.MESSAGES.SERVER_ERROR, CONFIG.MESSAGES.SERVER_ERROR_MSG);
  }
}

/**
 * Handle leave form submission
 * Validates form data before submission
 * @param {Event} event - Form submit event
 */
async function handleLeaveFormSubmit(event) {
  event.preventDefault();

  // Collect all form data
  const leaveRequestData = collectFormData();

  // Validate before submission
  if (!validateLeaveForm(leaveRequestData)) {
    showError("Validation Error", "Please fill all required fields correctly.");
    return;
  }

  // Submit to backend
  await submitLeaveRequest(leaveRequestData);
}

// ============================================================================
// DOM STYLING & INITIALIZATION
// ============================================================================

/**
 * Update styling for total days field
 * Adds/removes has-value class based on field content
 * @param {HTMLElement} totalDaysInput - The total days input element
 */
function updateTotalDaysStyle(totalDaysInput) {
  if (!totalDaysInput) return;

  const hasValue = totalDaysInput.value && totalDaysInput.value.trim() !== "";

  if (hasValue) {
    totalDaysInput.classList.add("has-value");
    // Force a visual refresh for readonly fields
    totalDaysInput.style.backgroundColor = "";
    console.log("🎨 [STYLING] Total days field marked as has-value");
  } else {
    totalDaysInput.classList.remove("has-value");
    console.log("🎨 [STYLING] Total days field has-value class removed");
  }
}

/**
 * Initialize input field styling based on initial values
 * Adds/removes 'has-value' class to show white background when filled
 */
function initializeInputStyling() {
  const inputs = document.querySelectorAll(
    `#${CONFIG.DOM_IDS.STAFF_NAME},
     #${CONFIG.DOM_IDS.STAFF_NO},
     #${CONFIG.DOM_IDS.DESIGNATION},
     #${CONFIG.DOM_IDS.DEPARTMENT},
     #${CONFIG.DOM_IDS.LEAVE_TYPE},
     #${CONFIG.DOM_IDS.START_DATE},
     #${CONFIG.DOM_IDS.RESUMPTION_DATE},
     #${CONFIG.DOM_IDS.TOTAL_DAYS},
     #${CONFIG.DOM_IDS.RELIEF_STAFF},
     #${CONFIG.DOM_IDS.CONTACT_ADDRESS},
     #${CONFIG.DOM_IDS.MANAGER_EMAIL}`,
  );

  /**
   * Update styling for a single input
   * @param {HTMLElement} input - The input element
   */
  function updateInputStyle(input) {
    if (input.value && input.value.trim() !== "") {
      input.classList.add("has-value");
    } else {
      input.classList.remove("has-value");
    }
  }

  // Apply initial styling based on current values
  inputs.forEach((input) => updateInputStyle(input));

  // Add listeners to update styling when values change
  inputs.forEach((input) => {
    input.addEventListener("input", function () {
      updateInputStyle(this);
    });

    input.addEventListener("change", function () {
      updateInputStyle(this);
    });

    input.addEventListener("blur", function () {
      updateInputStyle(this);
    });
  });

  console.log(
    `[STYLING] Input styling initialized for ${inputs.length} form fields`,
  );
}

// ============================================================================
// DOCUMENT READY - MAIN INITIALIZATION
// ============================================================================

/**
 * Initialize form handler when DOM is fully loaded
 * Sets up authentication, date listeners, and form submission handlers
 */
document.addEventListener("DOMContentLoaded", () => {
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("[INIT] DOM Content Loaded - Starting form initialization");
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );

  // === STEP 1: Authentication Check ===
  const user = checkAuthentication();
  if (!user) {
    console.log(" [INIT] User not authenticated - redirecting to login");
    handleUnauthenticatedUser();
    return;
  }

  console.log(`[AUTH] User authenticated: ${user.userName}`);

  // === STEP 2: Auto-fill Staff Name ===
  autoFillStaffName(user.userName);

  // === STEP 3: Get Form Elements ===
  console.log("📋 [INIT] Getting form elements...");
  const leaveForm = getElement(CONFIG.DOM_IDS.LEAVE_FORM);
  const startDateInput = getElement(CONFIG.DOM_IDS.START_DATE);
  const resumptionDateInput = getElement(CONFIG.DOM_IDS.RESUMPTION_DATE);
  const totalDaysInput = getElement(CONFIG.DOM_IDS.TOTAL_DAYS);

  if (!leaveForm) {
    console.error(" [INIT] Leave form not found - cannot proceed");
    return;
  }

  // === STEP 4: Initialize Input Styling ===
  initializeInputStyling();

  // === STEP 5: Setup Date Change Listeners ===
  if (startDateInput && resumptionDateInput && totalDaysInput) {
    console.log("[INIT] Attaching date change listeners...");

    /**
     * Handler for date input changes
     * Updates total days calculation and styling
     */
    const dateChangeHandler = (event) => {
      console.log(
        `[EVENT] Date input changed (${event.type}) - triggering calculation`,
      );
      updateTotalDays();
    };

    // Use 'change' event (most reliable for date inputs) and 'blur' as fallback
    startDateInput.addEventListener("change", dateChangeHandler);
    startDateInput.addEventListener("blur", dateChangeHandler);

    console.log("[INIT] Start date listeners attached");

    resumptionDateInput.addEventListener("change", dateChangeHandler);
    resumptionDateInput.addEventListener("blur", dateChangeHandler);

    console.log("[INIT] Resumption date listeners attached");

    // Test if both dates already have values (e.g., browser autofill)
    if (startDateInput.value && resumptionDateInput.value) {
      console.log(
        "📅 [INIT] Both dates pre-filled - running initial calculation...",
      );
      updateTotalDays();
    }
  } else {
    console.error(" [INIT] Date input elements not found", {
      startDate: !!startDateInput,
      resumptionDate: !!resumptionDateInput,
      totalDays: !!totalDaysInput,
    });
  }

  // === STEP 6: Setup Form Submission ===
  if (leaveForm) {
    leaveForm.addEventListener("submit", handleLeaveFormSubmit);
    console.log("[INIT] Leave form submission handler attached");
  }

  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("[INIT] Form handler initialization complete");
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
});
