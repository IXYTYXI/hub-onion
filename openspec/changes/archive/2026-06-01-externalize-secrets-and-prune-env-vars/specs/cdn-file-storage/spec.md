## MODIFIED Requirements

### Requirement: CDN 提供商配置
系统 SHALL 支持配置 S3 协议兼容的对象存储提供商，并仅暴露当前实现实际使用的配置项。

#### Scenario: S3 兼容对象存储配置
- **WHEN** 配置 CDN 或对象存储
- **THEN** 系统 SHALL 支持 S3 协议兼容存储
- **配置项**：
  - endpoint: S3 兼容端点
  - bucket: 存储桶名称
  - region: 存储区域
  - accessKeyId: 访问密钥 ID
  - accessKeySecret: 访问密钥密码

#### Scenario: S3 协议兼容
- **WHEN** 配置 CDN 或对象存储
- **THEN** 系统 SHALL 使用 S3 兼容协议与对象存储通信

#### Scenario: 移除未使用的内网开关
- **WHEN** 系统加载对象存储配置
- **THEN** 系统 SHALL NOT 暴露或读取 `use_internal` / `OSS_USE_INTERNAL` 作为当前对象存储行为开关
