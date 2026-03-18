package service

import (
	"fmt"
	"time"

	"github.com/johnfercher/maroto/v2"

	"github.com/JpUnique/petrodata-leave-project/pkg/models"
	"github.com/johnfercher/maroto/v2/pkg/components/col"
	"github.com/johnfercher/maroto/v2/pkg/components/image"
	"github.com/johnfercher/maroto/v2/pkg/components/row"
	"github.com/johnfercher/maroto/v2/pkg/components/text"
	"github.com/johnfercher/maroto/v2/pkg/consts/align"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontstyle"
	"github.com/johnfercher/maroto/v2/pkg/core"
	"github.com/johnfercher/maroto/v2/pkg/props"
)

func GenerateLeavePDF(leave models.LeaveRequest) ([]byte, error) {
	m := maroto.New()

	// Primary Brand Color: PetroData Green (#004d40)
	brandColor := &props.Color{Red: 0, Green: 77, Blue: 64}

	// 1. Header with Logo & Document Info
	m.AddRows(
		row.New(25).Add(
			col.New(3).Add(image.NewFromFile("static/assets/newlogo.png", props.Rect{Percent: 90, Center: true})),
			col.New(9).Add(
				text.New("PETRODATA MANAGEMENT SYSTEM", props.Text{
					Size: 14, Style: fontstyle.Bold, Align: align.Right, Color: brandColor,
				}),
				text.New("OFFICIAL LEAVE RECORD", props.Text{
					Size: 10, Top: 6, Align: align.Right, Style: fontstyle.Bold,
				}),
				text.New(fmt.Sprintf("Generated on: %s", time.Now().Format("Jan 02, 2006")), props.Text{
					Size: 8, Top: 12, Align: align.Right, Color: &props.Color{Red: 120, Green: 120, Blue: 120},
				}),
			),
		),
	)

	// 2. Personnel Profile
	m.AddRows(
		sectionHeader("PERSONNEL PROFILE", brandColor),
		renderDataRow("Staff Name", leave.StaffName, "Staff Number", leave.StaffNo),
		renderDataRow("Designation", leave.Designation, "Department", leave.Department),
		renderDataRow("Phone Number", leave.PhoneNumber, "Date Employed", leave.DateEmployed),
	)

	// 3. Leave Particulars
	allowanceStatus := "NO"
	if leave.LeaveAllowanceRequest {
		allowanceStatus = "YES (Requested)"
	}

	m.AddRows(
		sectionHeader("LEAVE PARTICULARS", brandColor),
		renderDataRow("Leave Type", leave.LeaveType, "Leave Allowance", allowanceStatus),
		renderDataRow("Total Duration", fmt.Sprintf("%d Working Days", leave.TotalDays), "Relief Staff", leave.ReliefStaff),
		renderDataRow("Start Date", leave.StartDate, "Resumption Date", leave.ResumptionDate),
		row.New(15).Add(
			col.New(12).Add(
				text.New("Contact Address During Leave", props.Text{Size: 7, Color: &props.Color{Red: 100, Green: 100, Blue: 100}}),
				text.New(leave.ContactAddress, props.Text{Size: 9, Top: 4, Style: fontstyle.BoldItalic}),
			),
		),
	)

	// 4. Approval Audit Trail
	m.AddRows(
		sectionHeader("APPROVAL AUDIT TRAIL", brandColor),
		renderDataRow("Line Manager", leave.ManagerDecision, "HR Verification", leave.HRDecision),
		renderDataRow("MD Final Approval", leave.MDDecision, "Current Status", leave.Status),
	)

	// 5. Footer / Disclaimer
	m.AddRows(
		row.New(20), // Spacer
		row.New(10).Add(
			col.New(12).Add(text.New("This is a computer-generated document and is valid without a physical signature.", props.Text{
				Size: 7, Align: align.Center, Color: &props.Color{Red: 150, Green: 150, Blue: 150},
			})),
		),
	)

	document, err := m.Generate()
	if err != nil {
		return nil, err
	}
	return document.GetBytes(), nil
}

// Helper: Section Headers
func sectionHeader(title string, color *props.Color) core.Row {
	return row.New(12).Add(
		col.New(12).Add(text.New(title, props.Text{
			Size: 9, Style: fontstyle.Bold, Top: 5, Color: color,
		})),
	)
}

// Helper: Two-column Data Rows
func renderDataRow(label1, val1, label2, val2 string) core.Row {
	if val1 == "" {
		val1 = "N/A"
	}
	if val2 == "" {
		val2 = "N/A"
	}

	return row.New(14).Add(
		col.New(6).Add(
			text.New(label1, props.Text{Size: 7, Color: &props.Color{Red: 100, Green: 100, Blue: 100}}),
			text.New(val1, props.Text{Size: 9, Top: 4, Style: fontstyle.Bold}),
		),
		col.New(6).Add(
			text.New(label2, props.Text{Size: 7, Color: &props.Color{Red: 100, Green: 100, Blue: 100}}),
			text.New(val2, props.Text{Size: 9, Top: 4, Style: fontstyle.Bold}),
		),
	)
}
