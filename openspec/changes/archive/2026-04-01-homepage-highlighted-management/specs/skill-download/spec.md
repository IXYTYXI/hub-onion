## MODIFIED Requirements

### Requirement: 下载统计跟踪
系统 SHALL 在 ZIP 成功生成时递增下载计数器，并按最小安装统计方案同步递增累计安装计数器。

#### 场景：递增下载计数
- **当** ZIP 下载完成时
- **则** 系统应将 skills.stats_downloads 递增 1

#### 场景：递增累计安装计数
- **当** ZIP 下载完成时
- **则** 系统应将 skills.stats_installs 递增 1，并将其作为累计安装次数

#### 场景：失败下载不递增
- **当** ZIP 下载失败或取消时
- **则** 系统不应递增下载计数器或累计安装计数器
