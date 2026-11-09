package main

import (
	"fmt"
	"log"

	"github.com/openclaw/clawhub/backend/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := gorm.Open(postgres.Open(cfg.Database.URL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}

	// Fix dirty migration state
	result := db.Exec("UPDATE schema_migrations SET dirty = false WHERE version = 4")
	if result.Error != nil {
		log.Fatalf("Failed to fix dirty state: %v", result.Error)
	}

	fmt.Println("✓ Fixed dirty migration state")

	// Create the missing index
	result = db.Exec("CREATE INDEX IF NOT EXISTS idx_skill_versions_content_hash ON skill_versions(content_hash)")
	if result.Error != nil {
		log.Fatalf("Failed to create index: %v", result.Error)
	}

	fmt.Println("✓ Created content_hash index")
	fmt.Println("\nDatabase is now ready!")
}
