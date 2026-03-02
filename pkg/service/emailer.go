package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

// ============================================================================
// BREVO API MODELS
// ============================================================================

type brevoRecipient struct {
	Email string `json:"email"`
}

type brevoSender struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type brevoPayload struct {
	Sender      brevoSender      `json:"sender"`
	To          []brevoRecipient `json:"to"`
	Subject     string           `json:"subject"`
	HtmlContent string           `json:"htmlContent"`
}

// ============================================================================
// CORE MAILER LOGIC
// ============================================================================

// sendViaBrevo handles the low-level HTTP POST request to the Brevo API.
func sendViaBrevo(toEmail, subject, html string) error {
	// Retrieve credentials from environment variables
	apiKey := os.Getenv("BREVO_API_KEY")
	senderEmail := os.Getenv("SENDER_EMAIL")
	apiURL := "https://api.brevo.com/v3/smtp/email"

	if apiKey == "" || senderEmail == "" {
		return fmt.Errorf("missing BREVO_API_KEY or SENDER_EMAIL in environment")
	}

	payload := brevoPayload{
		Sender:      brevoSender{Name: "PetroData Portal", Email: senderEmail},
		To:          []brevoRecipient{{Email: toEmail}},
		Subject:     subject,
		HtmlContent: html,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %v", err)
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}

	// Set required headers for Brevo API
	req.Header.Set("api-key", apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("API request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("brevo API error: status code %d", resp.StatusCode)
	}

	return nil
}

// ============================================================================
// WORKFLOW FUNCTIONS
// ============================================================================

// SendToManager triggers the first approval step.
func SendToManager(email, staffName, token string) error {
	baseURL := os.Getenv("BASE_URL")
	link := fmt.Sprintf("%s/approve.html?token=%s", baseURL, token)

	html := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
			<h2 style="color: #004d40;">Leave Approval Required</h2>
			<p>A new leave request has been submitted by <strong>%s</strong>.</p>
			<p>Please review the details and provide your decision by clicking the button below:</p>
			<div style="margin: 25px 0;">
				<a href="%s" style="background-color: #004d40; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review Request</a>
			</div>
			<p style="font-size: 11px; color: #888;">This is an automated message from PetroData Portal.</p>
		</div>`, staffName, link)

	return sendViaBrevo(email, "New Leave Request: "+staffName, html)
}

// SendToHR notifies the HR manager after the line manager approves.
func SendToHR(email, staffName, token string) error {
	baseURL := os.Getenv("BASE_URL")
	link := fmt.Sprintf("%s/approve_hr.html?token=%s", baseURL, token)

	html := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
			<h2 style="color: #004d40;">Leave Approval Required</h2>
			<p>A new leave request has been submitted by <strong>%s</strong>.</p>
			<p>Please review the details and provide your decision by clicking the button below:</p>
			<div style="margin: 25px 0;">
				<a href="%s" style="background-color: #004d40; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review Request</a>
			</div>
			<p style="font-size: 11px; color: #888;">This is an automated message from PetroData Portal.</p>
		</div>`, staffName, link)

	return sendViaBrevo(email, "HR Action Needed - Leave: "+staffName, html)
}

// SendToMD notifies the Managing Director for the final sign-off.
func SendToMD(email, staffName, token string) error {
	baseURL := os.Getenv("BASE_URL")
	link := fmt.Sprintf("%s/approve_md.html?token=%s", baseURL, token)

	html := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
			<h2 style="color: #004d40;">Leave Approval Required</h2>
			<p>A new leave request has been submitted by <strong>%s</strong>.</p>
			<p>Please review the details and provide your decision by clicking the button below:</p>
			<div style="margin: 25px 0;">
				<a href="%s" style="background-color: #004d40; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review Request</a>
			</div>
			<p style="font-size: 11px; color: #888;">This is an automated message from PetroData Portal.</p>
		</div>`, staffName, link)

	return sendViaBrevo(email, "Final MD Approval: "+staffName, html)
}

// SendFinalArchiveToHR notifies HR that the chain is complete and files are ready.
func SendFinalArchiveToHR(email, staffName, token string) error {
	baseURL := os.Getenv("BASE_URL")
	link := fmt.Sprintf("%s/final_archive.html?token=%s", baseURL, token)

	html := fmt.Sprintf(`
    <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <h2 style="color: #004d40;">Workflow Complete</h2>
        <p>The leave workflow for <strong>%s</strong> is now <strong>Fully Approved</strong>.</p>
        <p>Click the button below to view and download the final archive for records:</p>
        <div style="margin: 25px 0;">
            <a href="%s" style="background-color: #004d40; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Download Archive</a>
        </div>
    </div>`, staffName, link)

	return sendViaBrevo(email, "COMPLETED Workflow: "+staffName, html)
}
