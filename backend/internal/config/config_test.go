package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadUsesLocalByDefault(t *testing.T) {
	t.Setenv("GO_ENV", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Environment != "local" {
		t.Fatalf("expected environment local, got %s", cfg.Environment)
	}
}

func TestLoadUsesRequestedEnvironment(t *testing.T) {
	t.Setenv("GO_ENV", "test")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Environment != "test" {
		t.Fatalf("expected environment test, got %s", cfg.Environment)
	}
}

func TestEnvironmentVariablesOverrideConfig(t *testing.T) {
	t.Setenv("GO_ENV", "test")
	t.Setenv("DATABASE_URL", "postgres://override")
	t.Setenv("JWT_SECRET", "jwt-override")
	t.Setenv("FRONTEND_URL", "https://frontend.example.com")
	t.Setenv("OAUTH_PUBLIC_BASE_URL", "https://oauth.example.com")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Database.URL != "postgres://override" {
		t.Fatalf("expected DATABASE_URL override to apply, got %s", cfg.Database.URL)
	}
	if cfg.Auth.JWTSecret != "jwt-override" {
		t.Fatalf("expected JWT_SECRET override to apply, got %s", cfg.Auth.JWTSecret)
	}
	if cfg.Auth.FrontendURL != "https://frontend.example.com" {
		t.Fatalf("expected FRONTEND_URL override to apply, got %s", cfg.Auth.FrontendURL)
	}
	if cfg.Auth.OAuthPublicBaseURL != "https://oauth.example.com" {
		t.Fatalf("expected OAUTH_PUBLIC_BASE_URL override to apply, got %s", cfg.Auth.OAuthPublicBaseURL)
	}
}

func TestBackendEnvFileOverridesConfigWithoutReadingRootEnv(t *testing.T) {
	root := writeTempBackendConfig(t)
	writeFile(t, filepath.Join(root, ".env.test"), "JWT_SECRET=root-env\nOSS_ACCESS_KEY_ID=root-key\n")
	writeFile(t, filepath.Join(root, "backend", ".env.test"), "JWT_SECRET=backend-env\nOSS_ACCESS_KEY_ID=backend-key\n")
	chdir(t, root)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Auth.JWTSecret != "backend-env" {
		t.Fatalf("expected backend env JWT_SECRET, got %s", cfg.Auth.JWTSecret)
	}
	if cfg.OSS.AccessKeyID != "backend-key" {
		t.Fatalf("expected backend env OSS_ACCESS_KEY_ID, got %s", cfg.OSS.AccessKeyID)
	}
}

func TestProcessEnvironmentOverridesBackendEnvFile(t *testing.T) {
	root := writeTempBackendConfig(t)
	writeFile(t, filepath.Join(root, "backend", ".env.test"), "JWT_SECRET=backend-env\n")
	chdir(t, root)
	t.Setenv("JWT_SECRET", "process-env")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Auth.JWTSecret != "process-env" {
		t.Fatalf("expected process env JWT_SECRET, got %s", cfg.Auth.JWTSecret)
	}
}

func TestBackendEnvFileCanBeLocatedFromBackendWorkingDirs(t *testing.T) {
	cases := []struct {
		name string
		cwd  string
	}{
		{name: "repo root", cwd: "."},
		{name: "backend", cwd: "backend"},
		{name: "backend internal config", cwd: filepath.Join("backend", "internal", "config")},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			root := writeTempBackendConfig(t)
			writeFile(t, filepath.Join(root, "backend", ".env.test"), "JWT_SECRET=backend-env\n")
			chdir(t, filepath.Join(root, tc.cwd))

			cfg, err := Load()
			if err != nil {
				t.Fatalf("Load() error = %v", err)
			}

			if cfg.Auth.JWTSecret != "backend-env" {
				t.Fatalf("expected backend env JWT_SECRET, got %s", cfg.Auth.JWTSecret)
			}
		})
	}
}

func TestMalformedBackendEnvFileReturnsError(t *testing.T) {
	root := writeTempBackendConfig(t)
	writeFile(t, filepath.Join(root, "backend", ".env.test"), "JWT_SECRET='unterminated\n")
	chdir(t, root)

	if _, err := Load(); err == nil {
		t.Fatalf("expected malformed backend env file to return an error")
	}
}

func TestSuperusersLoadFromYAML(t *testing.T) {
	root := writeTempBackendConfig(t)
	chdir(t, root)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	feishu, ok := cfg.Auth.Superusers.Providers["feishu"]
	if !ok {
		t.Fatalf("expected feishu provider config to exist")
	}
	if len(feishu.Emails) != 1 || feishu.Emails[0] != "admin@example.com" {
		t.Fatalf("unexpected feishu emails: %#v", feishu.Emails)
	}
}

func TestGitHubEnabledFalseStaysDisabledWithClientCredentials(t *testing.T) {
	root := writeTempBackendConfig(t)
	writeFile(t, filepath.Join(root, "backend", ".env.test"), "GITHUB_CLIENT_ID=client\nGITHUB_CLIENT_SECRET=secret\nGITHUB_ENABLED=false\n")
	chdir(t, root)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Auth.GitHub.Enabled {
		t.Fatalf("expected GitHub provider to stay disabled")
	}
}

func writeTempBackendConfig(t *testing.T) string {
	t.Helper()

	root := t.TempDir()
	configDir := filepath.Join(root, "backend", "config")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		t.Fatalf("mkdir config dir: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(root, "backend", "internal", "config"), 0o755); err != nil {
		t.Fatalf("mkdir internal config dir: %v", err)
	}

	configYAML := `server:
  port: "8080"
database:
  url: "postgres://config"
  max_connections: 25
oss:
  endpoint: "s3.example.com"
  bucket: "clawhub"
  region: "cn-east-1"
  access_key_id: "config-key"
  access_key_secret: "config-secret"
auth:
  jwt_secret: "config-jwt"
  frontend_url: "http://localhost:3000"
  allowed_email_domains:
    - "example.com"
  superusers:
    providers:
      feishu:
        emails:
          - "admin@example.com"
  github:
    enabled: false
    client_id: ""
    client_secret: ""
  gitlab:
    base_url: "https://gitlab.example.com"
    import_token: ""
    ca_cert_file: ""
  feishu:
    enabled: false
    app_id: ""
    app_secret: ""
  smtp:
    host: ""
    port: 465
    username: ""
    password: ""
    from: ""
    use_tls: true
`
	writeFile(t, filepath.Join(configDir, "default.yaml"), configYAML)
	writeFile(t, filepath.Join(configDir, "test.yaml"), configYAML)
	t.Setenv("GO_ENV", "test")
	return root
}

func writeFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

func chdir(t *testing.T, dir string) {
	t.Helper()
	previous, err := os.Getwd()
	if err != nil {
		t.Fatalf("get cwd: %v", err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatalf("chdir %s: %v", dir, err)
	}
	t.Cleanup(func() {
		if err := os.Chdir(previous); err != nil {
			t.Fatalf("restore cwd: %v", err)
		}
	})
}
