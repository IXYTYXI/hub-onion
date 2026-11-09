## ADDED Requirements

### Requirement: 上传页支持维护多个相关文档链接
系统 SHALL 在 `/upload` 基础信息卡的分类控件之后提供“相关文档（可选）”区域，允许用户添加、编辑和删除最多 10 个文档链接。每行 SHALL 包含可选标题、URL 和删除操作。

#### Scenario: 添加相关文档行
- **WHEN** 用户点击“添加文档链接”且当前少于 10 行
- **THEN** 上传页 SHALL 新增一行可编辑的标题和 URL 输入

#### Scenario: 删除相关文档行
- **WHEN** 用户删除某一相关文档行
- **THEN** 上传页 SHALL 立即从当前表单状态移除该行
- **THEN** 后续发布 payload MUST NOT 包含该行

#### Scenario: 达到链接数量上限
- **WHEN** 当前表单已有 10 个非空相关文档链接
- **THEN** 上传页 SHALL 禁用或隐藏“添加文档链接”操作
- **THEN** 上传页 SHALL 展示最多 10 个链接的说明

#### Scenario: 未添加相关文档
- **WHEN** 用户没有添加任何相关文档并发布新 skill
- **THEN** 上传页 SHALL 允许继续发布
- **THEN** 前端 SHALL 提交空数组或省略 `documentationLinks`

### Requirement: 上传页即时校验相关文档
上传页 MUST 镜像服务端的数量、标题长度、URL 长度、绝对地址、协议、hostname、userinfo 和重复 URL 校验，并把问题加入现有“校验结果”区域。

#### Scenario: 完全空白的新增行
- **WHEN** 一行的标题和 URL 都只有空白字符
- **THEN** 前端 SHALL 在构造 payload 时忽略该行
- **THEN** 该空白行 MUST NOT 单独阻止发布

#### Scenario: 只有标题没有 URL
- **WHEN** 一行包含非空标题但 URL 为空
- **THEN** 上传页 SHALL 展示 URL 必填错误
- **THEN** 发布按钮 SHALL 保持禁用

#### Scenario: URL 不符合规则
- **WHEN** 任一非空 URL 不是带 hostname 的绝对 `http`/`https` URL、包含 userinfo、超过 2048 个字符或与另一行重复
- **THEN** 上传页 SHALL 在校验结果中展示对应错误
- **THEN** 发布按钮 SHALL 保持禁用

#### Scenario: 标题或数量超限
- **WHEN** 任一非空标题超过 80 个 Unicode 字符，或有效链接数量超过 10
- **THEN** 上传页 SHALL 在校验结果中展示对应错误
- **THEN** 发布按钮 SHALL 保持禁用

### Requirement: 上传页提交规范化后的相关文档
上传页 SHALL 在发布时去除标题和 URL 的首尾空白、忽略完全空白行，并按页面顺序把其余行作为 `documentationLinks` 写入发布 payload。

#### Scenario: 发布带标题和无标题链接
- **WHEN** 用户填写了一个带标题链接和一个不带标题的合法链接并提交
- **THEN** payload SHALL 按页面顺序包含两个对象
- **THEN** 第一个对象 SHALL 包含规范化后的 `title` 和 `url`
- **THEN** 第二个对象 SHALL 只包含规范化后的 `url`

#### Scenario: 服务端仍拒绝无效链接
- **WHEN** 前端校验与服务端校验因竞态或客户端绕过而不一致
- **THEN** 前端 SHALL 展示服务端返回的 `invalid_documentation_link` 发布错误
- **THEN** 前端 MUST NOT 把失败请求显示为发布成功

### Requirement: 发布已有 skill 新版本时预填相关文档
上传页 SHALL 在确认输入 slug 属于当前用户后，从 skill 详情响应预填当前 `documentationLinks`，使 owner 可以保留、修改或显式清空已有链接。

#### Scenario: owner 打开新版本发布流程
- **WHEN** owner 通过预填 `updateSlug` 或手工输入自己的已有 slug，且尚未编辑相关文档区域
- **THEN** 上传页 SHALL 按详情响应顺序预填当前相关文档

#### Scenario: 用户编辑后晚到响应不得覆盖
- **WHEN** 用户已经添加、修改或删除过相关文档行，随后 slug 检查或详情请求才完成
- **THEN** 上传页 MUST 保留用户当前输入
- **THEN** 上传页 MUST NOT 使用响应数据覆盖已编辑的相关文档

#### Scenario: owner 显式清空并发布
- **WHEN** owner 删除所有预填链接并发布新版本
- **THEN** 前端 SHALL 显式提交 `documentationLinks: []`
- **THEN** 后端 SHALL 清空该 skill 的相关文档

#### Scenario: 切换到其他 slug
- **WHEN** 用户在未编辑相关文档的情况下把 slug 从一个已有 skill 切换到另一个自己拥有的 skill
- **THEN** 上传页 SHALL 使用新 skill 的相关文档替换旧预填值
