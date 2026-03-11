// Package handlers provides HTTP request handlers for the PetroData leave management system.
// It manages the complete leave request workflow including signup, submission, and multi-level approvals.
package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/JpUnique/petrodata-leave-project/pkg/database"
	"github.com/JpUnique/petrodata-leave-project/pkg/models"
	"github.com/JpUnique/petrodata-leave-project/pkg/service"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

// SignupRequest represents the user registration request payload.
type SignupRequest struct {
	FullName    string `json:"full_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	PhoneNumber string `json:"phone_number"`
}

// LoginRequest represents the user login request payload.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// ManagerActionRequest represents the line manager's approval/rejection decision.
type ManagerActionRequest struct {
	Token   string `json:"token"`
	Status  string `json:"status"` // "Approved" or "Rejected"
	HREmail string `json:"hr_email"`
	Reason  string `json:"reason,omitempty"` // Required if rejected
}

// HRActionRequest represents the HR manager's approval/rejection decision.
type HRActionRequest struct {
	Token   string `json:"token"`
	Status  string `json:"status"` // "Approved" or "Rejected"
	MDEmail string `json:"md_email"`
	Reason  string `json:"reason,omitempty"` // Required if rejected
}

// MDActionRequest represents the Managing Director's final approval/rejection decision.
type MDActionRequest struct {
	Token  string `json:"token"`
	Status string `json:"status"`           // "Approved" or "Rejected"
	Reason string `json:"reason,omitempty"` // Required if rejected
}

// ============================================================================
// STATUS AND ERROR CONSTANTS
// ============================================================================

// Leave request status constants
const (
	StatusPending           = "Pending"
	StatusApproved          = "Approved"
	StatusRejected          = "Rejected"
	StatusPendingMDReview   = "Pending MD Review"
	StatusPendingHRReview   = "Pending HR Review"
	StatusPendingMDApproval = "Pending MD Final Approval"
	StatusRejectedByManager = "Rejected by Manager - Pending HR Filing"
	StatusRejectedByHR      = "Rejected by HR - Pending MD Review"
	StatusRejectedByMD      = "Rejected by MD"
	StatusFullyApproved     = "Fully Approved"
)

// HTTP error message constants
const (
	ErrMethodNotAllowed       = "method not allowed"
	ErrInvalidJSON            = "invalid JSON format"
	ErrMissingToken           = "token is required"
	ErrTokenNotFound          = "invalid or expired token"
	ErrUserExists             = "user with this email already exists"
	ErrHashPassword           = "failed to hash password"
	ErrCreateUser             = "failed to create user"
	ErrMalformedRequest       = "malformed request data"
	ErrPersistRequest         = "failed to persist request"
	ErrSaveAction             = "failed to save action"
	ErrFinalizeRequest        = "failed to finalize request"
	ErrInvalidCredentials     = "invalid email or password"
	ErrRequestNotFound        = "request not found"
	ErrMissingRejectionReason = "rejection reason is required"
)

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// respondJSON writes a JSON response with the specified status code and data.
// It handles encoding errors and logs them appropriately.
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("[ERROR] Failed to encode JSON response: %v", err)
	}
}

// respondError writes a JSON error response with the specified status code and message.
// It wraps the error message in a standard error object.
func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// validateToken checks if a token is empty and returns an error response if needed.
func validateToken(w http.ResponseWriter, token string) bool {
	if token == "" {
		log.Printf("[WARN] Attempted access without token")
		respondError(w, http.StatusBadRequest, ErrMissingToken)
		return false
	}
	return true
}

// validateHTTPMethod checks if the request method is allowed and returns an error response if not.
func validateHTTPMethod(w http.ResponseWriter, method, allowedMethod string) bool {
	if method != allowedMethod {
		respondError(w, http.StatusMethodNotAllowed, ErrMethodNotAllowed)
		return false
	}
	return true
}

// ============================================================================
// AUTHENTICATION HANDLERS
// ============================================================================

// Signup handles the registration of new staff members.
// It validates the request, checks for duplicate emails, hashes the password,
// and creates a new user record in the database.
//
// Request body should contain:
// - full_name: Staff member's full name
// - email: Unique email address
// - password: Plain text password (will be hashed)
// - phone_number: Contact phone number
//
// Returns: User ID and email on success, error message on failure
func Signup(w http.ResponseWriter, r *http.Request) {
	if !validateHTTPMethod(w, r.Method, http.MethodPost) {
		return
	}

	var req SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[ERROR] Failed to decode signup request: %v", err)
		respondError(w, http.StatusBadRequest, ErrInvalidJSON)
		return
	}

	// Check if user already exists
	var existingUser models.User
	if err := database.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		log.Printf("[WARN] Signup attempt with existing email: %s", req.Email)
		respondError(w, http.StatusConflict, ErrUserExists)
		return
	}

	// Hash password with bcrypt
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("[ERROR] Failed to hash password: %v", err)
		respondError(w, http.StatusInternalServerError, ErrHashPassword)
		return
	}

	// Create new user record
	user := models.User{
		FullName:    req.FullName,
		Email:       req.Email,
		Password:    string(hashedPassword),
		PhoneNumber: req.PhoneNumber,
		CreatedAt:   time.Now(),
	}

	if err := database.DB.Create(&user).Error; err != nil {
		log.Printf("[ERROR] Failed to create user in database: %v", err)
		respondError(w, http.StatusInternalServerError, ErrCreateUser)
		return
	}

	log.Printf("[INFO] User registered successfully: %s (%s)", user.FullName, user.Email)

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"message": fmt.Sprintf("Registration successful for %s", user.FullName),
		"user_id": user.ID,
		"email":   user.Email,
	})
}

// Login verifies user credentials against the database.
// It checks if the email exists and validates the password hash.
//
// Request body should contain:
// - email: User's email address
// - password: Plain text password
//
// Returns: Success message and user's full name on success, error message on failure
func Login(w http.ResponseWriter, r *http.Request) {
	if !validateHTTPMethod(w, r.Method, http.MethodPost) {
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[ERROR] Failed to decode login request: %v", err)
		respondError(w, http.StatusBadRequest, ErrInvalidJSON)
		return
	}

	// Query database for user
	var user models.User
	if err := database.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		log.Printf("[WARN] Login attempt with non-existent email: %s", req.Email)
		respondError(w, http.StatusUnauthorized, ErrInvalidCredentials)
		return
	}

	// Verify password hash matches
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		log.Printf("[WARN] Login attempt with invalid password for email: %s", req.Email)
		respondError(w, http.StatusUnauthorized, ErrInvalidCredentials)
		return
	}

	log.Printf("[INFO] User logged in successfully: %s", user.Email)

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "login successful",
		"user":    user.FullName,
	})
}

// ============================================================================
// LEAVE REQUEST SUBMISSION
// ============================================================================

// SubmitLeaveRequest handles the initial submission of a leave request.
// It validates the request data, assigns a unique token, stores the record,
// and sends an email notification to the staff member's manager.
//
// Request body should contain all LeaveRequest model fields including:
// - staff_name, staff_email, staff_no, designation, department
// - leave_type, start_date, resumption_date, total_days
// - relief_staff, contact_address, manager_email
//
// Returns: Request token and initial status on success, error message on failure
// Side effect: Sends email to manager asynchronously
func SubmitLeaveRequest(w http.ResponseWriter, r *http.Request) {
	if !validateHTTPMethod(w, r.Method, http.MethodPost) {
		return
	}

	var leaveReq models.LeaveRequest
	if err := json.NewDecoder(r.Body).Decode(&leaveReq); err != nil {
		log.Printf("[ERROR] Failed to decode leave request body: %v", err)
		respondError(w, http.StatusBadRequest, ErrMalformedRequest)
		return
	}

	// // Validate required fields
	// if leaveReq.StaffEmail == "" {
	// 	respondError(w, http.StatusBadRequest, "staff_email is required")
	// 	return
	// }
	if leaveReq.ManagerEmail == "" {
		respondError(w, http.StatusBadRequest, "manager_email is required")
		return
	}

	// Initialize request with defaults
	leaveReq.RequestToken = uuid.New().String()
	leaveReq.CreatedAt = time.Now()
	leaveReq.Status = StatusPending
	leaveReq.ManagerApproved = false
	leaveReq.HRApproved = false
	leaveReq.MDApproved = false

	log.Printf("[INFO] Attempting to save leave request for Staff: %s (Token: %s)", leaveReq.StaffName, leaveReq.RequestToken)

	// Persist request to database
	if err := database.DB.Create(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Failed to create leave record: %v", err)
		respondError(w, http.StatusInternalServerError, ErrPersistRequest)
		return
	}

	// Send manager notification email asynchronously
	go func(emailAddr, name, token string) {
		if err := service.SendToManager(emailAddr, name, token); err != nil {
			log.Printf("[ERROR] Manager email failed for %s: %v", name, err)
		} else {
			log.Printf("[INFO] Email successfully dispatched to Manager: %s", emailAddr)
		}
	}(leaveReq.ManagerEmail, leaveReq.StaffName, leaveReq.RequestToken)

	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"message":       fmt.Sprintf("Leave request submitted successfully for %s", leaveReq.StaffName),
		"request_token": leaveReq.RequestToken,
		"status":        leaveReq.Status,
	})
}

// ============================================================================
// APPROVAL WORKFLOW - RETRIEVAL HANDLERS
// ============================================================================

// GetLeaveRequestByToken retrieves a leave request using the unique request token.
// This is called by the manager before they review the leave request.
//
// Query params:
// - token: The unique request token (required)
//
// Returns: Complete LeaveRequest object on success, error message on failure
func GetLeaveRequestByToken(w http.ResponseWriter, r *http.Request) {
	if !validateHTTPMethod(w, r.Method, http.MethodGet) {
		return
	}

	token := r.URL.Query().Get("token")
	if !validateToken(w, token) {
		return
	}

	var leaveReq models.LeaveRequest
	if err := database.DB.Where("request_token = ?", token).First(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Invalid request token: %s", token)
		respondError(w, http.StatusNotFound, ErrTokenNotFound)
		return
	}

	respondJSON(w, http.StatusOK, leaveReq)
}

// GetLeaveRequestByHRToken retrieves a leave request using the HR-specific token.
// This is called by the HR manager before they review the manager's decision.
//
// Query params:
// - token: The unique HR token (required)
//
// Returns: Complete LeaveRequest object on success, error message on failure
func GetLeaveRequestByHRToken(w http.ResponseWriter, r *http.Request) {
	if !validateHTTPMethod(w, r.Method, http.MethodGet) {
		return
	}

	token := r.URL.Query().Get("token")
	if !validateToken(w, token) {
		return
	}

	var leaveReq models.LeaveRequest
	if err := database.DB.Where("hr_token = ?", token).First(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Invalid HR token: %s", token)
		respondError(w, http.StatusNotFound, ErrTokenNotFound)
		return
	}

	respondJSON(w, http.StatusOK, leaveReq)
}

// GetLeaveRequestByMDToken retrieves a leave request using the MD-specific token.
// This is called by the Managing Director before they review the HR decision.
//
// Query params:
// - token: The unique MD token (required)
//
// Returns: Complete LeaveRequest object on success, error message on failure
func GetLeaveRequestByMDToken(w http.ResponseWriter, r *http.Request) {
	if !validateHTTPMethod(w, r.Method, http.MethodGet) {
		return
	}

	token := r.URL.Query().Get("token")
	if !validateToken(w, token) {
		return
	}

	var leaveReq models.LeaveRequest
	if err := database.DB.Where("md_token = ?", token).First(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Invalid MD token: %s", token)
		respondError(w, http.StatusNotFound, ErrTokenNotFound)
		return
	}

	respondJSON(w, http.StatusOK, leaveReq)
}

// GetFinalArchiveDetails retrieves the finalized leave request for archival purposes.
// This is called by HR to view the complete approval chain and generate PDFs.
//
// Query params:
// - token: The unique final HR archive token (required)
//
// Returns: Complete finalized LeaveRequest object on success, error message on failure
func GetFinalArchiveDetails(w http.ResponseWriter, r *http.Request) {
	if !validateHTTPMethod(w, r.Method, http.MethodGet) {
		return
	}

	token := r.URL.Query().Get("token")
	if !validateToken(w, token) {
		return
	}

	var leaveReq models.LeaveRequest
	if err := database.DB.Where("final_hr_token = ?", token).First(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Invalid final archive token: %s", token)
		respondError(w, http.StatusNotFound, ErrTokenNotFound)
		return
	}

	respondJSON(w, http.StatusOK, leaveReq)
}

// ============================================================================
// APPROVAL WORKFLOW - DECISION HANDLERS
// ============================================================================

// HandleLineManagerAction processes the line manager's approval or rejection decision.
// Updates the request status and sends the request to HR for processing.
//
// Request body:
// - token: Request token (required)
// - status: "Approved" or "Rejected" (required)
// - hr_email: HR manager's email address (required for approval)
// - reason: Rejection reason (required if status is "Rejected")
//
// Workflow:
// 1. Validates rejection reason if applicable
// 2. Records the manager's decision
// 3. Sets appropriate status (Pending HR Review or Rejected by Manager)
// 4. Generates a unique HR token (for approvals) or notifies staff (for rejections)
// 5. Saves changes to database
// 6. Sends email notification to HR or staff
//
// Returns: Success message on completion
// Side effect: Sends email asynchronously
func HandleLineManagerAction(w http.ResponseWriter, r *http.Request) {
	if !validateHTTPMethod(w, r.Method, http.MethodPost) {
		return
	}

	var req ManagerActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[ERROR] Failed to decode manager action request: %v", err)
		respondError(w, http.StatusBadRequest, ErrInvalidJSON)
		return
	}

	// Validate rejection reason if status is Rejected
	if req.Status == StatusRejected && req.Reason == "" {
		log.Printf("[WARN] Rejection attempted without reason for token: %s", req.Token)
		respondError(w, http.StatusBadRequest, ErrMissingRejectionReason)
		return
	}

	// Validate HR email if approving
	if req.Status == StatusApproved && req.HREmail == "" {
		respondError(w, http.StatusBadRequest, "hr_email is required for approval")
		return
	}

	// Retrieve the leave request
	var leaveReq models.LeaveRequest
	if err := database.DB.Where("request_token = ?", req.Token).First(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Leave request not found for token: %s", req.Token)
		respondError(w, http.StatusNotFound, ErrRequestNotFound)
		return
	}

	// Record the manager's decision
	leaveReq.ManagerDecision = req.Status
	leaveReq.ManagerApproved = (req.Status == StatusApproved)
	leaveReq.HREmail = req.HREmail

	// Handle approval path
	if leaveReq.ManagerApproved {
		leaveReq.Status = StatusPendingHRReview
		leaveReq.HRToken = uuid.New().String()

		// Save before sending email
		if err := database.DB.Save(&leaveReq).Error; err != nil {
			log.Printf("[ERROR] Failed to save manager approval: %v", err)
			respondError(w, http.StatusInternalServerError, ErrSaveAction)
			return
		}

		// Notify HR of approval
		go func(hrEmail, staffName, token string) {
			if err := service.SendToHR(hrEmail, staffName, token); err != nil {
				log.Printf("[ERROR] Failed to send email to HR (%s): %v", hrEmail, err)
			} else {
				log.Printf("[INFO] HR notification sent for %s", staffName)
			}
		}(leaveReq.HREmail, leaveReq.StaffName, leaveReq.HRToken)

		log.Printf("[INFO] Manager approved request for %s, forwarded to HR", leaveReq.StaffName)

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"message": "Request approved and forwarded to HR.",
			"status":  leaveReq.Status,
		})
		return
	}

	// Handle rejection path
	leaveReq.Status = StatusRejectedByManager

	if err := database.DB.Save(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Failed to save manager rejection: %v", err)
		respondError(w, http.StatusInternalServerError, ErrSaveAction)
		return
	}

	// Notify staff of rejection
	go func(staffEmail, staffName, reason string) {
		if err := service.SendRejectionNotification(staffEmail, staffName, "Line Manager", reason); err != nil {
			log.Printf("[ERROR] Failed to send rejection email to staff (%s): %v", staffEmail, err)
		} else {
			log.Printf("[INFO] Rejection notification sent to staff %s", staffName)
		}
	}(leaveReq.StaffEmail, leaveReq.StaffName, req.Reason)

	log.Printf("[INFO] Manager rejected request for %s, staff notified", leaveReq.StaffName)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Request rejected. Staff has been notified.",
		"status":  leaveReq.Status,
	})
}

// HandleHRManagerAction processes the HR manager's approval or rejection decision.
// Updates the request status and forwards the request to the MD for final approval.
//
// Request body:
// - token: HR token (required)
// - status: "Approved" or "Rejected" (required)
// - md_email: Managing Director's email address (required for approval)
// - reason: Rejection reason (required if status is "Rejected")
//
// Workflow:
// 1. Validates rejection reason if applicable
// 2. Records the HR's decision
// 3. Sets appropriate status (Pending MD Final Approval or Rejected by HR)
// 4. Generates a unique MD token (for approvals) or notifies staff (for rejections)
// 5. Saves changes to database
// 6. Sends email notification to MD or staff
//
// Returns: Success message on completion
// Side effect: Sends email asynchronously
func HandleHRManagerAction(w http.ResponseWriter, r *http.Request) {
	if !validateHTTPMethod(w, r.Method, http.MethodPost) {
		return
	}

	var req HRActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[ERROR] Failed to decode HR action request: %v", err)
		respondError(w, http.StatusBadRequest, ErrInvalidJSON)
		return
	}

	// Validate rejection reason if status is Rejected
	if req.Status == StatusRejected && req.Reason == "" {
		log.Printf("[WARN] HR rejection attempted without reason for token: %s", req.Token)
		respondError(w, http.StatusBadRequest, ErrMissingRejectionReason)
		return
	}

	// Validate MD email if approving
	if req.Status == StatusApproved && req.MDEmail == "" {
		respondError(w, http.StatusBadRequest, "md_email is required for approval")
		return
	}

	// Retrieve the leave request
	var leaveReq models.LeaveRequest
	if err := database.DB.Where("hr_token = ?", req.Token).First(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Leave request not found for HR token: %s", req.Token)
		respondError(w, http.StatusNotFound, ErrRequestNotFound)
		return
	}

	// Record the HR's decision
	leaveReq.HRDecision = req.Status
	leaveReq.HRApproved = (req.Status == StatusApproved)
	leaveReq.MDEmail = req.MDEmail

	// Handle approval path
	if leaveReq.HRApproved {
		leaveReq.Status = StatusPendingMDApproval
		leaveReq.MDToken = uuid.New().String()

		if err := database.DB.Save(&leaveReq).Error; err != nil {
			log.Printf("[ERROR] Failed to save HR approval: %v", err)
			respondError(w, http.StatusInternalServerError, ErrSaveAction)
			return
		}

		// Notify MD of approval
		go func(mdEmail, staffName, token string) {
			if err := service.SendToMD(mdEmail, staffName, token); err != nil {
				log.Printf("[ERROR] Failed to send email to MD (%s): %v", mdEmail, err)
			} else {
				log.Printf("[INFO] MD notification sent for %s", staffName)
			}
		}(leaveReq.MDEmail, leaveReq.StaffName, leaveReq.MDToken)

		log.Printf("[INFO] HR approved request for %s, forwarded to MD", leaveReq.StaffName)

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"message": "HR approved. Request forwarded to MD for final action.",
			"status":  leaveReq.Status,
		})
		return
	}

	// Handle rejection path
	leaveReq.Status = StatusRejectedByHR

	if err := database.DB.Save(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Failed to save HR rejection: %v", err)
		respondError(w, http.StatusInternalServerError, ErrSaveAction)
		return
	}

	// Notify staff of rejection
	go func(staffEmail, staffName, reason string) {
		if err := service.SendRejectionNotification(staffEmail, staffName, "HR Department", reason); err != nil {
			log.Printf("[ERROR] Failed to send rejection email to staff (%s): %v", staffEmail, err)
		} else {
			log.Printf("[INFO] HR rejection notification sent to staff %s", staffName)
		}
	}(leaveReq.StaffEmail, leaveReq.StaffName, req.Reason)

	log.Printf("[INFO] HR rejected request for %s, staff notified", leaveReq.StaffName)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Request rejected by HR. Staff has been notified.",
		"status":  leaveReq.Status,
	})
}

// HandleMDAction processes the Managing Director's final approval or rejection decision.
// This is the final step in the approval workflow.
//
// Request body:
// - token: MD token (required)
// - status: "Approved" or "Rejected" (required)
// - reason: Rejection reason (required if status is "Rejected")
//
// Workflow:
// 1. Validates rejection reason if applicable
// 2. Records the MD's final decision
// 3. Sets final status (Fully Approved or Rejected by MD)
// 4. Generates a final archive token (for approvals) or notifies staff (for rejections)
// 5. Saves changes to database
// 6. Sends email notification to HR or staff
//
// Returns: Final status message on completion
// Side effect: Sends email asynchronously
func HandleMDAction(w http.ResponseWriter, r *http.Request) {
	if !validateHTTPMethod(w, r.Method, http.MethodPost) {
		return
	}

	var req MDActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[ERROR] Failed to decode MD action request: %v", err)
		respondError(w, http.StatusBadRequest, ErrInvalidJSON)
		return
	}

	// Validate rejection reason if status is Rejected
	if req.Status == StatusRejected && req.Reason == "" {
		log.Printf("[WARN] MD rejection attempted without reason for token: %s", req.Token)
		respondError(w, http.StatusBadRequest, ErrMissingRejectionReason)
		return
	}

	// Retrieve the leave request
	var leaveReq models.LeaveRequest
	if err := database.DB.Where("md_token = ?", req.Token).First(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Leave request not found for MD token: %s", req.Token)
		respondError(w, http.StatusNotFound, ErrRequestNotFound)
		return
	}

	// Record the MD's final decision
	leaveReq.MDDecision = req.Status
	leaveReq.MDApproved = (req.Status == StatusApproved)

	// Handle approval path
	if leaveReq.MDApproved {
		leaveReq.Status = StatusFullyApproved
		leaveReq.FinalHRToken = uuid.New().String()

		if err := database.DB.Save(&leaveReq).Error; err != nil {
			log.Printf("[ERROR] Failed to finalize request: %v", err)
			respondError(w, http.StatusInternalServerError, ErrFinalizeRequest)
			return
		}

		// Notify HR of final approval
		go func(hrEmail, staffName, token string) {
			if err := service.SendFinalArchiveToHR(hrEmail, staffName, token); err != nil {
				log.Printf("[ERROR] Failed to send final archive email to HR (%s): %v", hrEmail, err)
			} else {
				log.Printf("[INFO] Final archive notification sent for %s", staffName)
			}
		}(leaveReq.HREmail, leaveReq.StaffName, leaveReq.FinalHRToken)

		log.Printf("[INFO] MD approved request for %s, workflow complete", leaveReq.StaffName)

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"message": "Leave request fully approved. HR has been notified.",
			"status":  leaveReq.Status,
		})
		return
	}

	// Handle rejection path
	leaveReq.Status = StatusRejectedByMD

	if err := database.DB.Save(&leaveReq).Error; err != nil {
		log.Printf("[ERROR] Failed to save MD rejection: %v", err)
		respondError(w, http.StatusInternalServerError, ErrFinalizeRequest)
		return
	}

	// Notify staff of final rejection
	go func(staffEmail, staffName, reason string) {
		if err := service.SendRejectionNotification(staffEmail, staffName, "Managing Director", reason); err != nil {
			log.Printf("[ERROR] Failed to send rejection email to staff (%s): %v", staffEmail, err)
		} else {
			log.Printf("[INFO] MD rejection notification sent to staff %s", staffName)
		}
	}(leaveReq.StaffEmail, leaveReq.StaffName, req.Reason)

	log.Printf("[INFO] MD rejected request for %s, staff notified", leaveReq.StaffName)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Request rejected by MD. Staff has been notified.",
		"status":  leaveReq.Status,
	})
}
