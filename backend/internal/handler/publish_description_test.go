package handler

import (
	"mime/multipart"
	"net/textproto"
	"testing"

	"github.com/openclaw/clawhub/backend/internal/skillmeta"
	"github.com/stretchr/testify/assert"
)

func TestExtractFrontmatterDescription(t *testing.T) {
	description, ok := skillmeta.ExtractFrontmatterDescription(`---
name: demo
description: >
  自动追踪群聊中的待办事项。
  避免遗漏承诺。
---

# Demo
`)

	assert.True(t, ok)
	assert.Equal(t, "自动追踪群聊中的待办事项。 避免遗漏承诺。", description)
}

func TestExtractFrontmatterDescriptionIgnoresMissingOrInvalidValues(t *testing.T) {
	tests := []string{
		"# Demo\n",
		"---\nname: demo\n---\n# Demo\n",
		"---\ndescription: 123\n---\n# Demo\n",
		"---\ndescription: \"   \"\n---\n# Demo\n",
		"---\n: bad\n---\n# Demo\n",
	}

	for _, input := range tests {
		description, ok := skillmeta.ExtractFrontmatterDescription(input)
		assert.False(t, ok)
		assert.Empty(t, description)
	}
}

func TestNormalizePublishPathAndPrimaryReadmeSelection(t *testing.T) {
	assert.Equal(t, "SKILL.md", skillmeta.NormalizePath("./SKILL.md"))
	assert.Equal(t, "scripts/run.sh", skillmeta.NormalizePath(`\scripts\run.sh`))

	assert.True(t, skillmeta.IsPrimaryReadmePath("SKILL.md"))
	assert.True(t, skillmeta.IsPrimaryReadmePath("skill.MD"))
	assert.True(t, skillmeta.IsPrimaryReadmePath("./skills.md"))
	assert.False(t, skillmeta.IsPrimaryReadmePath("docs/SKILL.md"))
	assert.False(t, skillmeta.IsPrimaryReadmePath("../SKILL.md"))
}

func TestPublishFilePathUsesRawMultipartFilename(t *testing.T) {
	fileHeader := &multipart.FileHeader{
		Filename: "SKILL.md",
		Header: textproto.MIMEHeader{
			"Content-Disposition": {`form-data; name="files"; filename="docs/SKILL.md"`},
		},
	}

	assert.Equal(t, "docs/SKILL.md", publishFilePath(fileHeader))
}

func TestTextFileDetectionIsCaseInsensitive(t *testing.T) {
	assert.True(t, isTextFile("SKILL.MD"))
	assert.True(t, isTextFile("scripts/RUN.SH"))
	assert.False(t, isTextFile("image.PNG"))
}

func TestTextFileDetectionSupportsMJS(t *testing.T) {
	assert.True(t, isTextFile("scripts/index.mjs"))
	assert.True(t, isTextFile("scripts/INDEX.MJS"))
}

func TestMJSUploadContentTypeIsJavaScript(t *testing.T) {
	assert.Equal(t, "text/javascript", normalizeUploadContentType("scripts/index.mjs", "application/octet-stream"))
}

func TestMJSResponseContentTypeIncludesUTF8Charset(t *testing.T) {
	assert.Equal(t, "text/javascript; charset=utf-8", normalizeResponseContentType("index.mjs", "application/octet-stream"))
}
