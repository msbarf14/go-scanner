.PHONY: test run tidy dev build frontend

run: build
	./bin/scanner

dev:
	cd web && npm run dev & go run ./cmd/scanner

test:
	go test ./...

tidy:
	go mod tidy

frontend:
	cd web && npm install && npm run build

build: frontend
	go build -o bin/scanner ./cmd/scanner