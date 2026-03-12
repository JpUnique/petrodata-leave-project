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
      "Please provide the Managing Director's email to forward this approval.",
    MD_EMAIL_INVALID: "Please enter a valid @petrodata.net email address.",
    ACTION_FAILED: "Failed to process action on the server.",
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

function isValidEmail(email) {
  return email && email.includes("@") && email.endsWith("@petrodata.net");
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

  displayManagerDecision(data);
  handleProcessedRequests(data);
}

function displayManagerDecision(data) {
  const field = getElement("displayManagerDecision");
  if (!field) return;
  // Use 'Approved' check to color the manager's status correctly
  const decision = data.manager_decision || "No decision recorded";
  field.textContent = decision;
  field.style.color =
    decision === "Approved" ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.ERROR;
}

function handleProcessedRequests(data) {
  // If request is no longer in HR review, hide actions
  if (
    data.status !== CONFIG.STATUS.PENDING_HR_REVIEW &&
    data.status !== "Pending Resource Review"
  ) {
    const actions = getElement("actionButtons");
    if (actions) actions.style.display = "none";

    const forwarding = getElement("mdEmailContainer");
    if (forwarding) forwarding.style.display = "none";

    const banner = getElement("statusMessage");
    if (banner) {
      banner.classList.remove("hidden");
      banner.innerHTML = `<i class="fas fa-info-circle"></i> This request has already been processed as <strong>${data.resource_decision || data.status}</strong>.`;
    }
  }
}

// ============================================================================
// ACTION HANDLERS
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

async function processDecision(token, decision, staffName) {
  const isApprove = decision === CONFIG.STATUS.APPROVED;
  const mdEmailInput = getElement("mdEmail");
  let mdEmail = "";

  // Validation: MD Email is ONLY required for approval
  if (isApprove) {
    if (!mdEmailInput) return;
    mdEmail = mdEmailInput.value.trim();

    if (!mdEmail) {
      showWarning("MD Email Required", CONFIG.MESSAGES.MD_EMAIL_REQUIRED);
      return;
    }
    if (!isValidEmail(mdEmail)) {
      showWarning("Invalid Email", CONFIG.MESSAGES.MD_EMAIL_INVALID);
      return;
    }
  }

  const confirmResult = await Swal.fire({
    title: `Confirm ${decision}?`,
    text: isApprove
      ? `Approving ${staffName}'s request and forwarding to the Managing Director.`
      : `Rejecting ${staffName}'s request. This will terminate the workflow.`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: getDecisionColor(decision),
    cancelButtonColor: CONFIG.COLORS.NEUTRAL,
    confirmButtonText: "Yes, Proceed",
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
        director_email: mdEmail,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || CONFIG.MESSAGES.ACTION_FAILED);
    }

    await showSuccess(
      "Decision Recorded",
      isApprove
        ? `Request forwarded successfully to ${mdEmail}.`
        : "The request has been rejected and the staff notified.",
    );

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
  // Sync with emailer.go link: ?resource_token=...
  const token = getUrlParameter("resource_token");

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

    // Setup Event Listeners
    const approveBtn = getElement("approveBtn");
    const rejectBtn = getElement("rejectBtn");

    if (approveBtn) {
      approveBtn.onclick = () =>
        processDecision(token, CONFIG.STATUS.APPROVED, data.staff_name);
    }
    if (rejectBtn) {
      rejectBtn.onclick = () =>
        processDecision(token, CONFIG.STATUS.REJECTED, data.staff_name);
    }
  } catch (error) {
    console.error("Initialization Error:", error);
    showError(error.message || CONFIG.MESSAGES.FETCH_ERROR);
  }
});
