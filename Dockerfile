# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend

WORKDIR /src

COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci

COPY web ./web
COPY internal/web ./internal/web

ARG VITE_ASSET_BASE_URL=https://r2.fenturun2026.com/assets
ARG VITE_ASSET_VERSION=11
ENV VITE_ASSET_BASE_URL=${VITE_ASSET_BASE_URL}
ENV VITE_ASSET_VERSION=${VITE_ASSET_VERSION}

RUN cd web && npm run build

FROM golang:1.24-alpine AS backend

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=frontend /src/internal/web/dist ./internal/web/dist

RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/scanner \
    ./cmd/scanner

FROM alpine:3.22

RUN apk add --no-cache ca-certificates \
    && addgroup -S scanner \
    && adduser -S -G scanner scanner

COPY --from=backend /out/scanner /scanner

USER scanner
EXPOSE 8080

ENTRYPOINT ["/scanner"]
