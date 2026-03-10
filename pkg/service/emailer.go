package service

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"regexp"
	"time"

	"github.com/jaytaylor/html2text"
	"github.com/mailersend/mailersend-go"
)

// ============================================================================
// MAILERSEND CLIENT SETUP
// ============================================================================

var (
	mailerSendClient *mailersend.Mailersend
	fromEmail        mailersend.From
)

func init() {
	// Initialize MailerSend client with API key from environment
	apiKey := os.Getenv("MAILER_SEND_API_KEY")
	// if apiKey == "" {
	// 	panic("MAILER_SEND_API_KEY environment variable is required")
	// }

	mailerSendClient = mailersend.NewMailersend(apiKey)

	// Set default sender (must be verified domain in MailerSend)
	senderEmail := os.Getenv("SENDER_EMAIL")
	if senderEmail == "" {
		senderEmail = "ITools@petrodata.net"
	}

	fromEmail = mailersend.From{
		Name:  "PetroData Portal",
		Email: senderEmail,
	}
}

// ============================================================================
// CORE MAILER LOGIC
// ============================================================================

// sendViaMailerSend handles the email sending via MailerSend API
func sendViaMailerSend(toEmail, subject, html string, ccEmails ...string) error {
	// Validate recipient
	if toEmail == "" {
		return fmt.Errorf("recipient email is required")
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Build recipient list
	recipients := []mailersend.Recipient{
		{
			Email: toEmail,
		},
	}

	// Build CC list if provided
	var ccRecipients []mailersend.Recipient
	for _, cc := range ccEmails {
		if cc != "" {
			ccRecipients = append(ccRecipients, mailersend.Recipient{Email: cc})
		}
	}

	// Create message
	message := mailerSendClient.Email.NewMessage()
	message.SetFrom(fromEmail)
	message.SetRecipients(recipients)
	message.SetSubject(subject)
	message.SetHTML(html)
	message.SetText(stripHTML(html)) // Plain text fallback

	// Add CC if any
	if len(ccRecipients) > 0 {
		message.SetCc(ccRecipients)
	}

	// Add tags for tracking
	message.SetTags([]string{"leave-request", "petrodata"})

	// Send email
	res, err := mailerSendClient.Email.Send(ctx, message)
	if err != nil {
		return fmt.Errorf("failed to send email to %s: %w", toEmail, err)
	}

	// Log success (optional - in production use proper logging)
	fmt.Printf("Email sent successfully to %s. Message ID: %s\n", toEmail, res.Header.Get("X-Message-Id"))

	return nil
}

// stripHTML removes HTML tags for plain text version (basic implementation)
func stripHTML(html string) string {
	text, err := html2text.FromString(html, html2text.Options{
		PrettyTables: true,
	})
	if err != nil {
		// Fallback to simple regex
		re := regexp.MustCompile(`<[^>]+>`)
		return re.ReplaceAllString(html, "")
	}
	return text
}

// ============================================================================
// WORKFLOW FUNCTIONS
// ============================================================================

// SendToManager triggers the first approval step (Staff -> Line Manager)
func SendToManager(email, staffName, token string) error {
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "https://petrodata-portal.onrender.com"
	}

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

	return sendViaMailerSend(email, "New Leave Request: "+staffName, html)
}

// SendToHR notifies the HR manager after the line manager approves (Manager -> HR)
func SendToHR(email, staffName, token string) error {
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "https://petrodata-portal.onrender.com"
	}

	link := fmt.Sprintf("%s/approve_hr.html?token=%s", baseURL, token)

	html := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
			<h2 style="color: #004d40;">Leave Approval Required</h2>
			<p>A new leave request has been submitted by <strong>%s</strong> and approved by the Line Manager.</p>
			<p>Please review the details and provide your decision by clicking the button below:</p>
			<div style="margin: 25px 0;">
				<a href="%s" style="background-color: #004d40; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review Request</a>
			</div>
			<p style="font-size: 11px; color: #888;">This is an automated message from PetroData Portal.</p>
		</div>`, staffName, link)

	return sendViaMailerSend(email, "HR Action Needed - Leave: "+staffName, html)
}

// SendToMD notifies the Managing Director for the final sign-off (HR -> MD)
func SendToMD(email, staffName, token string) error {
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "https://petrodata-portal.onrender.com"
	}

	link := fmt.Sprintf("%s/approve_md.html?token=%s", baseURL, token)

	html := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
			<h2 style="color: #004d40;">Final Approval Required</h2>
			<p>A leave request from <strong>%s</strong> has been approved by both the Line Manager and HR.</p>
			<p>Your final approval is required. Please review by clicking the button below:</p>
			<div style="margin: 25px 0;">
				<a href="%s" style="background-color: #004d40; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review Request</a>
			</div>
			<p style="font-size: 11px; color: #888;">This is an automated message from PetroData Portal.</p>
		</div>`, staffName, link)

	return sendViaMailerSend(email, "Final MD Approval: "+staffName, html)
}

