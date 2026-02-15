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

// Request/Response types (named structs, not anonymous)
type SignupRequest struct {
	FullName    string `json:"full_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	PhoneNumber string `json:"phone_number"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type ManagerActionRequest struct {
	Token   string `json:"token"`
	Status  string `json:"status"`
	HREmail string `json:"hr_email"`
}

type HRActionRequest struct {
	Token   string `json:"token"`
	Status  string `json:"status"`
	MDEmail string `json:"md_email"`
}

type MDActionRequest struct {
	Token  string `json:"token"`
	Status string `json:"status"`
}

// Status constants
const (
	StatusPending         = "Pending"
	StatusApproved        = "Approved"
	StatusRejected        = "Rejected"
	StatusPendingMDReview = "Pending MD Review"
	MethodNotAllowed      = "method not allowed"
	InvalidJSONFormat     = "invalid JSON format"
)

// Signature for standard error responses
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("[ERROR] Failed to encode JSON response: %v", err)
	}
}

// Signature for standard error responses
func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// Signup handles the registration of new staff members.
func Signup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, MethodNotAllowed)
		return
	}

	var req SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, InvalidJSONFormat)
		return
	}

	// Check if user already exists
	var existingUser models.User
	if err := database.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		respondError(w, http.StatusConflict, "user with this email already exists")
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("[ERROR] Failed to hash password: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	// Create user
	user := models.User{
		FullName:    req.FullName,
		Email:       req.Email,
		Password:    string(hashedPassword),
		PhoneNumber: req.PhoneNumber,
		CreatedAt:   time.Now(),
	}

	if err := database.DB.Create(&user).Error; err != nil {
		log.Printf("[ERROR] Failed to create user in database: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"message": fmt.Sprintf("Registration successful for %s", user.FullName),
		"user_id": user.ID,
		"email":   user.Email,
	})
}

// SubmitLeaveRequest handles the submission of leave requests to PostgreSQL.
func SubmitLeaveRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		log.Printf("[WARN] Invalid method %s attempt on SubmitLeaveRequest", r.Method)
		respondError(w, http.StatusMethodNotAllowed, MethodNotAllowed)
		return
	}

	var leaveReq models.LeaveRequest
	if err := json.NewDecoder(r.Body).Decode(&leaveReq); err != nil {
		log.Printf("[ERROR] Failed to decode leave request body: %v", err)
		respondError(w, http.StatusBadRequest, "malformed request data")
		return
	}

	// Initialize defaults
	leaveReq.RequestToken = uuid.New().String()
	leaveReq.CreatedAt = time.Now()
	leaveReq.Status = StatusPending
	leaveReq.ManagerApproved = false
	leaveReq.HRApproved = false
	leaveReq.MDApproved = false

	log.Printf("[INFO] Attempting to save leave request for Staff: %s (Token: %s)", leaveReq.StaffName, leaveReq.RequestToken)

	if err := database.DB.Create(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Failed to create leave record: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to persist request")
		return
	}

	// Build approval URL
	approvalURL := fmt.Sprintf("http://localhost:8080/approve.html?token=%s", leaveReq.RequestToken)

	// Send email asynchronously
	go func(managerEmail, staffName, url string) {
		email.SendApprovalEmail(managerEmail, staffName, url)
		log.Printf("[INFO] Email sent to %s for %s", managerEmail, staffName)
	}(leaveReq.ManagerEmail, leaveReq.StaffName, approvalURL)

	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"message":       fmt.Sprintf("Leave request submitted successfully for %s", leaveReq.StaffName),
		"request_token": leaveReq.RequestToken,
		"status":        leaveReq.Status,
	})
}

// Login verifies user credentials against the database.
func Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, MethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, InvalidJSONFormat)
		return
	}

	// Query database for user
	var user models.User
	err := database.DB.Where("email = ?", req.Email).First(&user).Error
	if err != nil {
		respondError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		respondError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "login successful",
		"user":    user.FullName,
	})
}

// GetLeaveRequestByToken fetches a leave request using the unique UUID token.
func GetLeaveRequestByToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, MethodNotAllowed)
		return
	}

	token := r.URL.Query().Get("token")
	if token == "" {
		log.Printf("[WARN] Attempted access to details without token")
		respondError(w, http.StatusBadRequest, "token is required")
		return
	}

	var leaveReq models.LeaveRequest
	if err := database.DB.Where("request_token = ?", token).First(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Invalid token used: %s", token)
		respondError(w, http.StatusNotFound, "invalid or expired link")
		return
	}

	respondJSON(w, http.StatusOK, leaveReq)
}

