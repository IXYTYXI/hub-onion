package service

import (
	"testing"
	"time"

	"github.com/openclaw/clawhub/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSkillListCursorRoundTrip(t *testing.T) {
	now := time.Date(2026, 8, 14, 7, 8, 9, 123456789, time.UTC)
	skill := model.Skill{
		ID:        "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
		CreatedAt: now,
		UpdatedAt: now.Add(time.Minute),
	}

	encoded := encodeSkillListCursor(skill, "created_at")
	value, id, err := parseSkillListCursor(encoded, "created_at")
	require.NoError(t, err)
	assert.Equal(t, skill.ID, id)
	parsed, ok := value.(time.Time)
	require.True(t, ok)
	assert.True(t, parsed.Equal(now))
}

func TestSkillListCursorRejectsLegacyAsLegacy(t *testing.T) {
	_, _, err := parseSkillListCursor("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "created_at")
	require.ErrorIs(t, err, errLegacySkillCursor)
}
