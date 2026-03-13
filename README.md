Here is a clean, professional **README.md** tailored for the PetroData Leave Portal. It highlights the tech stack we've implemented, including the new **Maroto** PDF engine and the **MailerSend** integration.

---

# PetroData Leave Portal System

A specialized Internal Tools dashboard designed for **PetroData Limited** to manage employee leave requests. The system automates the workflow from staff application to final executive approval, featuring automated PDF archiving and multi-stage email notifications.

## 🚀 System Workflow

1. **Staff Submission**: Employee submits a leave request via the portal.
2. **Line Manager Review**: Manager receives an email with a secure token to Approve/Reject.
3. **HR Recommendation**: Upon manager approval, HR receives the request to verify policy compliance.
4. **MD Final Verdict**: The Managing Director provides the final decision.
5. **Automated Archiving**: Once fully approved, the system generates an official PDF record and dispatches it to the Staff and HR archives.

## 🛠 Tech Stack

- **Backend**: Go (Golang 1.22+)
- **Database**: PostgreSQL (GORM)
- **PDF Engine**: [Maroto v2](https://github.com/johnfercher/maroto) (High-performance, grid-based PDF generation)
- **Email Service**: MailerSend API (via `mailersend-go`)
- **Frontend**: Vanilla JavaScript (ES6+), Tailwind CSS, SweetAlert2
- **Infrastructure**: Docker, Kubernetes, Hosted on Render

## 📁 Key Components

### 1. PDF Generation Service

Located in `service/pdf_generator.go`, this module uses the Maroto grid system to construct official documents in-memory. It eliminates the need for temporary file storage, ensuring high security and speed.

### 2. Automated Emailer

Located in `service/emailer.go`, it handles multi-part emails with Base64-encoded PDF attachments. It supports asynchronous dispatching using Go routines to ensure zero lag for the end-user.

### 3. Secure Token System

The system uses unique, non-sequential UUIDs for every approval stage. This allows managers and executives to take action directly from their email without requiring a full login session for every click.

## ⚙️ Environment Variables

To run this system, create a `.env` file in the root directory:

```env
PORT=8080
DB_URL=postgres://user:password@localhost:5432/petrodata_leave
MAILERSEND_API_KEY=mlsn.your_api_key_here
FROM_EMAIL=notifications@petrodata.net
UNIPDF_LICENSE_KEY=optional_if_using_maroto

```

## 🛠 Installation & Local Development

1. **Clone the repository**:

```bash
git clone https://github.com/JpUnique/petrodata-leave-project.git
cd petrodata-leave-project

```

2. **Install dependencies**:

```bash
go mod tidy

```

3. **Run the server**:

```bash
go run main.go

```

4. **Access the Portal**:
   Open `http://localhost:8080` in your browser.

## ⚠️ Known Issues / Troubleshooting

- **MailerSend 422 Error**: If you see `Trial account unique recipients limit`, ensure your sending domain is verified in the MailerSend dashboard or reuse existing recipient emails for testing.
- **PDF Layout**: If the logo is missing in the PDF, ensure `assets/newlogo.png` is placed correctly at the root level.

---

**Would you like me to add a "Contribution" section or a specific "API Documentation" table to this README?**
