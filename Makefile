# Copyright 2024 Eryx <evorui at gmail dot com>, All rights reserved.
#


BUILDCOLOR="\033[34;1m"
BINCOLOR="\033[37;1m"
ENDCOLOR="\033[0m"

PROTOC_CMD = protoc
# PROTOC_UI_ARGS = --proto_path=./api -I /opt/workspace/src/github.com/lynkdb/lynkapi/api --go_out=./go/lynkui --go-grpc_out=./go/lynkui ./api/lynkui/*.proto
PROTOC_UI_ARGS = --proto_path=./api -I /opt/workspace/src/github.com/lynkdb/lynkapi/api --go_out=paths=source_relative:./go --go-grpc_out=paths=source_relative:./go ./api/lynkui/*.proto

LYNKX_FITTER_CMD = lynkx-fitter
LYNKX_FITTER_ARGS = go/lynkui

BINDATA_CMD = httpsrv-bindata
BINDATA_ARGS_UI = -src assets -dst internal/bindata/assets -inc js,css,html

ifndef V
	QUIET_BUILD = @printf '%b %b\n' $(BUILDCOLOR)BUILD$(ENDCOLOR) $(BINCOLOR)$@$(ENDCOLOR) 1>&2;
	QUIET_INSTALL = @printf '%b %b\n' $(BUILDCOLOR)INSTALL$(ENDCOLOR) $(BINCOLOR)$@$(ENDCOLOR) 1>&2;
endif

# npm install -g sass
CSS_BUILD_CMD = sass
CSS_BUILD_ARGS = --no-source-map assets/lynkui/scss/main.scss:assets/lynkui/main.css

.PHONY: api

all: build_main
	@echo ""
	@echo "build complete"
	@echo ""

build_main:
	$(QUIET_BUILD)$(CSS_BUILD_CMD) $(CSS_BUILD_ARGS) $(CCLINK)

build_bindata:
	$(QUIET_BUILD)$(BINDATA_CMD) $(BINDATA_ARGS_UI) $(CCLINK)

clean:
	@echo ""
	@echo "clean complete"
	@echo ""
	rm -f internal/bindata/assets/statik.go

api:
	$(QUIET_BUILD)$(PROTOC_CMD) $(PROTOC_UI_ARGS) $(CCLINK)
	$(LYNKX_FITTER_CMD) $(LYNKX_FITTER_ARGS)

