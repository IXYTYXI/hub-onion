package service

import (
	"bytes"
	"io"
	"testing"

	"github.com/openclaw/clawhub/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type trackingReadCloser struct {
	*bytes.Reader
	closed bool
}

func (r *trackingReadCloser) Close() error {
	r.closed = true
	return nil
}

func TestPrimaryReadmeFilePrefersSkillMD(t *testing.T) {
	file, ok := primaryReadmeFile(model.FileList{
		{Path: "skills.md", StorageKey: "skills"},
		{Path: "docs/SKILL.md", StorageKey: "nested"},
		{Path: "./SKILL.md", StorageKey: "skill"},
	})

	require.True(t, ok)
	assert.Equal(t, "skill", file.StorageKey)
}

func TestReadAndCloseLimitedClosesReader(t *testing.T) {
	reader := &trackingReadCloser{Reader: bytes.NewReader([]byte("hello"))}

	bytes, err := readAndCloseLimited(reader, 10)

	require.NoError(t, err)
	assert.Equal(t, []byte("hello"), bytes)
	assert.True(t, reader.closed)
}

func TestReadAndCloseLimitedRejectsOversizedContent(t *testing.T) {
	reader := &trackingReadCloser{Reader: bytes.NewReader([]byte("too-large"))}

	bytes, err := readAndCloseLimited(reader, 3)

	require.Error(t, err)
	assert.Nil(t, bytes)
	assert.True(t, reader.closed)
}

func TestReadAndCloseLimitedPropagatesReadError(t *testing.T) {
	reader := io.NopCloser(errorReader{})

	bytes, err := readAndCloseLimited(reader, 10)

	require.Error(t, err)
	assert.Nil(t, bytes)
}

type errorReader struct{}

func (errorReader) Read(_ []byte) (int, error) {
	return 0, assert.AnError
}