// HandleLineManagerAction processes manager approval/rejection decisions.
func HandleLineManagerAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req ManagerActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, InvalidJSONFormat)
		return
	}

	var leaveReq models.LeaveRequest
	if err := database.DB.Where("request_token = ?", req.Token).First(&leaveReq).Error; err != nil {
		respondError(w, http.StatusNotFound, "request not found")
		return
	}

	// 1. Record the Decision (regardless of Approve/Reject)
	leaveReq.ManagerDecision = req.Status
	leaveReq.ManagerApproved = (req.Status == StatusApproved)
	leaveReq.HREmail = req.HREmail // Capture the email from the UI

	// 2. Set the descriptive status for the next person in line
	leaveReq.Status = "Pending HR Review"

	// 3. ALWAYS generate the HR Token so the chain continues
	leaveReq.HRToken = uuid.New().String()

	// 4. Save the progress to the database
	if err := database.DB.Save(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Failed to save manager action: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to save action")
		return
	}

	// 5. Generate and log the URL for HR (Mock notification)
	hrURL := fmt.Sprintf("http://localhost:8080/approve_hr.html?token=%s", leaveReq.HRToken)
	log.Printf("[INFO] Baton passed to HR: %s | Manager Decision: %s | Link: %s",
		leaveReq.HREmail, leaveReq.ManagerDecision, hrURL)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Action recorded; request forwarded to HR.",
		"status":  leaveReq.Status,
	})
}

// GetLeaveRequestByHRToken fetches a leave request using the HR token.
func GetLeaveRequestByHRToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	token := r.URL.Query().Get("token")
	if token == "" {
		log.Printf("[WARN] Unauthorized HR access attempt without token")
		respondError(w, http.StatusBadRequest, "hr token is required")
		return
	}

	var leaveReq models.LeaveRequest
	if err := database.DB.Where("hr_token = ?", token).First(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Invalid HR token: %s", token)
		respondError(w, http.StatusNotFound, "invalid or expired HR link")
		return
	}

	respondJSON(w, http.StatusOK, leaveReq)
}

// HandleHRManagerAction processes HR approval/rejection and forwards to MD.
func HandleHRManagerAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req HRActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, InvalidJSONFormat)
		return
	}

	var leaveReq models.LeaveRequest
	if err := database.DB.Where("hr_token = ?", req.Token).First(&leaveReq).Error; err != nil {
		respondError(w, http.StatusNotFound, "request not found")
		return
	}

	// Record HR decision
	leaveReq.HRDecision = req.Status
	leaveReq.MDEmail = req.MDEmail
	leaveReq.HRApproved = (req.Status == StatusApproved)
	leaveReq.MDToken = uuid.New().String()
	leaveReq.Status = StatusPendingMDReview

	if err := database.DB.Save(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Failed to save HR action: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to save action")
		return
	}

	// Log MD notification
	mdURL := fmt.Sprintf("http://localhost:8080/approve_md.html?token=%s", leaveReq.MDToken)
	log.Printf("[INFO] Forwarding to MD: %s | HR Decision: %s | Link: %s",
		leaveReq.MDEmail, leaveReq.HRDecision, mdURL)

	respondJSON(w, http.StatusOK, map[string]string{"message": "forwarded to MD successfully"})
}

// HandleMDAction processes the final MD approval/rejection.
func HandleMDAction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req MDActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, InvalidJSONFormat)
		return
	}

	var leaveReq models.LeaveRequest
	if err := database.DB.Where("md_token = ?", req.Token).First(&leaveReq).Error; err != nil {
		respondError(w, http.StatusNotFound, "request not found or invalid MD token")
		return
	}

	// Record MD decision
	leaveReq.MDDecision = req.Status
	leaveReq.Status = req.Status
	leaveReq.MDApproved = (req.Status == StatusApproved)
	leaveReq.FinalHRToken = uuid.New().String()

	if err := database.DB.Save(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Failed to finalize request: %v", err)
		respondError(w, http.StatusInternalServerError, "failed to finalize request")
		return
	}

	// Log finalization
	finalArchiveURL := fmt.Sprintf("http://localhost:8080/final_archive.html?token=%s", leaveReq.FinalHRToken)
	log.Printf("[INFO] Workflow finalized for %s | Status: %s | Archive: %s",
		leaveReq.StaffName, leaveReq.Status, finalArchiveURL)

	respondJSON(w, http.StatusOK, map[string]string{
		"message":      "leave request finalized",
		"status":       leaveReq.Status,
		"archive_link": finalArchiveURL,
	})
}

// GetLeaveRequestByMDToken fetches a leave request using the MD token.
func GetLeaveRequestByMDToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	token := r.URL.Query().Get("token")
	if token == "" {
		respondError(w, http.StatusBadRequest, "token is required")
		return
	}

	var leaveReq models.LeaveRequest
	if err := database.DB.Where("md_token = ?", token).First(&leaveReq).Error; err != nil {
		respondError(w, http.StatusNotFound, "invalid or expired MD access link")
		return
	}

	respondJSON(w, http.StatusOK, leaveReq)
}

// GetFinalArchiveDetails fetches the finalized leave request for archival.
func GetFinalArchiveDetails(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	token := r.URL.Query().Get("token")
	if token == "" {
		respondError(w, http.StatusBadRequest, "archive token is required")
		return
	}

	var leaveReq models.LeaveRequest
	if err := database.DB.Where("final_hr_token = ?", token).First(&leaveReq).Error; err != nil {
		respondError(w, http.StatusNotFound, "archive record not found or invalid token")
		return
	}

	respondJSON(w, http.StatusOK, leaveReq)
}
