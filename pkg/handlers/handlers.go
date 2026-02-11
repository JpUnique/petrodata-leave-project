package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/JpUnique/petrodata-leave-project/pkg/database"
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
	go func(req models.LeaveRequest, url string) {
		log.Printf("[WORKFLOW] Triggering approval email to Manager: %s", req.ManagerEmail)

		// In a real scenario, you'd call: utils.SendApprovalEmail(req.ManagerEmail, req.StaffName, url)
		// For now, we simulate success in the logs
		log.Printf("[SUCCESS] Approval link generated: %s", url)
	}(leaveReq, approvalURL)

	// 7. Standard Success Response
	log.Printf("[INFO] Leave request %s successfully accepted", leaveReq.RequestToken)

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
