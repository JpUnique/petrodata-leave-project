package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// Auth validates JWT token and adds user info to request context
func Auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"Missing authorization token"}`, http.StatusUnauthorized)
			return
		}

		// Expected format: "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			http.Error(w, `{"error":"Invalid authorization format"}`, http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]

		// Parse and validate token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Ensure signing method is HMAC
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(os.Getenv("JWT_SECRET")), nil
		})

		if err != nil || !token.Valid {
			http.Error(w, `{"error":"Invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		// Extract claims
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, `{"error":"Invalid token claims"}`, http.StatusUnauthorized)
			return
		}

		// Add user data to context
		ctx := r.Context()
		ctx = context.WithValue(ctx, "userEmail", claims["email"])
		ctx = context.WithValue(ctx, "userName", claims["name"])
		ctx = context.WithValue(ctx, "userStaffNo", claims["staff_no"])

		// Call next handler with enriched context
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}
