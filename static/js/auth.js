/**
 * auth.js - Authentication Handler
 * Manages user registration, login, logout, and password visibility toggle
 */

// ============================================================================
// CONSTANTS
// ============================================================================
const CONFIG = {
  API: {
    SIGNUP: "/api/signup",
    LOGIN: "/api/login",
  },
  DOMAIN: "@petrodata.net",
  DOM_IDS: {
    SIGNUP_FORM: "signupForm",
    LOGIN_FORM: "loginForm",
    LOGOUT_BTN: "logoutBtn",
    FULL_NAME: "fullName",
    SIGNUP_EMAIL: "signupEmail",
    PHONE: "phone",
    STAFF_NO: "staffNo", // ← ADD THIS
    SIGNUP_PASS: "signupPass",
    LOGIN_EMAIL: "loginEmail",
    LOGIN_PASS: "loginPass",
    TOGGLE_SIGNUP_PASS: "toggleSignupPass",
    TOGGLE_LOGIN_PASS: "toggleLoginPass",
  },
  STORAGE: {
    AUTH_TOKEN: "authToken", // ← ADD THIS (JWT token)
    USER_NAME: "userName",
    USER_EMAIL: "userEmail",
    STAFF_NO: "staffNo", // ← ADD THIS
  },
  COLORS: {
    SUCCESS: "#00e676",
    ERROR: "#ff4d4d",
    NEUTRAL: "#aaa",
  },
  MESSAGES: {
    SIGNUP: {
      SYSTEM_ERROR: "Input IDs do not match HTML. Check console.",
      DOMAIN_ERROR: "You must use a @petrodata.net email address.",
      SUCCESS: "Welcome aboard!",
      SUCCESS_MSG: (name) => `Registration successful for ${name}`,
      FAILED: "Signup Failed",
      FAILED_MSG: "User already exists or data is invalid.",
      CONNECTION_ERROR: "Connection Error",
      CONNECTION_MSG:
        "The server is unreachable. Please check your connection.",
    },
    LOGIN: {
      DOMAIN_ERROR: "Invalid Domain",
      DOMAIN_MSG: "Please use your company email (@petrodata.net)",
      SUCCESS: "Login Successful",
      SUCCESS_MSG: "Redirecting to Leave Portal...",
      FAILED: "Access Denied",
      FAILED_MSG: "Invalid email or password.",
      SERVER_ERROR: "Server Error",
      SERVER_MSG: "Could not connect to the login service.",
    },
    LOGOUT: {
      CONFIRM_TITLE: "Are you sure?",
      CONFIRM_MSG: "You will be signed out of the portal.",
      CONFIRM_BTN: "Yes, Sign Out",
    },
  },
  PAGES: {
    LEAVE_FORM: "leave-form.html",
    LOGIN: "login.html",
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
 * Show alert using SweetAlert with consistent styling
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
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  return email && email.includes("@") && email.endsWith(CONFIG.DOMAIN);
}

/**
 * Trim whitespace from form inputs
 * @param {string} value - Input value
 * @returns {string} Trimmed value
 */
function trimInput(value) {
  return value.trim();
}

/**
 * Save user data to localStorage including JWT token
 * @param {string} name - User full name
 * @param {string} email - User email
 * @param {string} token - JWT auth token
 * @param {string} staffNo - Staff number
 */
function saveUserToStorage(name, email, token, staffNo) {
  localStorage.setItem(CONFIG.STORAGE.AUTH_TOKEN, token);
  localStorage.setItem(CONFIG.STORAGE.USER_NAME, name);
  localStorage.setItem(CONFIG.STORAGE.USER_EMAIL, email);
  localStorage.setItem(CONFIG.STORAGE.STAFF_NO, staffNo || "");
}

/**
 * Clear user data from localStorage
 */
function clearUserFromStorage() {
  localStorage.removeItem(CONFIG.STORAGE.AUTH_TOKEN);
  localStorage.removeItem(CONFIG.STORAGE.USER_NAME);
  localStorage.removeItem(CONFIG.STORAGE.USER_EMAIL);
  localStorage.removeItem(CONFIG.STORAGE.STAFF_NO);
}

/**
 * Get auth token from storage
 * @returns {string|null} JWT token or null
 */
function getAuthToken() {
  return localStorage.getItem(CONFIG.STORAGE.AUTH_TOKEN);
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if token exists
 */
function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * Navigate to a specified page
 * @param {string} page - Page path
 */
function navigateTo(page) {
  window.location.href = page;
}

/**
 * Make authenticated API request
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise} Fetch promise
 */
async function authFetch(url, options = {}) {
  const token = getAuthToken();

  if (!token) {
    throw new Error("No authentication token found");
  }

  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  // Merge headers
  if (options.headers) {
    options.headers = { ...defaultOptions.headers, ...options.headers };
  } else {
    options.headers = defaultOptions.headers;
  }

  return fetch(url, { ...defaultOptions, ...options });
}

// ============================================================================
// PASSWORD VISIBILITY TOGGLE
// ============================================================================

/**
 * Setup password visibility toggle for a password input field
 * @param {string} toggleIconId - ID of the toggle icon element
 * @param {string} inputId - ID of the password input element
 */
function setupPasswordToggle(toggleIconId, inputId) {
  const toggleIcon = getElement(toggleIconId);
  const passwordInput = getElement(inputId);

  if (!toggleIcon || !passwordInput) {
    console.error(`Password toggle setup failed for ${inputId}`);
    return;
  }

  toggleIcon.addEventListener("click", () => {
    const isPassword = passwordInput.getAttribute("type") === "password";
    const newType = isPassword ? "text" : "password";

    passwordInput.setAttribute("type", newType);
    toggleIcon.classList.toggle("fa-eye");
    toggleIcon.classList.toggle("fa-eye-slash");

    console.log(`Password visibility toggled for ${inputId}`);
  });
}

// ============================================================================
// SIGNUP HANDLER
// ============================================================================

/**
 * Validate signup form inputs
 * @param {Object} elements - Object containing form element references
 * @returns {Object|null} Validated form data or null if invalid
 */
function validateSignupForm(elements) {
  const { nameEl, emailEl, phoneEl, staffNoEl, passwordEl } = elements; // ← Add staffNoEl

  if (!nameEl || !emailEl || !phoneEl || !staffNoEl || !passwordEl) {
    // ← Check staffNoEl
    console.error("Signup form elements not found");
    return null;
  }

  const fullName = trimInput(nameEl.value);
  const email = trimInput(emailEl.value);
  const phoneNumber = trimInput(phoneEl.value);
  const staffNo = trimInput(staffNoEl.value); // ← Get staffNo
  const password = trimInput(passwordEl.value);

  // Validate domain
  if (!isValidEmail(email)) {
    showAlert(
      "warning",
      CONFIG.MESSAGES.SIGNUP.DOMAIN_ERROR,
      CONFIG.MESSAGES.SIGNUP.DOMAIN_ERROR,
    );
    return null;
  }

  // Validate staff number
  if (!staffNo) {
    showAlert(
      "warning",
      "Missing Staff Number",
      "Please enter your staff number.",
    );
    return null;
  }

  return {
    fullName,
    email,
    phoneNumber,
    staffNo, // ← Return staffNo
    password,
  };
}

/**
 * Handle signup form submission
 * @param {Event} event - Form submit event
 */
async function handleSignup(event) {
  event.preventDefault();

  const signupForm = getElement(CONFIG.DOM_IDS.SIGNUP_FORM);
  if (!signupForm) {
    return;
  }

  // Get and validate form elements
  const formData = validateSignupForm({
    nameEl: getElement(CONFIG.DOM_IDS.FULL_NAME),
    emailEl: getElement(CONFIG.DOM_IDS.SIGNUP_EMAIL),
    phoneEl: getElement(CONFIG.DOM_IDS.PHONE),
    staffNoEl: getElement(CONFIG.DOM_IDS.STAFF_NO), // ← Add this
    passwordEl: getElement(CONFIG.DOM_IDS.SIGNUP_PASS),
  });

  if (!formData) {
    showAlert(
      "error",
      CONFIG.MESSAGES.SIGNUP.SYSTEM_ERROR,
      CONFIG.MESSAGES.SIGNUP.SYSTEM_ERROR,
    );
    return;
  }

  try {
    const response = await fetch(CONFIG.API.SIGNUP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: formData.fullName,
        email: formData.email,
        phone_number: formData.phoneNumber,
        staff_no: formData.staffNo, // ← Send staff_no
        password: formData.password,
      }),
    });

    if (response.ok) {
      const result = await response.json();

      // Note: Signup doesn't return token, user must login
      // Store minimal info for convenience
      localStorage.setItem(CONFIG.STORAGE.USER_NAME, formData.fullName);
      localStorage.setItem(CONFIG.STORAGE.USER_EMAIL, formData.email);
      localStorage.setItem(
        CONFIG.STORAGE.STAFF_NO,
        result.staff_no || formData.staffNo,
      );

      await showAlert(
        "success",
        CONFIG.MESSAGES.SIGNUP.SUCCESS,
        CONFIG.MESSAGES.SIGNUP.SUCCESS_MSG(formData.fullName),
      );

      navigateTo(CONFIG.PAGES.LOGIN); // ← Redirect to login, not leave form
    } else {
      const errorData = await response.json();
      showAlert(
        "error",
        CONFIG.MESSAGES.SIGNUP.FAILED,
        errorData.error || CONFIG.MESSAGES.SIGNUP.FAILED_MSG,
      );
    }
  } catch (error) {
    console.error("Signup Error:", error);
    showAlert(
      "error",
      CONFIG.MESSAGES.SIGNUP.CONNECTION_ERROR,
      CONFIG.MESSAGES.SIGNUP.CONNECTION_MSG,
    );
  }
}

