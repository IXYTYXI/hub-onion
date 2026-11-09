package handler

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseCreatedTimeRangeDateBounds(t *testing.T) {
	rangeValue, err := parseCreatedTimeRange("2026-08-01", "2026-08-01")
	require.NoError(t, err)
	require.NotNil(t, rangeValue.From)
	require.NotNil(t, rangeValue.To)

	assert.Equal(t, "2026-08-01T00:00:00+08:00", rangeValue.From.Format(time.RFC3339))
	assert.Equal(t, "2026-08-01T23:59:59+08:00", rangeValue.To.Truncate(time.Second).Format(time.RFC3339))
	assert.Equal(t, 999999999, rangeValue.To.Nanosecond())
}

func TestParseCreatedTimeRangeRejectsUnixAndReversed(t *testing.T) {
	_, err := parseCreatedTimeRange("1722470400", "")
	require.Error(t, err)

	_, err = parseCreatedTimeRange("2026-08-01T12:00:00", "")
	require.Error(t, err)

	_, err = parseCreatedTimeRange("2026-08-02", "2026-08-01")
	require.Error(t, err)
}

func TestParseCreatedTimeRangeRFC3339(t *testing.T) {
	rangeValue, err := parseCreatedTimeRange("2026-08-01T00:00:00Z", "2026-08-01T12:00:00+08:00")
	require.NoError(t, err)
	require.NotNil(t, rangeValue.From)
	require.NotNil(t, rangeValue.To)
	assert.True(t, rangeValue.From.Equal(time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)))
}

func TestParseManagedSkillOrdering(t *testing.T) {
	col, dir, err := parseManagedSkillOrdering("", "")
	require.NoError(t, err)
	assert.Equal(t, "updated_at", col)
	assert.Equal(t, "DESC", dir)

	col, dir, err = parseManagedSkillOrdering("created_at", "asc")
	require.NoError(t, err)
	assert.Equal(t, "created_at", col)
	assert.Equal(t, "ASC", dir)

	col, dir, err = parseManagedSkillOrdering("submitted_at", "desc")
	require.NoError(t, err)
	assert.Equal(t, "submitted_at", col)
	assert.Equal(t, "DESC", dir)

	_, _, err = parseManagedSkillOrdering("downloads", "desc")
	require.Error(t, err)

	_, _, err = parseManagedSkillOrdering("created_at", "up")
	require.Error(t, err)
}

func TestParseManagedSkillTimeField(t *testing.T) {
	field, err := parseManagedSkillTimeField("")
	require.NoError(t, err)
	assert.Equal(t, "created_at", field)

	field, err = parseManagedSkillTimeField("submitted_at")
	require.NoError(t, err)
	assert.Equal(t, "submitted_at", field)

	_, err = parseManagedSkillTimeField("updated_at")
	require.Error(t, err)
}

func TestShanghaiExportFilename(t *testing.T) {
	now := time.Date(2026, 8, 14, 6, 7, 8, 0, time.UTC)
	assert.Equal(t, "skills-20260814-140708.csv", shanghaiExportFilename(now))
}
