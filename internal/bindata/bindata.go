// Copyright 2024 Eryx <evorui at gmail dot com>, All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bindata

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/rakyll/statik/fs"

	_ "github.com/lynkdb/lynkui/internal/bindata/assets"
)

type FileSystem interface {
	http.FileSystem

	ReadFile(name string) ([]byte, error)

	WriteFile(name string, data []byte) error
}

type fileSystem struct {
	http.FileSystem
	mu         sync.RWMutex
	localFiles map[string]*httpFile
}

type httpFile struct {
	name    string
	data    []byte
	reader  *bytes.Reader
	updated time.Time
}

var (
	nsmu   sync.RWMutex
	nsfs   = map[string]FileSystem{}
	Assets FileSystem
)

func init() {
	Assets = NewFs("assets")
}

func NewFs(ns string) FileSystem {

	nsmu.Lock()
	defer nsmu.Unlock()

	nfs, ok := nsfs[ns]
	if ok {
		return nfs
	}

	binFs, err := fs.NewWithNamespace(ns)
	if err != nil || binFs == nil {
		return nil
	}

	nfs = &fileSystem{
		FileSystem: binFs,
		localFiles: map[string]*httpFile{},
	}
	nsfs[ns] = nfs

	return nfs
}

func (it *fileSystem) Open(name string) (http.File, error) {
	it.mu.RLock()
	defer it.mu.RUnlock()

	if f, ok := it.localFiles[name]; ok {
		return f, nil
	}

	if it.FileSystem != nil {
		return it.FileSystem.Open(name)
	}

	return nil, os.ErrNotExist
}

func (it *fileSystem) ReadFile(name string) ([]byte, error) {

	fp, err := it.Open(name)
	if err != nil {
		return nil, err
	}
	defer fp.Close()

	return ioutil.ReadAll(fp)
}

func (it *fileSystem) WriteFile(name string, data []byte) error {

	it.mu.Lock()
	defer it.mu.Unlock()

	name = filepath.Clean("/" + name)

	it.localFiles[name] = &httpFile{
		name:    name,
		data:    data,
		updated: time.Now(),
		reader:  bytes.NewReader(data),
	}

	return nil
}

func (it *httpFile) Name() string {
	return it.name
}

func (it *httpFile) Size() int64 {
	return int64(len(it.data))
}

func (it *httpFile) Mode() os.FileMode {
	return 0640
}

func (it *httpFile) ModTime() time.Time {
	return it.updated
}

func (it *httpFile) Sys() any {
	return nil
}

// Read reads bytes into p, returns the number of read bytes.
func (f *httpFile) Read(p []byte) (n int, err error) {
	if f.reader == nil {
		return 0, io.EOF
	}
	return f.reader.Read(p)
}

// Seek seeks to the offset.
func (f *httpFile) Seek(offset int64, whence int) (ret int64, err error) {
	return f.reader.Seek(offset, whence)
}

// Stat stats the file.
func (f *httpFile) Stat() (os.FileInfo, error) {
	return f, nil
}

// IsDir returns true if the file location represents a directory.
func (f *httpFile) IsDir() bool {
	return false
}

// Readdir returns an empty slice of files, directory
// listing is disabled.
func (f *httpFile) Readdir(count int) ([]os.FileInfo, error) {
	return nil, fmt.Errorf("failed to read directory: %q", f.Name())
}

func (f *httpFile) Close() error {
	return nil
}
