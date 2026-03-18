const CONFIG = {
  API: {
    FETCH_DETAILS: "/api/leave/final-details",
    DOWNLOAD_PDF: "/api/leave/download-pdf",
  },
  DOM_IDS: {
    DOWNLOAD_PDF_BTN: "downloadPdfBtn",
    PRINTABLE_AREA: "printableArea",
    ARCHIVE_DATE: "archiveDate",
    STAFF_NAME: "displayStaffName",
    STAFF_NO: "displayStaffNo",
    DEPT: "displayDept",
    DESIGNATION: "displayDesignation",
    PHONE: "displayPhone",
    DATE_EMPLOYED: "displayDateEmployed",
    LEAVE_TYPE: "displayType",
    ALLOWANCE: "displayAllowance",
    TOTAL_DAYS: "displayTotalDays",
    START_DATE: "displayStart",
    END_DATE: "displayEnd",
    RELIEF_STAFF: "displayRelief",
    ADDRESS: "displayAddress",
    MANAGER_DECISION: "displayManagerDecision",
    HR_DECISION: "displayHRDecision",
    MD_DECISION: "displayMDDecision",
  },
  COLORS: {
    APPROVED: "#1b5e20",
    REJECTED: "#b71c1c",
    PRIMARY: "#004d40",
  },
  MESSAGES: {
    NO_TOKEN: "No archive token found. Access denied.",
    FETCH_ERROR: "Could not retrieve archive record.",
    PDF_GENERATING: "Generating PDF...",
    PDF_GENERATING_MSG: "Please wait while we prepare your document.",
    PDF_SUCCESS: "Official Leave Record downloaded.",
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
 * Show alert using SweetAlert
 * @param {string} icon - Alert icon ('success', 'error', 'warning', 'info')
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {Object} options - Additional SweetAlert options
 * @returns {Promise} SweetAlert promise
 */
function showAlert(icon, title, message, options = {}) {
  return Swal.fire({
    icon,
    title,
    text: message,
    confirmButtonColor: CONFIG.COLORS.PRIMARY,
    ...options,
  });
}

/**
 * Show error alert
 * @param {string} message - Error message
 */
function showError(message) {
  showAlert("error", "Error", message || CONFIG.MESSAGES.SYSTEM_ERROR);
}

/**
 * Show success alert
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 */
function showSuccess(title, message) {
  return showAlert("success", title, message);
}

/**
 * Show loading dialog for long operations
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 */
function showLoading(title, message) {
  Swal.fire({
    title,
    html: message,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
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
 * Get decision color based on approval status
 * @param {string} decision - Decision status ('Approved' or 'Rejected')
 * @returns {string} Hex color code
 */
function getDecisionColor(decision) {
  return decision === "Approved"
    ? CONFIG.COLORS.APPROVED
    : CONFIG.COLORS.REJECTED;
}

/**
 * Format date/time for display
 * @returns {string} Formatted date/time string
 */
function getFormattedDateTime() {
  return new Date().toLocaleString();
}

/**
 * Sanitize string for filename (replace spaces and special chars)
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeFileName(str) {
  return str.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
}

// ============================================================================
// DOM POPULATION
// ============================================================================

/**
 * Populate archive UI with finalized leave request data
 * @param {Object} data - Leave request data from backend
 */
function populateArchiveUI(data) {
  if (!data) {
    console.error("No data provided to populateArchiveUI");
    return;
  }

  // Field mapping: DOM element ID -> data property
  const fieldMapping = {
    STAFF_NAME: "staff_name",
    STAFF_NO: "staff_no",
    DEPT: "department",
    DESIGNATION: "designation",
    PHONE: "phone_number",
    DATE_EMPLOYED: "date_employed",
    LEAVE_TYPE: "leave_type",
    START_DATE: "start_date",
    END_DATE: "resumption_date",
    RELIEF_STAFF: "relief_staff",
    ADDRESS: "contact_address",
  };

  // Populate standard fields
  Object.entries(fieldMapping).forEach(([configKey, dataKey]) => {
    const elementId = CONFIG.DOM_IDS[configKey];
    const element = getElement(elementId);
    if (element) {
      element.textContent = data[dataKey] || "N/A";
    }
  });
  const allowanceEl = getElement(CONFIG.DOM_IDS.ALLOWANCE);
  if (allowanceEl) {
    allowanceEl.textContent = data.leave_allowance_request
      ? "YES (Requested)"
      : "NO";
    allowanceEl.style.color = data.leave_allowance_request
      ? CONFIG.COLORS.APPROVED
      : CONFIG.COLORS.NEUTRAL;
  }

  // Handle total days with formatting
  const totalDaysElement = getElement(CONFIG.DOM_IDS.TOTAL_DAYS);
  if (totalDaysElement) {
    totalDaysElement.textContent = `${data.total_days || 0} Working Days`;
  }

  // Display decision audit trail
  displayDecisionAuditTrail(data);

  // Set archive timestamp
  const archiveDateElement = getElement(CONFIG.DOM_IDS.ARCHIVE_DATE);
  if (archiveDateElement) {
    archiveDateElement.textContent = getFormattedDateTime();
  }
}

/**
 * Display the full decision audit trail with appropriate colors
 * @param {Object} data - Leave request data
 */
function displayDecisionAuditTrail(data) {
  // Manager's Decision
  const managerField = getElement(CONFIG.DOM_IDS.MANAGER_DECISION);
  if (managerField) {
    const managerDecision = data.manager_decision || "N/A";
    managerField.textContent = managerDecision;
    managerField.style.fontWeight = "bold";
    managerField.style.color = getDecisionColor(managerDecision);
  }

  // HR's Decision
  const hrField = getElement(CONFIG.DOM_IDS.HR_DECISION);
  if (hrField) {
    const hrDecision = data.resource_decision || "N/A";
    hrField.textContent = hrDecision;
    hrField.style.fontWeight = "bold";
    hrField.style.color = getDecisionColor(hrDecision);
  }

  // MD's Final Decision
  const mdField = getElement(CONFIG.DOM_IDS.MD_DECISION);
  if (mdField) {
    const mdDecision = data.director_decision || data.status || "N/A";
    mdField.textContent = mdDecision;
    mdField.style.fontWeight = "bold";
    mdField.style.color = getDecisionColor(mdDecision);
  }
}

// ============================================================================
// PDF GENERATION
// ============================================================================

/**
 * Generate and download PDF of the leave request archive
 * @param {string} staffName - Staff member name for filename
 */
function generatePDF() {
  const token = getUrlParameter("final_token");

  if (!token) {
    showError(CONFIG.MESSAGES.NO_TOKEN);
    return;
  }

  // Show a quick notification so the user knows something is happening
  showSuccess("Processing", CONFIG.MESSAGES.PDF_START);

  // Construct the URL for the Go PDF handler
  // window.location.href triggers the browser's download manager
  const downloadUrl = `${CONFIG.API.DOWNLOAD_PDF}?token=${token}`;

  // Redirect to download
  console.log("Downloading from:", downloadUrl);
  window.location.href = downloadUrl;
}

/**
 * Setup PDF download button listener
 */
function setupPDFButton(staffName) {
  const downloadBtn = getElement(CONFIG.DOM_IDS.DOWNLOAD_PDF_BTN);
  if (!downloadBtn) {
    console.error("PDF download button not found");
    return;
  }

  downloadBtn.addEventListener("click", () => {
    generatePDF();
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Handle initial page load and data fetching
 */
document.addEventListener("DOMContentLoaded", async () => {
  const token = getUrlParameter("final_token");

  if (!token) {
    showError(CONFIG.MESSAGES.NO_TOKEN);
    return;
  }

  try {
    const response = await fetch(`${CONFIG.API.FETCH_DETAILS}?token=${token}`);

    if (!response.ok) {
      throw new Error(CONFIG.MESSAGES.FETCH_ERROR);
    }

    const data = await response.json();

    // Populate the archive UI
    populateArchiveUI(data);

    // Setup PDF download button
    setupPDFButton();

    console.log("Archive page loaded successfully");
  } catch (error) {
    console.error("Archive Load Error:", error);
    showError(error.message || CONFIG.MESSAGES.FETCH_ERROR);
  }
});
