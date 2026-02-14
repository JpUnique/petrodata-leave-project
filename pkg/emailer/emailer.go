package email

import (
	"fmt"
	"log"
)

// SendApprovalEmail simulates sending an email by printing the details to the terminal.
func SendApprovalEmail(managerEmail, staffName, approvalURL string) error {
	// Strategic Logging: Visualizing the outgoing data
	fmt.Println("\n========================================================")
	fmt.Println("🚀 [TERMINAL EMAIL TEST] OUTGOING NOTIFICATION")
	fmt.Printf("TO MANAGER:    %s\n", managerEmail)
	fmt.Printf("FOR STAFF:     %s\n", staffName)
	fmt.Printf("APPROVAL LINK: %s\n", approvalURL)
	fmt.Println("========================================================")

	// We log a success message so you can see it in your standard logs too
	log.Printf("[MOCK SUCCESS] Approval link for %s generated and logged to terminal.", staffName)

	return nil
}