// ============================================================================
// LOGIN HANDLER
// ============================================================================

/**
 * Validate login form inputs
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Object|null} Validated form data or null if invalid
 */
function validateLoginForm(email, password) {
  const trimmedEmail = trimInput(email);

  if (!isValidEmail(trimmedEmail)) {
    showAlert(
      "warning",
      CONFIG.MESSAGES.LOGIN.DOMAIN_ERROR,
      CONFIG.MESSAGES.LOGIN.DOMAIN_MSG,
    );
    return null;
  }

  return {
    email: trimmedEmail,
    password: trimInput(password),
  };
}

/**
 * Handle login form submission
 * @param {Event} event - Form submit event
 */
async function handleLogin(event) {
  event.preventDefault();

  const emailInput = getElement(CONFIG.DOM_IDS.LOGIN_EMAIL);
  const passwordInput = getElement(CONFIG.DOM_IDS.LOGIN_PASS);

  if (!emailInput || !passwordInput) {
    console.error("Login form elements not found");
    return;
  }

  // Validate form inputs
  const formData = validateLoginForm(emailInput.value, passwordInput.value);
  if (!formData) {
    return;
  }

  try {
    const response = await fetch(CONFIG.API.LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.email,
        password: formData.password,
      }),
    });

    if (response.ok) {
      const result = await response.json();

      // ← UPDATED: Store JWT token and all user data
      saveUserToStorage(
        result.user || result.full_name,
        result.email,
        result.token, // ← JWT token from backend
        result.staff_no, // ← Staff number from backend
      );

      await showAlert(
        "success",
        CONFIG.MESSAGES.LOGIN.SUCCESS,
        CONFIG.MESSAGES.LOGIN.SUCCESS_MSG,
        { showConfirmButton: false, timer: 1500 },
      );

      navigateTo(CONFIG.PAGES.LEAVE_FORM);
    } else {
      const errorData = await response.json();
      showAlert(
        "error",
        CONFIG.MESSAGES.LOGIN.FAILED,
        errorData.error || CONFIG.MESSAGES.LOGIN.FAILED_MSG,
      );
    }
  } catch (error) {
    console.error("Login Error:", error);
    showAlert(
      "error",
      CONFIG.MESSAGES.LOGIN.SERVER_ERROR,
      CONFIG.MESSAGES.LOGIN.SERVER_MSG,
    );
  }
}

