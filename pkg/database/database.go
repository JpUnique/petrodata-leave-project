package database

import (
	"fmt"
	"log"
	"os"

	"github.com/JpUnique/petrodata-leave-project/pkg/models"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, using system environment variables")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	log.Println("Running database migrations...")

	if err := migrateWithIndexes(db); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	DB = db
	log.Println("connected to the database and migrated successfully")
}

// migrateWithIndexes handles AutoMigrate + partial unique indexes for nullable tokens
func migrateWithIndexes(db *gorm.DB) error {
	log.Println("!!! Wiping database for testing and development!!!")
	db.Exec("TRUNCATE TABLE users, leave_requests, approval_actions RESTART IDENTITY CASCADE")

	// Drop old problematic indexes (using your new naming convention)
	indexesToDrop := []string{
		"idx_leave_requests_resource_token",
		"idx_leave_requests_director_token",
		"idx_leave_requests_final_token",
	}

	for _, idx := range indexesToDrop {
		db.Exec("DROP INDEX IF EXISTS " + idx)
	}

	// AutoMigrate tables (GORM will now create resource_token, director_token, etc.)
	if err := db.AutoMigrate(
		&models.User{},
		&models.LeaveRequest{},
		&models.ApprovalAction{},
		&models.StaffRecord{}, // NEW: Ensure this is migrated
	); err != nil {
		return fmt.Errorf("automigrate failed: %w", err)
	}

	// Create partial unique indexes for the NEW column names
	// This allows multiple NULLs but ensures actual tokens are unique
	partialIndexes := map[string]string{
		"idx_leave_requests_resource_token": "resource_token",
		"idx_leave_requests_director_token": "director_token",
		"idx_leave_requests_final_token":    "final_token",
	}

	for idxName, column := range partialIndexes {
		sql := fmt.Sprintf(
			"CREATE UNIQUE INDEX %s ON leave_requests (%s) WHERE %s IS NOT NULL",
			idxName, column, column,
		)
		db.Exec(sql)
	}

	// Cleanup: Ensure empty strings from any logic gaps are treated as NULL
	cleanupSQL := `
        UPDATE leave_requests SET resource_token = NULL WHERE resource_token = '';
        UPDATE leave_requests SET director_token = NULL WHERE director_token = '';
        UPDATE leave_requests SET final_token = NULL WHERE final_token = '';
    `
	db.Exec(cleanupSQL)

	return nil
}

func SeedStaffRecords(db *gorm.DB) {
	staffList := []models.StaffRecord{
		{Name: "Wole Shebioba", StaffID: "M/04/10/1994/003", Email: "wole.shebioba@petrodata.net", LeaveEntitlement: 28},
		{Name: "Ogbalu Ifeanyi Samuel", StaffID: "M/20/11/2007/0022", Email: "ifeanyi.ogbalu@petrodata.net", LeaveEntitlement: 25},
		{Name: "Bodunde Olatomiwa Aderomoke", StaffID: "F/1/04/2011/0047", Email: "tomiwa.bodunde@petrodata.net", LeaveEntitlement: 22},
		{Name: "Ojo Philips Oluwaseun", StaffID: "M/05/07/2012/0050", Email: "seun.philips@petrodata.net", LeaveEntitlement: 22},
		{Name: "Andie Moyan Oluwafemi", StaffID: "M/1/04/2013/0051", Email: "andie.moyan@petrodata.net", LeaveEntitlement: 22},
		{Name: "Abiodun Anjorin", StaffID: "M/26/09/2024/0088", Email: "abiodun.anjorin@petrodata.net", LeaveEntitlement: 22},
		{Name: "Rufus Michael-Aina", StaffID: "M/01/01/2016/0066", Email: "Rufus.Michael-Aina@petrodata.net", LeaveEntitlement: 22},
		{Name: "Aniemene Ifeoma Queendaline", StaffID: "F/06/04/2010/0034", Email: "ifeoma.aniemene@petodata.net", LeaveEntitlement: 22},
		{Name: "Olubodun Damilare Yomi", StaffID: "M/19/04/2012/0068", Email: "pooldrivers@petrodata.net", LeaveEntitlement: 20},
		{Name: "Sogade Babatunde Philip", StaffID: "M/03/03/2013/0055", Email: "pooldrivers@petrodata.net", LeaveEntitlement: 20},
		{Name: "Ebidero Joel Sunday", StaffID: "M/04/01/2021/0079", Email: "joel.ebidero@petrodata.net", LeaveEntitlement: 22},
		{Name: "Samuel Michael-Aina", StaffID: "M/17/08/2021/0081", Email: "Samuel.Michael-Aina@petrodata.net", LeaveEntitlement: 20},
		{Name: "Mariam Abiola Olaleye", StaffID: "F/21/12/2021/0082", Email: "mariam.olaleye@petrodata.net", LeaveEntitlement: 20},
		{Name: "Cherechi Okparaugo", StaffID: "M/01/03/2022/0083", Email: "cherechi.okparaugo@petrodata.net", LeaveEntitlement: 20},
		{Name: "Oyabure Godwin Isaac", StaffID: "M/13/07/2022/0085", Email: "godwin.oyabure@petrodata.net", LeaveEntitlement: 20},
		{Name: "Fadahunsi Iyanuoluwa Kayode", StaffID: "M/13/07/2022/0084", Email: "iyanu.kayode@petrodata.net", LeaveEntitlement: 20},
		{Name: "Dada Adekoyejo", StaffID: "M/03/04/2023/0087", Email: "dada.adekoyejo@petrodata.net", LeaveEntitlement: 20},
		{Name: "Edem Joseph", StaffID: "M/01/04/2010/0033", Email: "joseph.edem@petrodata.net", LeaveEntitlement: 20},
		{Name: "Osu Moses Ikechukwu", StaffID: "M/01/12/2010/0035", Email: "moses.osu@petrodata.net", LeaveEntitlement: 20},
		{Name: "Oguntonade Moboluwaduro", StaffID: "M/22/09/2025/0089", Email: "Moboluwaduro.oguntonade@petrodata.net", LeaveEntitlement: 20},
		{Name: "Nwaekwu Chukwuebuka Johnpaul", StaffID: "04/M/1879/234", Email: "ITools@petrodata.net", LeaveEntitlement: 20},
	}

	for _, staff := range staffList {
		// Use FirstOrCreate so we don't create duplicates on every server restart
		err := db.Where(models.StaffRecord{Email: staff.Email}).FirstOrCreate(&staff).Error
		if err != nil {
			log.Printf("Error seeding staff %s: %v", staff.Name, err)
		}
	}
	log.Println("HR Staff Records synchronized successfully.")
}
