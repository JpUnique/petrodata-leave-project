package database

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

// Connect establishes a connection to the PostgreSQL database.
// It loads environment variables from a .env file and connects using GORM.
func Connect() {
	// Load environment variables from .env file
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, using system environment variables")
	}

	// Get database URL from environment
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is not set in .env file")
	}

	// Connect to PostgreSQL
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	DB = db
	log.Println("connected to the database successfully")

}