// ============================================================================
// LOGOUT HANDLER
// ============================================================================

/**
 * Handle logout confirmation and execution
 */
function handleLogout() {
  showAlert(
    "question",
    CONFIG.MESSAGES.LOGOUT.CONFIRM_TITLE,
    CONFIG.MESSAGES.LOGOUT.CONFIRM_MSG,
    {
      showCancelButton: true,
      confirmButtonColor: CONFIG.COLORS.ERROR,
      cancelButtonColor: CONFIG.COLORS.NEUTRAL,
      confirmButtonText: CONFIG.MESSAGES.LOGOUT.CONFIRM_BTN,
    },
  ).then((result) => {
    if (result.isConfirmed) {
      clearUserFromStorage();
      navigateTo(CONFIG.PAGES.LOGIN);
    }
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize authentication handlers on DOM ready
 */
document.addEventListener("DOMContentLoaded", () => {
  // Setup signup form
  const signupForm = getElement(CONFIG.DOM_IDS.SIGNUP_FORM);
  if (signupForm) {
    signupForm.addEventListener("submit", handleSignup);
  }

  // Setup login form
  const loginForm = getElement(CONFIG.DOM_IDS.LOGIN_FORM);
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // Setup logout button
  const logoutBtn = getElement(CONFIG.DOM_IDS.LOGOUT_BTN);
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (event) => {
      event.preventDefault();
      handleLogout();
    });
  }

  // Setup password visibility toggles
  setupPasswordToggle(
    CONFIG.DOM_IDS.TOGGLE_SIGNUP_PASS,
    CONFIG.DOM_IDS.SIGNUP_PASS,
  );
  setupPasswordToggle(
    CONFIG.DOM_IDS.TOGGLE_LOGIN_PASS,
    CONFIG.DOM_IDS.LOGIN_PASS,
  );

  console.log("Authentication handlers initialized");
});
