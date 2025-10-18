# Copyright 2024 Eryx <evorui at gmail dot com>, All rights reserved.
#


PROTOC_CMD = protoc
# PROTOC_UI_ARGS = --proto_path=./api -I /opt/workspace/src/github.com/lynkdb/lynkapi/api --go_out=./go/lynkui --go-grpc_out=./go/lynkui ./api/lynkui/*.proto
PROTOC_UI_ARGS = --proto_path=./api -I /opt/workspace/src/github.com/lynkdb/lynkapi/api --go_out=paths=source_relative:./go --go-grpc_out=paths=source_relative:./go ./api/lynkui/*.proto

LYNKX_FITTER_CMD = lynkx-fitter
LYNKX_FITTER_ARGS = go/lynkui

BINDATA_CMD = httpsrv-bindata
BINDATA_ARGS_UI = -src assets -dst internal/bindata/assets -inc js,css,html,woff,woff2,svg

# npm install -g sass
CSS_BUILD_CMD = sass
CSS_BUILD_ARGS = --no-source-map assets/lynkui/scss/main.scss:assets/lynkui/main.css

.PHONY: api

all: api build_main build_bindata
	@echo ""
	@echo "build complete"
	@echo ""

build_main:
	$(CSS_BUILD_CMD) $(CSS_BUILD_ARGS)

build_bindata:
	$(BINDATA_CMD) $(BINDATA_ARGS_UI)

clean:
	@echo ""
	@echo "clean complete"
	@echo ""
	rm -f internal/bindata/assets/statik.go

api:
	$(PROTOC_CMD) $(PROTOC_UI_ARGS)
	$(LYNKX_FITTER_CMD) $(LYNKX_FITTER_ARGS)

