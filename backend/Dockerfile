ARG GO_IMAGE=docker.yc345.tv/mirror/golang:1.25-alpine
ARG ALPINE_IMAGE=docker.yc345.tv/mirror/alpine:3.22

FROM ${GO_IMAGE} AS builder
WORKDIR /app/backend

ARG APK_MIRROR=mirrors.aliyun.com
ARG GOPROXY=https://goproxy.cn,direct
ENV GOPROXY=${GOPROXY}

RUN sed -i "s/dl-cdn.alpinelinux.org/${APK_MIRROR}/g" /etc/apk/repositories \
  && apk add --no-cache ca-certificates git

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/clawhub-server ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/clawhub-migrate ./cmd/migrate

FROM ${ALPINE_IMAGE} AS runner
WORKDIR /app/backend

ARG APK_MIRROR=mirrors.aliyun.com
RUN sed -i "s/dl-cdn.alpinelinux.org/${APK_MIRROR}/g" /etc/apk/repositories \
  && apk add --no-cache ca-certificates

ENV GO_ENV=pro
ENV PORT=8080

COPY --from=builder /out/clawhub-server /app/backend/clawhub-server
COPY --from=builder /out/clawhub-migrate /app/backend/clawhub-migrate
COPY --from=builder /app/backend/config /app/backend/config
COPY --from=builder /app/backend/data/yclawhub_base_20260402.sql /app/backend/data/yclawhub_base_20260402.sql
COPY --from=builder /app/backend/internal/database/migrations /app/backend/internal/database/migrations

# 监听端口由环境变量 PORT 控制（与 config 中 server.port 一致），发布端口请使用 -p 宿主机:PORT
EXPOSE 8080

ENTRYPOINT ["/app/backend/clawhub-server"]
