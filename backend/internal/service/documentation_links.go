package service

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
	"unicode/utf8"

	"github.com/openclaw/clawhub/backend/internal/model"
)

var ErrInvalidDocumentationLink = errors.New("invalid documentation link")

type documentationLinkValidationError struct {
	err error
}

func (e *documentationLinkValidationError) Error() string {
	return e.err.Error()
}

func (e *documentationLinkValidationError) Unwrap() error {
	return ErrInvalidDocumentationLink
}

func newDocumentationLinkValidationError(err error) error {
	return &documentationLinkValidationError{err: err}
}

func NormalizeDocumentationLinks(links *model.DocumentationLinkList) (*model.DocumentationLinkList, error) {
	if links == nil {
		return nil, nil
	}
	if len(*links) > 10 {
		return nil, fmt.Errorf("documentationLinks must contain at most 10 links")
	}

	normalized := make(model.DocumentationLinkList, 0, len(*links))
	seenURLs := make(map[string]struct{}, len(*links))
	for index, link := range *links {
		title := strings.TrimSpace(link.Title)
		rawURL := strings.TrimSpace(link.URL)

		if utf8.RuneCountInString(title) > 80 {
			return nil, fmt.Errorf("documentationLinks[%d].title must contain at most 80 characters", index)
		}
		if rawURL == "" {
			return nil, fmt.Errorf("documentationLinks[%d].url is required", index)
		}
		if utf8.RuneCountInString(rawURL) > 2048 {
			return nil, fmt.Errorf("documentationLinks[%d].url must contain at most 2048 characters", index)
		}

		parsed, err := url.Parse(rawURL)
		if err != nil || !parsed.IsAbs() || parsed.Hostname() == "" {
			return nil, fmt.Errorf("documentationLinks[%d].url must be an absolute URL with a hostname", index)
		}
		scheme := strings.ToLower(parsed.Scheme)
		if scheme != "http" && scheme != "https" {
			return nil, fmt.Errorf("documentationLinks[%d].url must use http or https", index)
		}
		if parsed.User != nil {
			return nil, fmt.Errorf("documentationLinks[%d].url must not include user information", index)
		}
		if _, exists := seenURLs[rawURL]; exists {
			return nil, fmt.Errorf("documentationLinks[%d].url is duplicated", index)
		}
		seenURLs[rawURL] = struct{}{}
		normalized = append(normalized, model.DocumentationLink{Title: title, URL: rawURL})
	}

	return &normalized, nil
}
