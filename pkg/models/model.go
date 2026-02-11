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
	// Added this to capture the calculated days from your UI
	TotalDays      int    `json:"total_days"`
	ReliefStaff    string `json:"relief_staff"`
	ContactAddress string `json:"contact_address"`
	ManagerEmail   string `json:"manager_email"`

	// Status management
	Status          string `gorm:"default:'Pending'" json:"status"`
	ManagerApproved bool   `gorm:"default:false" json:"manager_approved"`
	HRApproved      bool   `gorm:"default:false" json:"hr_approved"`
	MDApproved      bool   `gorm:"default:false" json:"md_approved"`

	// The "Secret Key" for the Manager's Link
	// We add an index because the backend will search by this token often
	RequestToken string `gorm:"uniqueIndex" json:"request_token"`

	CreatedAt time.Time `json:"created_at"`
}

type ApprovalAction struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	RequestID  uint      `json:"request_id"`
	Approver   string    `json:"approver"`
	Signature  string    `json:"signature"`
	ActionDate time.Time `json:"action_date"`
}
