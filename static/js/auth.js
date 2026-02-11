document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");
  const logoutBtn = document.getElementById("logoutBtn");

  // ==========================================
  // 1. SIGNUP LOGIC
  // ==========================================
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Grab all inputs from the UI
      const fullName = document.getElementById("fullName").value;
      const email = document.getElementById("signupEmail").value;
      const phoneNumber = document.getElementById("phoneNumber").value;
      const password = document.getElementById("signupPass").value;

      // --- Frontend Validation ---
      // Requirement: Must be a company email
      if (!email.endsWith("@petrodata.net")) {
        alert("Access Denied: You must use a @petrodata.net email address.");
        return;
      }

      // Requirement: Strong Password Check
      const strongRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/;
      if (!strongRegex.test(password)) {
        alert(
          "Password too weak! Requirements: 8+ characters, Uppercase, Number, and Symbol.",
        );
        return;
      }

      // --- API Request ---
      try {
        const response = await fetch("/api/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            full_name: fullName,
            email: email,
            phone_number: phoneNumber,
            password: password,
          }),
        });

        if (response.ok) {
          // Store details immediately so they don't have to login after signing up
          localStorage.setItem("userName", fullName);
          localStorage.setItem("userEmail", email);

          alert("Registration Successful!");
          // Redirect straight to the leave form
          window.location.href = "leave-form.html";
        } else {
          const errorData = await response.text();
          alert("Signup Failed: " + errorData);
        }
      } catch (err) {
        console.error("Signup Error:", err);
        alert("Server connection error. Please ensure the backend is running.");
      }
    });
  }

  // ==========================================
  // 2. LOGIN LOGIC
  // ==========================================
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("loginEmail").value;
      const password = document.getElementById("loginPass").value;

      // --- Frontend Validation ---
      if (!email.endsWith("@petrodata.net")) {
        alert("Please use your company email (@petrodata.net)");
        return;
      }

      // --- API Request ---
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            password: password,
          }),
        });

        if (response.ok) {
          // Parse the response to get the user's Full Name from the database
          const result = await response.json();

          // Save to LocalStorage for use in the leave form
          localStorage.setItem("userName", result.user);
          localStorage.setItem("userEmail", email);

          console.log("Login Successful for:", result.user);
          window.location.href = "leave-form.html";
        } else {
          const errorMsg = await response.text();
          alert("Login Failed: " + (errorMsg || "Invalid credentials"));
        }
      } catch (err) {
        console.error("Login Error:", err);
        alert("Server connection error.");
      }
    });
  }

  // ==========================================
  // 3. LOGOUT LOGIC
  // ==========================================
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // Clear the session data
      localStorage.removeItem("userName");
      localStorage.removeItem("userEmail");

      console.log("User logged out successfully.");

      // Redirect to login page
      window.location.href = "login.html";
    });
  }
});

// ==========================================
// 4. PASSWORD TOGGLE VISIBILITY
// ==========================================
function setupPasswordToggle(toggleId, inputId) {
  const toggleIcon = document.getElementById(toggleId);
  const passwordInput = document.getElementById(inputId);

  if (toggleIcon && passwordInput) {
    toggleIcon.addEventListener("click", function () {
      const isPassword = passwordInput.getAttribute("type") === "password";
      passwordInput.setAttribute("type", isPassword ? "text" : "password");

      // Toggle the FontAwesome icon classes
      this.classList.toggle("fa-eye");
      this.classList.toggle("fa-eye-slash");
    });
  }
}

// Initialize toggles for both pages
setupPasswordToggle("toggleSignupPass", "signupPass");
setupPasswordToggle("toggleLoginPass", "loginPass");
