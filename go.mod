module github.com/lynkdb/lynkui

go 1.22.7

toolchain go1.23.2

// replace github.com/lynkdb/lynkapi v0.0.1 => /opt/workspace/src/github.com/lynkdb/lynkapi

require (
	github.com/fsnotify/fsnotify v1.8.0
	github.com/hooto/hlog4g v0.9.4
	github.com/hooto/httpsrv v0.12.5
	github.com/lynkdb/lynkapi v0.0.6
	github.com/rakyll/statik v0.1.7
	google.golang.org/protobuf v1.36.0
)

require (
	github.com/andybalholm/brotli v1.1.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/hooto/hauth v0.1.2 // indirect
	github.com/hooto/hflag4g v0.10.1 // indirect
	github.com/hooto/htoml4g v0.9.5 // indirect
	github.com/tidwall/pretty v1.2.1 // indirect
	golang.org/x/net v0.33.0 // indirect
	golang.org/x/sys v0.28.0 // indirect
	golang.org/x/text v0.21.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20241219192143-6b3ec007d9bb // indirect
	google.golang.org/grpc v1.69.2 // indirect
)
