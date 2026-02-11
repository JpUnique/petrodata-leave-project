document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");
  const logoutBtn = document.getElementById("logoutBtn");

  // Helper function for consistent PetroData styling
  const toast = (icon, title, text) => {
    return Swal.fire({
      icon: icon,
      title: title,
      text: text,
      confirmButtonColor: icon === "success" ? "#00e676" : "#ff4d4d",
    });
  };

  // ==========================================
  // 1. SIGNUP LOGIC
  // ==========================================
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const elName = document.getElementById("fullName");
      const elEmail = document.getElementById("signupEmail");
      const elPhone = document.getElementById("phone");
      const elPass = document.getElementById("signupPass");

      if (!elName || !elEmail || !elPhone || !elPass) {
        toast(
          "error",
          "System Error",
          "Input IDs do not match HTML. Check console.",
        );
        return;
      }

      const fullName = elName.value;
      const email = elEmail.value;
      const phoneNumber = elPhone.value;
      const password = elPass.value;

      if (!email.endsWith("@petrodata.net")) {
        toast(
          "warning",
          "Access Denied",
          "You must use a @petrodata.net email address.",
        );
        return;
      }

      try {
        const response = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: fullName,
            email: email,
            phone_number: phoneNumber,
            password: password,
          }),
        });

        if (response.ok) {
          localStorage.setItem("userName", fullName);
          localStorage.setItem("userEmail", email);

          Swal.fire({
            icon: "success",
            title: "Welcome aboard!",
            text: "Registration successful for " + fullName,
            confirmButtonColor: "#00e676",
          }).then(() => {
            window.location.href = "leave-form.html";
          });
        } else {
          const errorData = await response.json();
          toast(
            "error",
            "Signup Failed",
            errorData.error || "User already exists or data is invalid.",
          );
        }
      } catch (err) {
        toast(
          "error",
          "Connection Error",
          "The server is unreachable. Please check your connection.",
        );
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

      if (!email.endsWith("@petrodata.net")) {
        toast(
          "warning",
          "Invalid Domain",
          "Please use your company email (@petrodata.net)",
        );
        return;
      }

      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password }),
        });

        if (response.ok) {
          const result = await response.json();
          localStorage.setItem("userName", result.full_name);
          localStorage.setItem("userEmail", email);

          Swal.fire({
            icon: "success",
            title: "Login Successful",
            text: "Redirecting to Leave Portal...",
            showConfirmButton: false,
            timer: 1500,
          }).then(() => {
            window.location.href = "leave-form.html";
          });
        } else {
          toast("error", "Access Denied", "Invalid email or password.");
        }
      } catch (err) {
        toast(
          "error",
          "Server Error",
          "Could not connect to the login service.",
        );
      }
    });
  }

  // ==========================================
  // 3. LOGOUT LOGIC
  // ==========================================
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();

      Swal.fire({
        title: "Are you sure?",
        text: "You will be signed out of the portal.",
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#ff4d4d",
        cancelButtonColor: "#aaa",
        confirmButtonText: "Yes, Sign Out",
      }).then((result) => {
        if (result.isConfirmed) {
          localStorage.removeItem("userName");
          localStorage.removeItem("userEmail");
          window.location.href = "login.html";
        }
      });
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
      this.classList.toggle("fa-eye");
      this.classList.toggle("fa-eye-slash");
    });
  }
}

setupPasswordToggle("toggleSignupPass", "signupPass");
setupPasswordToggle("toggleLoginPass", "loginPass");
