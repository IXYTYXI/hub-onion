package handler

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

var (
	shanghaiLocation     *time.Location
	dateOnlyPattern      = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	unixTimestampPattern = regexp.MustCompile(`^\d+$`)
)

func init() {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.FixedZone("Asia/Shanghai", 8*60*60)
	}
	shanghaiLocation = loc
}

type createdTimeRange struct {
	From *time.Time
	To   *time.Time
}

// parseCreatedTimeBound parses a single createdFrom/createdTo value.
// Accepted: YYYY-MM-DD (Asia/Shanghai day bounds) or RFC3339/RFC3339Nano with explicit zone.
func parseCreatedTimeBound(raw string, endOfDay bool) (time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return time.Time{}, fmt.Errorf("empty time value")
	}
	if unixTimestampPattern.MatchString(value) {
		return time.Time{}, fmt.Errorf("unix timestamps are not allowed; use YYYY-MM-DD or RFC3339 with timezone")
	}
	if dateOnlyPattern.MatchString(value) {
		t, err := time.ParseInLocation("2006-01-02", value, shanghaiLocation)
		if err != nil {
			return time.Time{}, fmt.Errorf("invalid date %q", value)
		}
		if endOfDay {
			return time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 999999999, shanghaiLocation), nil
		}
		return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, shanghaiLocation), nil
	}

	if t, err := time.Parse(time.RFC3339Nano, value); err == nil {
		return t, nil
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t, nil
	}
	return time.Time{}, fmt.Errorf("invalid time %q; use YYYY-MM-DD or RFC3339 with timezone", value)
}

func parseCreatedTimeRange(fromRaw, toRaw string) (createdTimeRange, error) {
	var result createdTimeRange
	fromRaw = strings.TrimSpace(fromRaw)
	toRaw = strings.TrimSpace(toRaw)

	if fromRaw != "" {
		from, err := parseCreatedTimeBound(fromRaw, false)
		if err != nil {
			return createdTimeRange{}, fmt.Errorf("invalid createdFrom: %w", err)
		}
		result.From = &from
	}
	if toRaw != "" {
		to, err := parseCreatedTimeBound(toRaw, true)
		if err != nil {
			return createdTimeRange{}, fmt.Errorf("invalid createdTo: %w", err)
		}
		result.To = &to
	}
	if result.From != nil && result.To != nil && result.From.After(*result.To) {
		return createdTimeRange{}, fmt.Errorf("createdFrom must be less than or equal to createdTo")
	}
	return result, nil
}

func parseManagedSkillOrdering(sortRaw, dirRaw string) (column string, direction string, err error) {
	sortKey := strings.TrimSpace(sortRaw)
	dirKey := strings.ToLower(strings.TrimSpace(dirRaw))

	switch sortKey {
	case "", "updated_at":
		column = "updated_at"
	case "created_at":
		column = "created_at"
	case "submitted_at":
		column = "submitted_at"
	default:
		return "", "", fmt.Errorf("invalid sort %q; use created_at, updated_at, or submitted_at", sortKey)
	}

	switch dirKey {
	case "", "desc":
		direction = "DESC"
	case "asc":
		direction = "ASC"
	default:
		return "", "", fmt.Errorf("invalid dir %q; use asc or desc", dirKey)
	}

	return column, direction, nil
}

// parseManagedSkillTimeField returns created_at (default) or submitted_at.
func parseManagedSkillTimeField(raw string) (string, error) {
	key := strings.TrimSpace(raw)
	switch key {
	case "", "created_at":
		return "created_at", nil
	case "submitted_at":
		return "submitted_at", nil
	default:
		return "", fmt.Errorf("invalid timeField %q; use created_at or submitted_at", key)
	}
}

func formatShanghaiRFC3339(t time.Time) string {
	return t.In(shanghaiLocation).Format(time.RFC3339)
}

func shanghaiExportFilename(now time.Time) string {
	return fmt.Sprintf("skills-%s.csv", now.In(shanghaiLocation).Format("20060102-150405"))
}
