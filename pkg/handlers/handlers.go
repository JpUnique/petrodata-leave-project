package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/JpUnique/petrodata-leave-project/pkg/database"
	email "github.com/JpUnique/petrodata-leave-project/pkg/emailer"
	"github.com/JpUnique/petrodata-leave-project/pkg/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Signup handles the registration of new staff members.
func Signup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	defer r.Body.Close()

	var user models.User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "bad request: invalid JSON", http.StatusBadRequest)
		return
	}

	// 1. Check if user already exists
	var existingUser models.User
	err := database.DB.Where("email = ?", user.Email).First(&existingUser).Error
	if err == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{"error": "User with this email already exists"})
		return
	}

	// 2. Hash the password before saving (Security update)
	// bcrypt.DefaultCost is a good balance between security and speed
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "failed to hash password", http.StatusInternalServerError)
		return
	}
	user.Password = string(hashedPassword) // Replace the plain text password with the hash

	// 3. Set defaults
	user.CreatedAt = time.Now()

	// 4. Database insertion
	// Since we used SERIAL in Postgres, we don't pass an ID; Postgres generates it.
	if err := database.DB.Create(&user).Error; err != nil {
		http.Error(w, "failed to create user in database", http.StatusInternalServerError)
		return
	}

	// 5. Success Response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Registration successful for " + user.FullName,
		"user_id": user.ID, // GORM automatically populates this from the Postgres SERIAL ID
		"email":   user.Email,
	})
}

// SubmitLeaveRequest handles the submission of the leave form to PostgreSQL.
func SubmitLeaveRequest(w http.ResponseWriter, r *http.Request) {
	// 1. Validate Method
	if r.Method != http.MethodPost {
		log.Printf("[WARN] Invalid method %s attempt on SubmitLeaveRequest", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var leaveReq models.LeaveRequest

	// 2. Decode and Validate JSON
	if err := json.NewDecoder(r.Body).Decode(&leaveReq); err != nil {
		log.Printf("[ERROR] Failed to decode leave request body: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Malformed request data"})
		return
	}

	// 3. Initialize Domain Logic/Defaults
	leaveReq.RequestToken = uuid.New().String()
	leaveReq.CreatedAt = time.Now()
	leaveReq.Status = "Pending"
	leaveReq.ManagerApproved = false
	leaveReq.HRApproved = false
	leaveReq.MDApproved = false

	// 4. Persistence Layer
	log.Printf("[INFO] Attempting to save leave request for Staff: %s (Token: %s)", leaveReq.StaffName, leaveReq.RequestToken)

	if err := database.DB.Create(&leaveReq).Error; err != nil {
		// Log the actual error for the dev, but hide DB details from the user
		log.Printf("[DATABASE ERROR] Failed to create leave record: %v", err)
		http.Error(w, "Internal server error: failed to persist request", http.StatusInternalServerError)
		return
	}

	// 5. Build Workflow URL
	// Note: In production, move "http://localhost:8080" to an environment variable
	approvalURL := fmt.Sprintf("http://localhost:8080/approve.html?token=%s", leaveReq.RequestToken)

	// 6. Asynchronous Background Task (Email)
	go func(mEmail, sName, url string) {
		email.SendApprovalEmail(mEmail, sName, url)
		log.Printf("[SUCCESS] Mock email logic completed for %s", mEmail)
	}(leaveReq.ManagerEmail, leaveReq.StaffName, approvalURL)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":       fmt.Sprintf("Leave request submitted successfully for %s", leaveReq.StaffName),
		"request_token": leaveReq.RequestToken,
		"status":        leaveReq.Status,
	})
}

// Login verifies user credentials against the database.
func Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	defer r.Body.Close()

	// 1. Create a temporary struct to capture login input
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	// 2. Query the database for the user by Email ONLY
	var user models.User
	err := database.DB.Where("email = ?", input.Email).First(&user).Error
	if err != nil {
		http.Error(w, "invalid email or password", http.StatusUnauthorized)
		return
	}

	// 3. Compare the hashed password from DB with the plain password from user
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password))
	if err != nil {
		// This means the password was wrong
		http.Error(w, "invalid email or password", http.StatusUnauthorized)
		return
	}

	// 3. Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Login successful",
		"user":    user.FullName,
	})
}

// GetLeaveRequestByToken fetches a single request using the unique UUID token
func GetLeaveRequestByToken(w http.ResponseWriter, r *http.Request) {
	// 1. Validate Method (We use GET because we are fetching data)
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 2. Extract the token from the URL query string
	// Example: /api/leave/details?token=123-abc
	token := r.URL.Query().Get("token")
	if token == "" {
		log.Printf("[WARN] Attempted access to details without token")
		http.Error(w, "token is required", http.StatusBadRequest)
		return
	}

	// 3. Query the database for the Leave Request by Token ONLY
	var leaveReq models.LeaveRequest
	err := database.DB.Where("request_token = ?", token).First(&leaveReq).Error
	if err != nil {
		// This means the token doesn't exist in our records
		log.Printf("[ERROR] Invalid token used: %s", token)
		http.Error(w, "invalid or expired link", http.StatusNotFound)
		return
	}

	// 4. Return success response with the full record
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(leaveReq)
}

func HandleLineManagerAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var input struct {
		Token  string `json:"token"`
		Status string `json:"status"` // "Approved" or "Rejected"
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	var leaveReq models.LeaveRequest
	// 1. Find the request using the Manager's token
	if err := database.DB.Where("request_token = ?", input.Token).First(&leaveReq).Error; err != nil {
		http.Error(w, "Request not found", http.StatusNotFound)
		return
	}

	// 2. Update Status
	leaveReq.Status = input.Status
	if input.Status == "Approved" {
		leaveReq.ManagerApproved = true
		// 3. Generate NEW token for HR
		leaveReq.HRToken = uuid.New().String()
	}

	// 4. Save Changes
	database.DB.Save(&leaveReq)

	// 5. If Approved, "Send" to HR (Terminal Mock)
	if leaveReq.Status == "Approved" {
		hrURL := fmt.Sprintf("http://localhost:8080/approve_hr.html?token=%s", leaveReq.HRToken)
		go func() {
			fmt.Println("\n--- 📧 NOTIFICATION TO HR (MOCK) ---")
			fmt.Printf("SUBJECT: HR Approval Required for %s\n", leaveReq.StaffName)
			fmt.Printf("MANAGER DECISION: Approved\n")
			fmt.Printf("HR LINK: %s\n", hrURL)
			fmt.Println("------------------------------------")
		}()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Action recorded successfully"})
}

func GetLeaveRequestByHRToken(w http.ResponseWriter, r *http.Request) {
	// 1. Validate Method
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 2. Extract the HR token from the URL
	// Example: /api/leave/hr-details?token=hr-uuid-here
	token := r.URL.Query().Get("token")
	if token == "" {
		log.Printf("[WARN] Unauthorized HR access attempt without token")
		http.Error(w, "hr token is required", http.StatusBadRequest)
		return
	}

	var leaveReq models.LeaveRequest

	// 3. Query the database for the HR Token ONLY
	// We check the hr_token column here!
	err := database.DB.Where("hr_token = ?", token).First(&leaveReq).Error
	if err != nil {
		log.Printf("[ERROR] Invalid HR token: %s", token)
		http.Error(w, "invalid or expired HR link", http.StatusNotFound)
		return
	}

	// 4. Return the data to the HR UI
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(leaveReq)
}

func HandleHRManagerAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var input struct {
		Token   string `json:"token"`
		Status  string `json:"status"`   // HR's choice: "Approved" or "Rejected"
		MDEmail string `json:"md_email"` // The MD's email HR enters
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	var leaveReq models.LeaveRequest
	// Find the request using HR's token
	if err := database.DB.Where("hr_token = ?", input.Token).First(&leaveReq).Error; err != nil {
		http.Error(w, "Request not found", http.StatusNotFound)
		return
	}

	// Record HR's decision
	leaveReq.HRDecision = input.Status
	leaveReq.MDEmail = input.MDEmail
	leaveReq.HRApproved = (input.Status == "Approved")

	// GENERATE MD TOKEN (The chain continues to the final level)
	leaveReq.MDToken = uuid.New().String()
	leaveReq.Status = "Pending MD Review"

	database.DB.Save(&leaveReq)

	// Mock Email to MD
	mdURL := fmt.Sprintf("http://localhost:8080/approve_md.html?token=%s", leaveReq.MDToken)
	fmt.Printf("\n--- 📧 FORWARDING TO MD: %s ---\n", leaveReq.MDEmail)
	fmt.Printf("HR DECISION: %s\n", leaveReq.HRDecision)
	fmt.Printf("MD ACCESS LINK: %s\n", mdURL)
	fmt.Println("------------------------------------")

	json.NewEncoder(w).Encode(map[string]string{"message": "Forwarded to MD successfully"})
}

func HandleMDAction(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var input struct {
        Token  string `json:"token"`
        Status string `json:"status"` // MD's choice: "Approved" or "Rejected"
    }

    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, "Invalid request body", http.StatusBadRequest)
        return
    }

    var leaveReq models.LeaveRequest
    // Find the request using the unique MD Token
    if err := database.DB.Where("md_token = ?", input.Token).First(&leaveReq).Error; err != nil {
        http.Error(w, "Request not found or invalid MD token", http.StatusNotFound)
        return
    }

    // 1. Record MD's Decision
    // We update the main 'Status' field here because this is the final authority
    leaveReq.Status = input.Status
    leaveReq.MDApproved = (input.Status == "Approved")

    // 2. Save the final state to the Database
    if err := database.DB.Save(&leaveReq).Error; err != nil {
        http.Error(w, "Failed to finalize request", http.StatusInternalServerError)
        return
    }

    // 3. Final Logging (Notification simulation)
    fmt.Printf("\n--- 🏁 WORKFLOW FINALIZED ---")
    fmt.Printf("\nStaff: %s", leaveReq.StaffName)
    fmt.Printf("\nFinal Status: %s", leaveReq.Status)
    fmt.Printf("\nManager: %s | HR: %s | MD: %s",
        leaveReq.ManagerDecision, leaveReq.HRDecision, leaveReq.Status)
    fmt.Printf("\n-----------------------------\n")

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "message": "Leave request has been successfully finalized.",
        "status":  leaveReq.Status,
    })
}

func GetLeaveRequestByMDToken(w http.ResponseWriter, r *http.Request) {
    // 1. Get the token from the URL query string (?token=...)
    token := r.URL.Query().Get("token")
    if token == "" {
        http.Error(w, "Token is required", http.StatusBadRequest)
        return
    }

    var leaveReq models.LeaveRequest

    // 2. Query the database for the record matching the MD Token
    if err := database.DB.Where("md_token = ?", token).First(&leaveReq).Error; err != nil {
        http.Error(w, "Invalid or expired MD access link", http.StatusNotFound)
        return
    }

    // 3. Return the full data (including ManagerDecision and HRDecision) as JSON
    w.Header().Set("Content-Type", "application/json")
    if err := json.NewEncoder(w).Encode(leaveReq); err != nil {
        http.Error(w, "Error encoding JSON", http.StatusInternalServerError)
    }
}