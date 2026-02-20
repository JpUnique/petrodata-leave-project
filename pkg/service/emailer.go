package services

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"gopkg.in/gomail.v2"
)

// Email configuration constants
const (
	// Email template styles
	styleHeader         = "font-family: sans-serif; border: 1px solid #ddd; padding: 20px;"
	styleManagerHeading = "color: #004d40;"
	styleHRHeading      = "color: #01579b;"
	styleMDHeading      = "color: #b71c1c;"
	styleArchiveHeading = "color: #333;"

	// Button colors for different approval stages
	colorManager = "#00c853"
	colorHR      = "#0288d1"
	colorMD      = "#d32f2f"
	colorArchive = "#455a64"

	// Button styling
	buttonStyle = "padding: 10px 20px; text-decoration: none; border-radius: 5px;"
)

// SMTPConfig holds SMTP server configuration from environment variables
type SMTPConfig struct {
	Host string
	Port int
	User string
	Pass string
}

// LoadSMTPConfig loads SMTP configuration from environment variables
func LoadSMTPConfig() (SMTPConfig, error) {
	portStr := os.Getenv("SMTP_PORT")
	if portStr == "" {
		return SMTPConfig{}, fmt.Errorf("SMTP_PORT environment variable not set")
	}

	port, err := strconv.Atoi(portStr)
	if err != nil {
		return SMTPConfig{}, fmt.Errorf("invalid SMTP_PORT value: %w", err)
	}

	config := SMTPConfig{
		Host: os.Getenv("SMTP_HOST"),
		Port: port,
		User: os.Getenv("SMTP_USER"),
		Pass: os.Getenv("SMTP_PASS"),
	}

	// Validate required fields
	if config.Host == "" || config.User == "" || config.Pass == "" {
		return SMTPConfig{}, fmt.Errorf("missing required SMTP configuration")
	}

	return config, nil
}

// dialAndSend establishes an SMTP connection and sends the email message
func dialAndSend(m *gomail.Message) error {
	config, err := LoadSMTPConfig()
	if err != nil {
		return fmt.Errorf("SMTP configuration error: %w", err)
	}

	dialer := gomail.NewDialer(config.Host, config.Port, config.User, config.Pass)
	if err := dialer.DialAndSend(m); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	return nil
}

// sendApprovalEmail is a helper function to send approval request emails
func sendApprovalEmail(toEmail, staffName, token, pageURL, subject, headingText, headingColor, buttonColor string) error {
	if toEmail == "" || staffName == "" || token == "" {
		return fmt.Errorf("missing required email parameters")
	}

	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		return fmt.Errorf("BASE_URL environment variable not set")
	}

	link := fmt.Sprintf("%s/%s?token=%s", baseURL, pageURL, token)

	m := gomail.NewMessage()
	m.SetHeader("From", os.Getenv("SMTP_USER"))
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", subject)

	body := fmt.Sprintf(`
        <div style="%s">
            <h2 style="%s">%s</h2>
            <p><strong>%s</strong> has submitted a leave request for your attention.</p>
            <a href="%s" style="background: %s; color: white; %s">Review Request</a>
        </div>`,
		styleHeader,
		headingColor,
		headingText,
		staffName,
		link,
		buttonColor,
		buttonStyle,
	)

	m.SetBody("text/html", body)

	return dialAndSend(m)
}

// SendToManager sends a leave request notification to the line manager
func SendToManager(managerEmail, staffName, token string) error {
	if managerEmail == "" {
		return fmt.Errorf("manager email is required")
	}

	subject := fmt.Sprintf("Leave Request Approval Required: %s", staffName)
	headingText := "Manager Action Required"

	if err := sendApprovalEmail(managerEmail, staffName, token, "approve.html", subject, headingText, styleManagerHeading, colorManager); err != nil {
		log.Printf("error sending manager email: %v", err)
		return err
	}

	log.Printf("manager approval email sent to %s for %s", managerEmail, staffName)
	return nil
}

