package database

import (
	"log"
	"os"

	"github.com/JpUnique/petrodata-leave-project/pkg/models" // Import your models package
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

	// ==========================================================
	// ADD THIS SECTION FOR AUTOMIGRATE
	// ==========================================================
	log.Println("Running database migrations...")
	err = db.AutoMigrate(
		&models.User{},
		&models.LeaveRequest{},
		&models.ApprovalAction{}, // Ensure this matches your MD action table name
	)
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}
	// ==========================================================

	DB = db
	log.Println("connected to the database and migrated successfully")
}
