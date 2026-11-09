package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
	"github.com/subosito/gotenv"
)

type Config struct {
	Environment string
	Server      ServerConfig
	Database    DatabaseConfig
	OSS         OSSConfig
	Auth        AuthConfig
}

type ServerConfig struct {
	Port string
}

type DatabaseConfig struct {
	URL            string
	MaxConnections int
}

type OSSConfig struct {
	Endpoint        string `mapstructure:"endpoint"`
	Bucket          string `mapstructure:"bucket"`
	Region          string `mapstructure:"region"`
	AccessKeyID     string `mapstructure:"access_key_id"`
	AccessKeySecret string `mapstructure:"access_key_secret"`
	UsePathStyle    bool   `mapstructure:"use_path_style"`
}

type AuthConfig struct {
	JWTSecret           string               `mapstructure:"jwt_secret"`
	FrontendURL         string               `mapstructure:"frontend_url"`
	OAuthPublicBaseURL  string               `mapstructure:"oauth_public_base_url"`
	AllowedEmailDomains []string             `mapstructure:"allowed_email_domains"`
	Superusers          SuperusersConfig     `mapstructure:"superusers"`
	GitHub              OAuthProviderConfig  `mapstructure:"github"`
	GitLab              GitLabProviderConfig `mapstructure:"gitlab"`
	Feishu              FeishuProviderConfig `mapstructure:"feishu"`
	SMTP                SMTPConfig
}

type SuperusersConfig struct {
	Providers map[string]ProviderSuperuserConfig `mapstructure:"providers"`
}

type ProviderSuperuserConfig struct {
	Emails   []string `mapstructure:"emails"`
	Subjects []string `mapstructure:"subjects"`
}

type OAuthProviderConfig struct {
	Enabled      bool   `mapstructure:"enabled"`
	ClientID     string `mapstructure:"client_id"`
	ClientSecret string `mapstructure:"client_secret"`
}

type GitLabProviderConfig struct {
	BaseURL     string `mapstructure:"base_url"`
	ImportToken string `mapstructure:"import_token"`
	CACertFile  string `mapstructure:"ca_cert_file"`
}

type FeishuProviderConfig struct {
	Enabled   bool   `mapstructure:"enabled"`
	AppID     string `mapstructure:"app_id"`
	AppSecret string `mapstructure:"app_secret"`
}

type SMTPConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
	From     string `mapstructure:"from"`
	UseTLS   bool   `mapstructure:"use_tls"`
}

func Load() (*Config, error) {
	env := normalizeEnvironment(os.Getenv("GO_ENV"))
	v := viper.New()
	v.SetConfigType("yaml")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	v.SetDefault("server.port", "8080")
	v.SetDefault("database.max_connections", 25)
	v.SetDefault("oss.use_path_style", false)
	v.SetDefault("auth.github.enabled", false)
	v.SetDefault("auth.feishu.enabled", false)
	v.SetDefault("auth.frontend_url", "http://localhost:3000")
	v.SetDefault("auth.oauth_public_base_url", "")

	bindings := configEnvBindings()
	for _, binding := range bindings {
		mustBindEnv(v, binding.key, binding.env...)
	}

	backendRoot, err := mergeConfigFiles(v, env)
	if err != nil {
		return nil, err
	}
	if err := mergeBackendEnvFile(v, filepath.Join(backendRoot, fmt.Sprintf(".env.%s", env)), bindings); err != nil {
		return nil, err
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}
	cfg.Environment = env

	if cfg.Auth.Feishu.AppID != "" {
		cfg.Auth.Feishu.Enabled = true
	}

	return &cfg, nil
}

func mergeConfigFiles(v *viper.Viper, env string) (string, error) {
	defaultLoaded := false
	envLoaded := false
	backendRoot := ""

	for _, dir := range configSearchDirs() {
		defaultPath := filepath.Join(dir, "default.yaml")
		if fileExists(defaultPath) {
			v.SetConfigFile(defaultPath)
			if err := v.MergeInConfig(); err != nil {
				return "", fmt.Errorf("failed to read default config %s: %w", defaultPath, err)
			}
			defaultLoaded = true
			backendRoot = backendRootFromConfigDir(dir)
			break
		}
	}

	envFileName := fmt.Sprintf("%s.yaml", env)
	for _, dir := range configSearchDirs() {
		envPath := filepath.Join(dir, envFileName)
		if fileExists(envPath) {
			v.SetConfigFile(envPath)
			if err := v.MergeInConfig(); err != nil {
				return "", fmt.Errorf("failed to read env config %s: %w", envPath, err)
			}
			envLoaded = true
			backendRoot = backendRootFromConfigDir(dir)
			break
		}
	}

	if !defaultLoaded && !envLoaded {
		return "", fmt.Errorf("no config files found for GO_ENV=%s (looked for default.yaml and %s in %v)", env, envFileName, configSearchDirs())
	}
	if !envLoaded {
		return "", fmt.Errorf("no environment config found for GO_ENV=%s (expected %s in %v)", env, envFileName, configSearchDirs())
	}

	return backendRoot, nil
}

