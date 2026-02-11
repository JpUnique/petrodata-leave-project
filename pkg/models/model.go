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
	ID              uint      `gorm:"primaryKey" json:"id"`
	StaffName       string    `json:"staff_name"`
	StaffNo         string    `json:"staff_no"`
	Designation     string    `json:"designation"`
	Department      string    `json:"department"`
	LeaveType       string    `json:"leave_type"`
	StartDate       string    `json:"start_date"`
	ResumptionDate  string    `json:"resumption_date"`
	ReliefStaff     string    `json:"relief_staff"`
	ContactAddress  string    `json:"contact_address"`
	ManagerEmail    string    `json:"manager_email"`
	Status          string    `json:"status"`
	ManagerApproved bool      `json:"manager_approved"`
	HRApproved      bool      `json:"hr_approved"`
	MDApproved      bool      `json:"md_approved"`
	CreatedAt       time.Time `json:"created_at"`
}

type ApprovalAction struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	RequestID  uint      `json:"request_id"`
	Approver   string    `json:"approver"`
	Signature  string    `json:"signature"`
	ActionDate time.Time `json:"action_date"`
}