// SendFinalArchiveToHR notifies HR that the chain is complete and files are ready (MD -> HR Archive)
func SendFinalArchiveToHR(email, staffName, token string) error {
	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		baseURL = "https://petrodata-portal.onrender.com"
	}

	link := fmt.Sprintf("%s/final_archive.html?token=%s", baseURL, token)

	html := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
			<h2 style="color: #004d40;">Workflow Complete</h2>
			<p>The leave workflow for <strong>%s</strong> is now <strong>Fully Approved</strong>.</p>
			<p>Click the button below to view and download the final archive for records:</p>
			<div style="margin: 25px 0;">
				<a href="%s" style="background-color: #004d40; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Download Archive</a>
			</div>
			<p style="font-size: 11px; color: #888;">This is an automated message from PetroData Portal.</p>
		</div>`, staffName, link)

	return sendViaMailerSend(email, "COMPLETED Workflow: "+staffName, html)
}

// SendRejectionNotification notifies staff when request is rejected at any stage
func SendRejectionNotification(staffEmail, staffName, rejectedBy, reason string) error {
	html := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
			<h2 style="color: #d32f2f;">Leave Request Update</h2>
			<p>Hello <strong>%s</strong>,</p>
			<p>Your leave request has been <strong>declined</strong> by <strong>%s</strong>.</p>
			<p><strong>Reason:</strong> %s</p>
			<p>If you have questions, please contact %s directly.</p>
			<p style="font-size: 11px; color: #888;">This is an automated message from PetroData Portal.</p>
		</div>`, staffName, rejectedBy, reason, rejectedBy)

	return sendViaMailerSend(staffEmail, "Leave Request Declined: "+staffName, html)
}

// ============================================================================
// BULK/ADVANCED OPERATIONS (Optional Enhancements)
// ============================================================================

// SendBulkEmails sends emails to multiple recipients (useful for notifications)
func SendBulkEmails(recipients []string, subject, html string) error {
	if len(recipients) == 0 {
		return fmt.Errorf("no recipients provided")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Build recipient list
	var to []mailersend.Recipient
	for _, email := range recipients {
		if email != "" {
			to = append(to, mailersend.Recipient{Email: email})
		}
	}

	message := mailerSendClient.Email.NewMessage()
	message.SetFrom(fromEmail)
	message.SetRecipients(to)
	message.SetSubject(subject)
	message.SetHTML(html)
	message.SetText(stripHTML(html))
	message.SetTags([]string{"bulk-notification", "petrodata"})

	res, err := mailerSendClient.Email.Send(ctx, message)
	if err != nil {
		return fmt.Errorf("bulk send failed: %w", err)
	}

	fmt.Printf("Bulk email sent to %d recipients. Message ID: %s\n", len(to), res.Header.Get("X-Message-Id"))
	return nil
}

// SendEmailWithAttachment sends email with file attachment (for supporting documents)
func SendEmailWithAttachment(toEmail, subject, html, filePath, fileName string) error {
	// Read file
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open attachment: %w", err)
	}
	defer file.Close()

	// Get file info for reading
	stat, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat file: %w", err)
	}

	// Read file content
	content := make([]byte, stat.Size())
	_, err = file.Read(content)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	// Encode to base64
	encoded := make([]byte, base64.StdEncoding.EncodedLen(len(content)))
	base64.StdEncoding.Encode(encoded, content)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	recipients := []mailersend.Recipient{{Email: toEmail}}

	message := mailerSendClient.Email.NewMessage()
	message.SetFrom(fromEmail)
	message.SetRecipients(recipients)
	message.SetSubject(subject)
	message.SetHTML(html)
	message.SetText(stripHTML(html))

	// Add attachment
	attachment := mailersend.Attachment{
		Filename:    fileName,
		Content:     string(encoded),
		Disposition: "attachment",
	}
	message.AddAttachment(attachment)

	res, err := mailerSendClient.Email.Send(ctx, message)
	if err != nil {
		return fmt.Errorf("failed to send email with attachment: %w", err)
	}

	fmt.Printf("Email with attachment sent. Message ID: %s\n", res.Header.Get("X-Message-Id"))
	return nil
}
