package models

import "time"

type User struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	FullName    string    `json:"full_name"`
	Email       string    `json:"email"`
	Password    string    `json:"password"`
	PhoneNumber string    `json:"phone_number"`
	CreatedAt   time.Time `json:"created_at"`
}

type LeaveRequest struct {
	ID             uint   `gorm:"primaryKey" json:"id"`
	StaffName      string `json:"staff_name"`
	StaffNo        string `json:"staff_no"`
	Designation    string `json:"designation"`
	Department     string `json:"department"`
	LeaveType      string `json:"leave_type"`
	StartDate      string `json:"start_date"`
	ResumptionDate string `json:"resumption_date"`
	TotalDays      int    `json:"total_days"`
	ReliefStaff    string `json:"relief_staff"`
	ContactAddress string `json:"contact_address"`

	// Workflow Emails
	ManagerEmail string `json:"manager_email"`
	HREmail      string `json:"hr_email"` // Added: To store who the manager forwarded to
	MDEmail      string `json:"md_email"` // Added: To store who HR forwarded to

	// Status & Logic
	Status string `gorm:"default:'Pending'" json:"status"`

	// Specific Decisions (To show in UI)
	ManagerDecision string `json:"manager_decision"` // Will store "Approved" or "Rejected"
	HRDecision      string `json:"hr_decision"`      // Will store "Approved" or "Rejected"

	// Booleans for quick checks
	ManagerApproved bool `gorm:"default:false" json:"manager_approved"`
	HRApproved      bool `gorm:"default:false" json:"hr_approved"`
	MDApproved      bool `gorm:"default:false" json:"md_approved"`

	// Security Tokens for the Links
	RequestToken string `gorm:"uniqueIndex" json:"request_token"` // Manager's link
	HRToken      string `gorm:"uniqueIndex" json:"hr_token"`      // HR's link
	MDToken      string `gorm:"uniqueIndex" json:"md_token"`      // MD's link (Added)

	CreatedAt time.Time `json:"created_at"`
}
type ApprovalAction struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	RequestID  uint      `json:"request_id"`
	Approver   string    `json:"approver"`
	Signature  string    `json:"signature"`
	ActionDate time.Time `json:"action_date"`
}
