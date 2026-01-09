// Sample Go file with various import patterns for testing
package main

import (
	"fmt"
	"net/http"
	"os"
)

import (
	"encoding/json"
	"io"
)

// Single import
import "context"

// Aliased import
import log "github.com/sirupsen/logrus"

// Dot import (imports into current namespace)
import . "math"

// Blank import (for side effects)
import _ "github.com/lib/pq"

// Third-party imports
import (
	"github.com/gin-gonic/gin"
	"github.com/spf13/cobra"
	mux "github.com/gorilla/mux"
)

// Server struct for sample code
type Server struct {
	port   int
	router *mux.Router
}

// NewServer creates a new server instance
func NewServer(port int) *Server {
	return &Server{
		port:   port,
		router: mux.NewRouter(),
	}
}

// Start starts the server
func (s *Server) Start(ctx context.Context) error {
	log.Info("Starting server on port", s.port)

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", s.port),
		Handler: s.router,
	}

	return srv.ListenAndServe()
}

// Handler sample handler
func Handler(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Use math functions from dot import
	result := Sqrt(16) + Pi

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "ok",
		"result": result,
	})
}

func main() {
	port := 8080
	if p := os.Getenv("PORT"); p != "" {
		fmt.Sscanf(p, "%d", &port)
	}

	srv := NewServer(port)
	if err := srv.Start(context.Background()); err != nil {
		log.Fatal(err)
	}
}
