package skillmeta

import (
	"strings"

	"gopkg.in/yaml.v3"
)

func NormalizePath(path string) string {
	normalized := strings.ReplaceAll(path, "\\", "/")
	normalized = strings.TrimSpace(normalized)
	for strings.HasPrefix(normalized, "./") {
		normalized = strings.TrimPrefix(normalized, "./")
	}
	normalized = strings.TrimLeft(normalized, "/")
	return normalized
}

func IsPrimaryReadmePath(path string) bool {
	switch strings.ToLower(NormalizePath(path)) {
	case "skill.md", "skills.md":
		return true
	default:
		return false
	}
}

func PrimaryReadmePriority(path string) int {
	switch strings.ToLower(NormalizePath(path)) {
	case "skill.md":
		return 0
	case "skills.md":
		return 1
	default:
		return 2
	}
}

func ExtractFrontmatterDescription(content string) (string, bool) {
	normalized := strings.ReplaceAll(strings.ReplaceAll(content, "\r\n", "\n"), "\r", "\n")
	if !strings.HasPrefix(normalized, "---\n") {
		return "", false
	}
	endIndex := strings.Index(normalized[len("---\n"):], "\n---")
	if endIndex < 0 {
		return "", false
	}
	block := normalized[len("---\n") : len("---\n")+endIndex]

	var frontmatter map[string]interface{}
	if err := yaml.Unmarshal([]byte(block), &frontmatter); err != nil {
		return "", false
	}
	raw, ok := frontmatter["description"]
	if !ok {
		return "", false
	}
	description, ok := raw.(string)
	if !ok {
		return "", false
	}
	description = strings.Join(strings.Fields(description), " ")
	if description == "" {
		return "", false
	}
	return description, true
}
