package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/JpUnique/petrodata-leave-project/pkg/database"
	"github.com/JpUnique/petrodata-leave-project/pkg/handlers"
	"github.com/joho/godotenv"
)

func main() {
	// 1. Load .env variables first!
	// This ensures database.Connect() can see your DATABASE_URL
	if err := godotenv.Load(); err != nil {
		log.Println("Note: .env file not found, using system environment variables")
	}

	// 2. Configuration
	var addr string
	flag.StringVar(&addr, "addr", "", "HTTP network address (e.g. :8080)")
	flag.Parse()

	if addr == "" {
		if p := os.Getenv("PORT"); p != "" {
			addr = ":" + p
		} else {
			addr = ":8080"
		}
	}

	// 3. Initialize PostgreSQL Database
	database.Connect()

	// 4. Routing
	mux := http.NewServeMux()

	// Entry point: Serve Signup UI as the landing page
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "./static/signup.html")
			return
		}

		// Check if file exists to avoid potential loops
		fpath := "./static" + r.URL.Path
		if _, err := os.Stat(fpath); os.IsNotExist(err) {
			http.NotFound(w, r)
			return
		}

		http.FileServer(http.Dir("./static")).ServeHTTP(w, r)
	})

	// API Endpoints
	mux.HandleFunc("/api/signup", handlers.Signup)
	mux.HandleFunc("/api/login", handlers.Login)
	mux.HandleFunc("/api/leave/submit", handlers.SubmitLeaveRequest)
	mux.HandleFunc("/api/leave/details", handlers.GetLeaveRequestByToken)
	mux.HandleFunc("/api/leave/action", handlers.HandleLineManagerAction)
	mux.HandleFunc("/api/leave/hr-details", handlers.GetLeaveRequestByHRToken)
	mux.HandleFunc("/api/leave/hr-action", handlers.HandleHRManagerAction)
	mux.HandleFunc("/api/leave/md-details", handlers.GetLeaveRequestByMDToken)
	mux.HandleFunc("/api/leave/md-action", handlers.HandleMDAction)
	mux.HandleFunc("/api/leave/final-details", handlers.GetFinalArchiveDetails)

	// 5. Server Configuration
	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("PetroData Portal is live at http://localhost%s", addr)

	// Start server in a goroutine
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	// 6. Graceful Shutdown logic
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server stopped cleanly")
}
