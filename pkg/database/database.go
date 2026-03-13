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
