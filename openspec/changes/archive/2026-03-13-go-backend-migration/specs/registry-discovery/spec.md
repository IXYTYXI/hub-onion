## 新增需求

### 需求：Well-known 端点
系统应提供 /.well-known/clawhub.json 端点用于注册表发现。

#### 场景：注册表元数据响应
- **当** 客户端请求 GET /.well-known/clawhub.json 时
- **则** 系统应返回 JSON，包含注册表名称、版本和 API 基础 URL

#### 场景：Well-known 的 CORS 响应头
- **当** 客户端请求 well-known 端点时
- **则** 系统应包含 CORS 响应头以允许跨域访问

### 需求：注册表信息
系统应在 well-known 响应中提供注册表元数据。

#### 场景：apiBase 字段（必需）
- **当** 返回 well-known 响应时
- **则** 系统应包含"apiBase"字段，带有完整的 API 基础 URL（如 "https://domain.com/api/v1"）

#### 场景：authBase 字段（可选）
- **当** 返回 well-known 响应时
- **则** 系统可包含"authBase"字段用于认证端点（Phase 2）

#### 场景：minCliVersion 字段（可选）
- **当** 返回 well-known 响应时
- **则** 系统可包含"minCliVersion"字段指定最低 CLI 版本要求

### 需求：CLI 兼容性
系统应确保 well-known 响应格式符合 CLI 期望。

#### 场景：响应格式验证
- **当** CLI 获取 well-known 端点时
- **则** 响应应符合 packages/schema 中定义的预期 schema

#### 场景：存在必填字段
- **当** 返回 well-known 响应时
- **则** 必填字段 apiBase 应存在，authBase 和 minCliVersion 为可选字段

### 需求：静态响应
系统应将 well-known 端点作为静态或近静态响应提供。

#### 场景：不需要认证
- **当** 客户端请求 well-known 端点时
- **则** 系统应无需认证即可响应

#### 场景：可缓存响应
- **当** 返回 well-known 响应时
- **则** 系统应包含适当的 Cache-Control 响应头用于客户端缓存

### 需求：Well-known 响应格式
系统应按照标准 schema 格式返回注册表配置信息。

#### 场景：标准响应结构（新格式）
- **当** 返回 well-known 响应时
- **则** 系统应返回 JSON，包含：
  - apiBase: string（API 基础 URL）
  - authBase: string（可选，认证基础 URL）
  - minCliVersion: string（可选，最低 CLI 版本要求）

#### 场景：兼容响应结构（旧格式）
- **当** 返回 well-known 响应时
- **则** 系统也可返回 JSON，包含：
  - registry: string（注册表标识符）
  - authBase: string（可选）
  - minCliVersion: string（可选）

#### 场景：示例响应
- **当** 客户端请求 well-known 端点时
- **则** 系统应返回类似：
  ```json
  {
    "apiBase": "https://registry.example.com/api/v1",
    "authBase": "https://auth.example.com",
    "minCliVersion": "1.0.0"
  }
  ```

### 需求：Well-known 错误处理
系统应正确处理 well-known 端点的错误情况。

#### 场景：配置缺失
- **当** 服务器未配置注册表信息时
- **则** 系统应返回 503 Service Unavailable

#### 场景：无效配置
- **当** apiBase 或 registry 字段缺失时
- **则** 系统应在启动时失败并记录配置错误
