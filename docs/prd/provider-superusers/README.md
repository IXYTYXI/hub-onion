# 授权身份驱动 Superusers 文档

本目录用于沉淀 ClawHub 当前阶段“基于授权身份信息配置 superusers，并移除 `hasBoundEmail` 权限依赖”的需求文档。

本次需求不是前端可见性收口，而是后端权限模型调整，目标是让超级管理员与管理权限从“本地邮箱绑定驱动”切换到“授权身份驱动”。

当前确认的产品方向：

- `auth.superusers` 使用按 provider 分层的结构化配置
- `superuser` 基于授权身份信息匹配，不再使用本地 `users.email`
- `superuser` 不再要求 `HasBoundEmail()`
- `management access` 也不再要求 `HasBoundEmail()`
- `hasBoundEmail` 字段和邮箱绑定流程可以继续保留，但不再作为权限门槛

目标配置结构如下：

```yaml
auth:
  superusers:
    providers:
      feishu:
        emails:
          - "admin@example.com"
        subjects:
          - "ou_xxx"
      gitlab:
        emails:
          - "admin@gitlab.example.com"
```

文档列表：

- [需求文档](./requirements.md)
- [技术方案文档](./technical-design.md)

阅读顺序建议：

1. 先阅读需求文档，确认目标、边界、范围与验收标准
2. 再阅读技术方案文档，确认配置模型、权限判断改法、影响范围和测试策略
