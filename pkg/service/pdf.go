package service

import (
	"fmt"

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

	// 1. Header with Logo & Title
	m.AddRows(
		row.New(20).Add(
			col.New(4).Add(image.NewFromFile("static/assets/newlogo.png", props.Rect{Percent: 80, Center: true})),
			col.New(8).Add(text.New("OFFICIAL LEAVE RECORD", props.Text{
				Size: 16, Style: fontstyle.Bold, Align: align.Right, Color: &props.Color{Red: 0, Green: 77, Blue: 64},
			})),
		),
	)

	// 2. Staff Information Section
	m.AddRows(
		row.New(10).Add(col.New(12).Add(text.New("STAFF INFORMATION", props.Text{Style: fontstyle.Bold, Top: 5}))),
		renderDataRow(m, "Staff Name", leave.StaffName, "Staff Number", leave.StaffNo),
		renderDataRow(m, "Department", leave.Department, "Designation", leave.Designation),
		renderDataRow(m, "Staff Email", leave.StaffEmail, "", ""),
	)

	// 3. Leave Details Section
	m.AddRows(
		row.New(10).Add(col.New(12).Add(text.New("LEAVE DETAILS", props.Text{Style: fontstyle.Bold, Top: 5}))),
		renderDataRow(m, "Leave Type", leave.LeaveType, "Total Days", fmt.Sprintf("%d Days", leave.TotalDays)),
		renderDataRow(m, "Start Date", leave.StartDate, "Resumption", leave.ResumptionDate),
		renderDataRow(m, "Relief Staff", leave.ReliefStaff, "", ""),
	)

	// 4. Approval Audit Trail
	m.AddRows(
		row.New(10).Add(col.New(12).Add(text.New("APPROVAL HISTORY", props.Text{Style: fontstyle.Bold, Top: 5}))),
		renderDataRow(m, "Manager Decision", leave.ManagerDecision, "HR Decision", leave.HRDecision),
		renderDataRow(m, "MD Decision", leave.MDDecision, "Final Status", leave.Status),
	)

	document, err := m.Generate()
	if err != nil {
		return nil, err
	}
	return document.GetBytes(), nil
}

// Helper to keep the grid clean
func renderDataRow(m core.Maroto, label1, val1, label2, val2 string) core.Row {
	return row.New(12).Add(
		col.New(6).Add(
			text.New(label1, props.Text{Size: 7, Color: &props.Color{Red: 100, Green: 100, Blue: 100}}),
			text.New(val1, props.Text{Size: 10, Top: 4, Style: fontstyle.Bold}),
		),
		col.New(6).Add(
			text.New(label2, props.Text{Size: 7, Color: &props.Color{Red: 100, Green: 100, Blue: 100}}),
			text.New(val2, props.Text{Size: 10, Top: 4, Style: fontstyle.Bold}),
		),
	)
}