// SendToHR sends a leave request notification to the HR department
func SendToHR(hrEmail, staffName, token string) error {
	if hrEmail == "" {
		return fmt.Errorf("HR email is required")
	}

	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		return fmt.Errorf("BASE_URL environment variable not set")
	}

	link := fmt.Sprintf("%s/approve_hr.html?token=%s", baseURL, token)

	m := gomail.NewMessage()
	m.SetHeader("From", os.Getenv("SMTP_USER"))
	m.SetHeader("To", hrEmail)
	m.SetHeader("Subject", fmt.Sprintf("HR Processing Required: Leave Request for %s", staffName))

	body := fmt.Sprintf(`
        <div style="%s">
            <h2 style="%s">HR Action Required</h2>
            <p>The Line Manager has approved the leave request for <strong>%s</strong>.</p>
            <p>Please review the details and provide HR clearance.</p>
            <a href="%s" style="background: %s; color: white; %s">Review for HR</a>
        </div>`,
		styleHeader,
		styleHRHeading,
		staffName,
		link,
		colorHR,
		buttonStyle,
	)

	m.SetBody("text/html", body)

	if err := dialAndSend(m); err != nil {
		log.Printf("error sending HR email: %v", err)
		return err
	}

	log.Printf("HR approval email sent to %s for %s", hrEmail, staffName)
	return nil
}

// SendToMD sends a leave request notification to the Managing Director for final approval
func SendToMD(mdEmail, staffName, token string) error {
	if mdEmail == "" {
		return fmt.Errorf("MD email is required")
	}

	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		return fmt.Errorf("BASE_URL environment variable not set")
	}

	link := fmt.Sprintf("%s/approve_md.html?token=%s", baseURL, token)

	m := gomail.NewMessage()
	m.SetHeader("From", os.Getenv("SMTP_USER"))
	m.SetHeader("To", mdEmail)
	m.SetHeader("Subject", fmt.Sprintf("Final Approval Required: %s", staffName))

	body := fmt.Sprintf(`
        <div style="%s">
            <h2 style="%s">Final Executive Approval</h2>
            <p>The leave request for <strong>%s</strong> has been cleared by HR and now requires your final signature.</p>
            <a href="%s" style="background: %s; color: white; %s">Grant Final Approval</a>
        </div>`,
		styleHeader,
		styleMDHeading,
		staffName,
		link,
		colorMD,
		buttonStyle,
	)

	m.SetBody("text/html", body)

	if err := dialAndSend(m); err != nil {
		log.Printf("error sending MD email: %v", err)
		return err
	}

	log.Printf("MD approval email sent to %s for %s", mdEmail, staffName)
	return nil
}

// SendFinalArchiveToHR sends the final approved leave request archive to HR for record-keeping
func SendFinalArchiveToHR(hrEmail, staffName, token string) error {
	if hrEmail == "" {
		return fmt.Errorf("HR email is required")
	}

	baseURL := os.Getenv("BASE_URL")
	if baseURL == "" {
		return fmt.Errorf("BASE_URL environment variable not set")
	}

	link := fmt.Sprintf("%s/final_archive.html?token=%s", baseURL, token)

	m := gomail.NewMessage()
	m.SetHeader("From", os.Getenv("SMTP_USER"))
	m.SetHeader("To", hrEmail)
	m.SetHeader("Subject", fmt.Sprintf("COMPLETED: Leave Request Archive - %s", staffName))

	body := fmt.Sprintf(`
        <div style="%s">
            <h2 style="%s">Process Completed</h2>
            <p>The leave request for <strong>%s</strong> has been fully approved by the MD.</p>
            <p>You can now view the final audit trail and generate the PDF for records.</p>
            <a href="%s" style="background: %s; color: white; %s">View Final Archive</a>
        </div>`,
		styleHeader,
		styleArchiveHeading,
		staffName,
		link,
		colorArchive,
		buttonStyle,
	)

	m.SetBody("text/html", body)

	if err := dialAndSend(m); err != nil {
		log.Printf("error sending final archive email: %v", err)
		return err
	}

	log.Printf("final archive email sent to %s for %s", hrEmail, staffName)
	return nil
}
