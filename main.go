package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/JpUnique/petrodata-leave-project/pkg/database"
	"github.com/JpUnique/petrodata-leave-project/pkg/handlers"
	"github.com/JpUnique/petrodata-leave-project/pkg/middleware"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

func main() {
	// 1. Load .env (local only)
	if err := godotenv.Load(); err != nil {
		log.Println("Note: .env file not found, using system environment variables")
	}

	// 2. Dynamic Port for Render
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default for local testing
	}
	addr := ":" + port

	// 3. Initialize Database
	database.Connect()

	// 4. Routing
	mux := http.NewServeMux()

	// Serve Static Files (CSS, JS, Images)
	// This handles everything inside the /static folder automatically
	fileServer := http.FileServer(http.Dir("./static"))
	mux.Handle("/static/", http.StripPrefix("/static/", fileServer))

	// Entry point: Landing page
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "./static/signup.html")
			return
		}
		// Fallback for other root-level HTML files
		fpath := "./static" + r.URL.Path
		if _, err := os.Stat(fpath); os.IsNotExist(err) {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, fpath)
	})

	// API Endpoints
	mux.HandleFunc("/api/signup", handlers.Signup)
	mux.HandleFunc("/api/login", handlers.Login)
	mux.HandleFunc("/api/leave/submit", middleware.Auth(handlers.SubmitLeaveRequest))
	mux.HandleFunc("/api/leave/details", handlers.GetLeaveRequestByToken)
	mux.HandleFunc("/api/leave/action", handlers.HandleLineManagerAction)
	mux.HandleFunc("/api/leave/hr-details", handlers.GetLeaveRequestByHRToken)
	mux.HandleFunc("/api/leave/hr-action", handlers.HandleHRManagerAction)
	mux.HandleFunc("/api/leave/md-details", handlers.GetLeaveRequestByMDToken)
	mux.HandleFunc("/api/leave/md-action", handlers.HandleMDAction)
	mux.HandleFunc("/api/leave/final-details", handlers.GetFinalArchiveDetails)

	// 5. Setup CORS
	c := cors.New(cors.Options{
		AllowedOrigins: []string{
			"https://petrodata-portal.onrender.com",
			"http://localhost:8080", // For local testing
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		Debug:            false, // Set to false in production
	})

	// 6. Wrap handler with CORS
	handler := c.Handler(mux)

	// 5. Server Setup
	srv := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  15 * time.Second, // Increased slightly for slower networks
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("Server is starting on port %s...", port)

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	// 6. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
