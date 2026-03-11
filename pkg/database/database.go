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
	// Drop old problematic indexes (fix existing duplicate key errors)
	indexesToDrop := []string{
		"idx_leave_requests_hr_token",
		"idx_leave_requests_md_token",
		"idx_leave_requests_final_hr_token",
	}

	for _, idx := range indexesToDrop {
		db.Exec("DROP INDEX IF EXISTS " + idx)
	}

	// AutoMigrate tables
	if err := db.AutoMigrate(
		&models.User{},
		&models.LeaveRequest{},
		&models.ApprovalAction{},
	); err != nil {
		return fmt.Errorf("automigrate failed: %w", err)
	}

	// Create partial unique indexes (PostgreSQL only - allows multiple NULLs)
	partialIndexes := map[string]string{
		"idx_leave_requests_hr_token":       "hr_token",
		"idx_leave_requests_md_token":       "md_token",
		"idx_leave_requests_final_hr_token": "final_hr_token",
	}

	for idxName, column := range partialIndexes {
		sql := fmt.Sprintf(
			"CREATE UNIQUE INDEX %s ON leave_requests (%s) WHERE %s IS NOT NULL",
			idxName, column, column,
		)
		db.Exec(sql) // Ignore errors - index may already exist
	}

	// Cleanup: Convert empty strings to NULL (fixes your current errors)
	cleanupSQL := `
		UPDATE leave_requests SET hr_token = NULL WHERE hr_token = '';
		UPDATE leave_requests SET md_token = NULL WHERE md_token = '';
		UPDATE leave_requests SET final_hr_token = NULL WHERE final_hr_token = '';
	`
	db.Exec(cleanupSQL)

	return nil
}