func configSearchDirs() []string {
	return []string{
		"config",
		"backend/config",
		"./config",
		"./backend/config",
		"../config",
		"../backend/config",
		"../../config",
		"../../backend/config",
	}
}

func normalizeEnvironment(value string) string {
	env := strings.ToLower(strings.TrimSpace(value))
	if env == "" {
		return "local"
	}
	return env
}

func mustBindEnv(v *viper.Viper, key string, envNames ...string) {
	args := append([]string{key}, envNames...)
	if err := v.BindEnv(args...); err != nil {
		panic(fmt.Errorf("bind env %s failed: %w", key, err))
	}
}

type envBinding struct {
	key string
	env []string
}

func configEnvBindings() []envBinding {
	return []envBinding{
		{key: "server.port", env: []string{"PORT"}},
		{key: "database.url", env: []string{"DATABASE_URL"}},
		{key: "database.max_connections", env: []string{"DATABASE_MAX_CONNECTIONS"}},
		{key: "oss.endpoint", env: []string{"OSS_ENDPOINT"}},
		{key: "oss.bucket", env: []string{"OSS_BUCKET"}},
		{key: "oss.region", env: []string{"OSS_REGION"}},
		{key: "oss.access_key_id", env: []string{"OSS_ACCESS_KEY_ID"}},
		{key: "oss.access_key_secret", env: []string{"OSS_ACCESS_KEY_SECRET"}},
		{key: "oss.use_path_style", env: []string{"OSS_USE_PATH_STYLE"}},
		{key: "auth.jwt_secret", env: []string{"JWT_SECRET"}},
		{key: "auth.frontend_url", env: []string{"FRONTEND_URL"}},
		{key: "auth.oauth_public_base_url", env: []string{"OAUTH_PUBLIC_BASE_URL"}},
		{key: "auth.github.enabled", env: []string{"GITHUB_ENABLED"}},
		{key: "auth.github.client_id", env: []string{"GITHUB_CLIENT_ID"}},
		{key: "auth.github.client_secret", env: []string{"GITHUB_CLIENT_SECRET"}},
		{key: "auth.gitlab.base_url", env: []string{"GITLAB_BASE_URL"}},
		{key: "auth.gitlab.import_token", env: []string{"GITLAB_IMPORT_TOKEN"}},
		{key: "auth.gitlab.ca_cert_file", env: []string{"GITLAB_CA_CERT_FILE"}},
		{key: "auth.feishu.enabled", env: []string{"FEISHU_ENABLED"}},
		{key: "auth.feishu.app_id", env: []string{"FEISHU_APP_ID"}},
		{key: "auth.feishu.app_secret", env: []string{"FEISHU_APP_SECRET"}},
		{key: "auth.smtp.host", env: []string{"SMTP_HOST"}},
		{key: "auth.smtp.port", env: []string{"SMTP_PORT"}},
		{key: "auth.smtp.username", env: []string{"SMTP_USERNAME"}},
		{key: "auth.smtp.password", env: []string{"SMTP_PASSWORD"}},
		{key: "auth.smtp.from", env: []string{"SMTP_FROM"}},
		{key: "auth.smtp.use_tls", env: []string{"SMTP_USE_TLS"}},
	}
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func backendRootFromConfigDir(dir string) string {
	return filepath.Clean(filepath.Join(dir, ".."))
}

func mergeBackendEnvFile(v *viper.Viper, path string, bindings []envBinding) error {
	if !fileExists(path) {
		return nil
	}

	values, err := gotenv.Read(path)
	if err != nil {
		return fmt.Errorf("failed to read backend env file %s: %w", path, err)
	}
	if len(values) == 0 {
		return nil
	}

	envToKey := make(map[string]string)
	for _, binding := range bindings {
		for _, envName := range binding.env {
			envToKey[envName] = binding.key
		}
	}

	configValues := make(map[string]any)
	for envName, value := range values {
		if strings.TrimSpace(value) == "" {
			continue
		}
		key, ok := envToKey[envName]
		if !ok {
			continue
		}
		assignDottedKey(configValues, key, value)
	}
	if len(configValues) == 0 {
		return nil
	}

	if err := v.MergeConfigMap(configValues); err != nil {
		return fmt.Errorf("failed to merge backend env file %s: %w", path, err)
	}
	return nil
}

func assignDottedKey(root map[string]any, key string, value string) {
	parts := strings.Split(key, ".")
	current := root
	for _, part := range parts[:len(parts)-1] {
		next, ok := current[part].(map[string]any)
		if !ok {
			next = make(map[string]any)
			current[part] = next
		}
		current = next
	}
	current[parts[len(parts)-1]] = value
}
