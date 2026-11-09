package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/openclaw/clawhub/backend/internal/config"
	"github.com/openclaw/clawhub/backend/internal/database"
	"gorm.io/gorm"
)

const (
	baseSQLFileName   = "yclawhub_base_20260402.sql"
	baseSchemaVersion = 20260402
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.NewDB(cfg.Database.URL, cfg.Database.MaxConnections)
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	command := "up"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}

	switch command {
	case "up":
		if err := runUp(db); err != nil {
			log.Fatalf("Failed to initialize database: %v", err)
		}
		fmt.Println("Database baseline applied successfully")
	case "version":
		version, dirty, initialized, err := currentVersion(db)
		if err != nil {
			log.Fatalf("Failed to get version: %v", err)
		}
		if !initialized {
			fmt.Println("Current version: uninitialized")
			return
		}
		fmt.Printf("Current version: %d (dirty: %v)\n", version, dirty)
	case "down":
		log.Fatal("Command down is not supported by the SQL baseline initializer")
	default:
		log.Fatalf("Unknown command: %s (use: up, version)", command)
	}
}

func runUp(db *gorm.DB) error {
	initialized, err := isInitialized(db)
	if err != nil {
		return err
	}

	if !initialized {
		sqlContent, err := loadBaseSQL()
		if err != nil {
			return err
		}
		if err := db.Exec(sqlContent).Error; err != nil {
			return fmt.Errorf("apply base SQL: %w", err)
		}
	}

	if err := upsertBaselineVersion(db); err != nil {
		return err
	}

	return nil
}

func currentVersion(db *gorm.DB) (version int64, dirty bool, initialized bool, err error) {
	exists, err := tableExists(db, "schema_migrations")
	if err != nil {
		return 0, false, false, err
	}
	if !exists {
		return 0, false, false, nil
	}

	err = db.Raw(`
		SELECT version, dirty
		FROM schema_migrations
		ORDER BY version DESC
		LIMIT 1
	`).Row().Scan(&version, &dirty)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return 0, false, false, nil
		}
		if strings.Contains(err.Error(), "no rows in result set") {
			return 0, false, false, nil
		}
		return 0, false, false, err
	}

	return version, dirty, true, nil
}

func isInitialized(db *gorm.DB) (bool, error) {
	return tableExists(db, "skills")
}

func tableExists(db *gorm.DB, tableName string) (bool, error) {
	var exists bool
	err := db.Raw(`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = 'public'
			  AND table_name = ?
		)
	`, tableName).Scan(&exists).Error
	if err != nil {
		return false, fmt.Errorf("check table %s exists: %w", tableName, err)
	}
	return exists, nil
}

func upsertBaselineVersion(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("DELETE FROM schema_migrations").Error; err != nil {
			return fmt.Errorf("reset schema_migrations: %w", err)
		}
		if err := tx.Exec(
			"INSERT INTO schema_migrations (version, dirty) VALUES (?, ?)",
			baseSchemaVersion,
			false,
		).Error; err != nil {
			return fmt.Errorf("write schema_migrations baseline: %w", err)
		}
		return nil
	})
}

func loadBaseSQL() (string, error) {
	path, err := resolveBaseSQLPath()
	if err != nil {
		return "", err
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read base SQL %s: %w", path, err)
	}

	lines := strings.Split(string(raw), "\n")
	filtered := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, `\`) {
			continue
		}
		filtered = append(filtered, line)
	}

	return strings.Join(filtered, "\n"), nil
}

func resolveBaseSQLPath() (string, error) {
	candidates := []string{
		filepath.Join("backend", "data", baseSQLFileName),
		filepath.Join("data", baseSQLFileName),
	}

	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("base SQL file not found, looked for %v", candidates)
}
