# 构建阶段
FROM golang:1.22-alpine AS builder

WORKDIR /app

# 安装依赖
RUN apk add --no-cache git

# 复制 go.mod 和 go.sum
COPY server/go.mod server/go.sum ./
RUN go mod download

# 复制源代码
COPY server/ ./

# 构建
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o fps-server ./cmd/server

# 运行阶段
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# 复制二进制文件
COPY --from=builder /app/fps-server .
COPY --from=builder /app/configs ./configs

# 复制前端静态文件
COPY client ./client

EXPOSE 8080 9090

ENV TZ=Asia/Shanghai
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=8080

CMD ["./fps-server"]
