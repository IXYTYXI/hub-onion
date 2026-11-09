# 飞书授权接口返回测试

这个目录用于手动验证两个飞书接口在你们当前授权链路下的返回数据：

1. 服务端接口：`GET /open-apis/authen/v1/user_info`
2. 客户端 JSAPI：`tt.getUserInfo`

## 目录说明

- [main.go](/Users/logo/self_repo/claw_case/clawhub/test/test_feishu_oatuh/main.go)

## 先说结论

- 服务端 `user_info` 接口可以直接用 Go 调用
- 客户端 `tt.getUserInfo` 是 JSAPI，不能像普通 HTTP API 一样直接从 Go 发请求
- 因此脚本对 `tt.getUserInfo` 的处理方式是：
  - 先让你在浏览器里拿到返回 JSON
  - 再把这份 JSON 喂给脚本做结构分析

## 用法

### 1. 直接用现成的 `user_access_token`

```bash
FEISHU_USER_ACCESS_TOKEN='u-xxxx' \
go run ./test/test_feishu_oatuh/main.go -mode server
```

### 2. 用授权回调拿到的 `code` 先换 token，再调服务端接口

```bash
FEISHU_APP_ID='cli_xxx' \
FEISHU_APP_SECRET='xxx' \
FEISHU_AUTH_CODE='xxx' \
FEISHU_REDIRECT_URI='http://localhost:8080/auth/feishu/callback' \
go run ./test/test_feishu_oatuh/main.go -mode server
```

### 3. 分析客户端 `tt.getUserInfo` 返回

先在浏览器控制台执行：

```js
tt.getUserInfo({
  success(res) {
    console.log(JSON.stringify(res, null, 2))
  },
  fail(err) {
    console.error(err)
  },
})
```

把输出保存成 JSON 文件，例如 `/tmp/feishu_client_userinfo.json`，然后运行：

```bash
go run ./test/test_feishu_oatuh/main.go -mode client -client-json /tmp/feishu_client_userinfo.json
```

### 4. 一次性都跑

```bash
FEISHU_USER_ACCESS_TOKEN='u-xxxx' \
go run ./test/test_feishu_oatuh/main.go -mode all -client-json /tmp/feishu_client_userinfo.json
```

## 这个脚本会输出什么

### 服务端接口

会打印完整 JSON，并额外总结：

- `email`
- `enterprise_email`
- `open_id`
- `union_id`
- `tenant_key`

### 客户端 JSAPI

会打印：

- `userInfo.nickName`
- 是否存在 `rawData`
- 是否存在 `encryptedData`
- 是否存在 `iv`
- 是否在明文里直接出现邮箱字段

## 备注

- 按飞书文档，网页应用里的 `tt.getUserInfo` 不支持 `withCredentials`
- 所以即使客户端有 `encryptedData`，邮箱也不一定能直接在明文里看到
- 真正决定你们当前数据库里 `provider_email` 是否有值的，优先还是服务端 `user_info` 接口返回
