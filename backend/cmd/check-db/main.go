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

	// Check if skill_versions table exists and its columns
	var columns []struct {
		ColumnName string
		DataType   string
	}

	err = db.Raw(`
		SELECT column_name, data_type
		FROM information_schema.columns
		WHERE table_name = 'skill_versions'
		ORDER BY ordinal_position
	`).Scan(&columns).Error

	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}

	fmt.Println("skill_versions table columns:")
	for _, col := range columns {
		fmt.Printf("  - %s (%s)\n", col.ColumnName, col.DataType)
	}

	// Check migration status
	var migration struct {
		Version int
		Dirty   bool
	}
	err = db.Raw("SELECT version, dirty FROM schema_migrations LIMIT 1").Scan(&migration).Error
	if err == nil {
		fmt.Printf("\nMigration status: version=%d, dirty=%v\n", migration.Version, migration.Dirty)
	}
}
