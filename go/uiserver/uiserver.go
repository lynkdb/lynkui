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

package uiserver

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/hooto/hlog4g/hlog"
	"github.com/hooto/httpsrv"

	"github.com/lynkdb/lynkapi/go/codec"
	"github.com/lynkdb/lynkapi/go/lynkapi"
	"github.com/lynkdb/lynkapi/go/oneobject"

	"github.com/lynkdb/lynkui/internal/bindata"
	"github.com/lynkdb/lynkui/internal/data"
	"github.com/lynkdb/lynkui/internal/status"
	"github.com/lynkdb/lynkui/internal/websrv"

	"github.com/lynkdb/lynkui/go/lynkui"
)

type Service interface {
	MainDataService() lynkapi.DataService
	DataLayout() data.DataService

	AssetsHandler() http.Handler
}

type serviceImpl struct {
	cfg lynkui.ServiceConfig

	mainDataService lynkapi.DataService
}

var (
	appTemplateFileRx = regexp.MustCompile(`template\/(.*)(\.html)$`)
	appPageletFileRx  = regexp.MustCompile(`pagelet\/(.*)(\.json)$`)

	coreTemplateFileRx = regexp.MustCompile(`lynkui\/tpl\/(.*)(\.html)$`)

	service = &serviceImpl{}

	err error
)

func NewAssetsFs() http.FileSystem {
	return bindata.Assets
}

func NewService(s *httpsrv.Service, cfg *lynkui.ServiceConfig) (Service, error) {

	if cfg.UrlEntryPath == "" {
		cfg.UrlEntryPath = "/lynkui"
	}
	cfg.UrlEntryPath = filepath.Clean(cfg.UrlEntryPath)

	if cfg.AppProjectPath == "" {
		return nil, fmt.Errorf("app_project_path not setup")
	}

	projPath, err := filepath.Abs(cfg.AppProjectPath)
	if err != nil {
		return nil, err
	}

	cfg.AppProjectPath = filepath.Clean(projPath)
	hlog.Printf("info", "setup app project path : %s", cfg.AppProjectPath)
	if _, err := os.Stat(cfg.AppProjectPath); err != nil {
		return nil, err
	}

	if cfg.RunMode != "dev" {
		cfg.RunMode = "prod"
	}

	if cfg.RunMode == "dev" && cfg.AssetsPath == "" {
		cfg.AssetsPath = filepath.Clean(os.Getenv("GOPATH") + "/src/github.com/lynkdb/lynkui/assets")
	}
	if cfg.AssetsPath != "" {
		if _, err := os.Stat(cfg.AssetsPath); err != nil {
			return nil, err
		}
	}

	service.cfg = *cfg

	if err := service.init(); err != nil {
		return nil, err
	}

	// cjs, _ := json.Marshal(service.cfg)
	// fmt.Println(string(cjs))

	if err := service.appAssetsRefresh(); err != nil {
		return nil, err
	}

	if cfg.RunMode == "dev" {
		if err := service.coreAssetsRefresh(); err != nil {
			return nil, err
		}
	}

	if s != nil {
		if err := websrv.Setup(s, cfg); err != nil {
			return nil, err
		}
	}

	return service, nil
}

func (it *serviceImpl) ServeHTTP(wr http.ResponseWriter, req *http.Request) {
	relpath := filepath.Clean(req.URL.Path)
	if strings.HasPrefix(relpath, "/lynkui/template/") {

		if tpl := status.Assets.Get(relpath[len("/lynkui/"):]); tpl != nil {
			if h, ok := tpl.(*lynkui.TemplateHtml); ok {
				js, _ := json.Marshal(h)
				wr.Header().Set("Content-Type", "application/json")
				wr.Write(js)
				return
			}
		}
	}
	http.NotFound(wr, req)
}

func (it *serviceImpl) AssetsHandler() http.Handler {
	return it
}

func (it *serviceImpl) MainDataService() lynkapi.DataService {
	return it.mainDataService
}

func (it *serviceImpl) DataLayout() data.DataService {
	return data.Layout
}

func (it *serviceImpl) init() error {

	if err := data.Init(it.cfg.AppProjectPath + "/lynkui_layout.json"); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var do lynkui.MainObjectSet

	inst, err := oneobject.NewInstanceFromFile("lynkui", it.cfg.AppProjectPath+"/lynkui_data.json", &do)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	it.mainDataService = inst

	inst.TableSetup("lynk_dict")

	for _, row := range []map[string]interface{}{
		{
			"ns":           "index",
			"name":         "topnav",
			"display_name": "TopNav Menu",
		},
	} {
		igsert := &lynkapi.DataInsert{
			TableName: "lynk_dict",
		}
		for k, v := range row {
			igsert.SetField(k, v)
		}
		if _, err = inst.Igsert(igsert); err != nil {
			hlog.Printf("warn", "igsert fail %s", err.Error())
		}
	}

	inst.Flush()

	if err = data.Layout.RegisterService(inst); err != nil {
		return err
	}

	return nil
}

func (it *serviceImpl) coreAssetsRefresh() error {

	if it.cfg.RunMode != "dev" || it.cfg.AssetsPath == "" {
		return nil
	}

	asfs := bindata.NewFs("assets")
	if asfs == nil {
		return nil
	}

	load := func(path string) error {

		var (
			relpath = path[len(it.cfg.AssetsPath)+1:]
		)

		if relpath != "lynkui/main.js" &&
			relpath != "lynkui/main.css" &&
			relpath != "lynkui/main-v2.css" &&
			!coreTemplateFileRx.MatchString(path) {
			return nil
		}

		b, err := ioutil.ReadFile(path)
		if err != nil {
			return err
		}
		asfs.WriteFile(relpath, b)

		status.Assets.Sync(relpath, &lynkui.TemplateHtml{
			File: relpath,
			Html: string(b),
		})
		hlog.Printf("info", "asset %s", relpath)

		return nil
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	if err = filepath.Walk(it.cfg.AssetsPath, func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			hlog.Printf("info", "watch %s", path)
			return watcher.Add(path)
		}
		return load(path)
	}); err != nil {
		return err
	}

	go func() {
		defer watcher.Close()

		var (
			updates = map[string]int64{}
		)

		for {
			select {

			case event, ok := <-watcher.Events:

				// hlog.Printf("info", "fsnotify event hit %v, file %v", uint32(event.Op), event.Name)

				if !ok ||
					!coreTemplateFileRx.MatchString(event.Name) {
					continue
				}

				if (event.Op&fsnotify.Create) == fsnotify.Create ||
					(event.Op&fsnotify.Write) == fsnotify.Write ||
					(event.Op&fsnotify.Remove) == fsnotify.Remove {

					tn := time.Now().UnixNano() / 1e6
					if (tn - updates[event.Name]) < 1e3 {
						continue
					}
					updates[event.Name] = tn

					time.Sleep(100e6)
					hlog.Printf("info", "fsnotify event %v, file %v", event.Op, event.Name)

					load(event.Name)
				}

			case err, ok := <-watcher.Errors:
				if !ok && err != nil {
					hlog.Printf("info", "fsnotify err %s", err.Error())
				}
			}
		}
	}()

	return nil
}

func (it *serviceImpl) appAssetsRefresh() error {

	load := func(path string) error {

		var (
			obj     interface{}
			relpath = path[len(it.cfg.AppProjectPath)+1:]
		)

		switch {

		case appPageletFileRx.MatchString(relpath):
			var item lynkui.Pagelet
			b, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			if err = json.Unmarshal(b, &item); err == nil {
				if mat := appPageletFileRx.FindStringSubmatch(relpath); len(mat) == 3 {
					hlog.Printf("info", "asset %s, name %v", relpath, mat[1])
					item.Name = mat[1]
					status.Assets.SetPagelet(mat[1], &item)
					obj = item
				}

			} else {
				hlog.Printf("warn", "asset %s, err %s", relpath, err.Error())
			}

		case appTemplateFileRx.MatchString(path):
			b, err := ioutil.ReadFile(path)
			if err != nil {
				return err
			}
			status.Assets.Sync(relpath, &lynkui.TemplateHtml{
				File: relpath,
				Html: string(b),
			})
			hlog.Printf("info", "asset %s", relpath)

		default:
			return nil
		}

		if obj != nil {
			js, _ := codec.Json.Encode(obj, &codec.JsonOptions{
				Width: 120,
			})
			if err := ioutil.WriteFile(path, js, 0640); err == nil {
				hlog.Printf("warn", "asset %s, flush ok", relpath)
			} else {
				hlog.Printf("warn", "asset %s, flush fail %s", relpath, err.Error())
			}
		}

		return nil
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	if err = filepath.Walk(it.cfg.AppProjectPath, func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			hlog.Printf("info", "watch %s", path)
			return watcher.Add(path)
		}
		return load(path)
	}); err != nil {
		return err
	}

	go func() {
		defer watcher.Close()

		var (
			updates = map[string]int64{}
		)

		for {
			select {

			case event, ok := <-watcher.Events:

				// hlog.Printf("info", "fsnotify event hit %v, file %v", event.Op, event.Name)

				if !ok || (!appPageletFileRx.MatchString(event.Name) &&
					!appTemplateFileRx.MatchString(event.Name)) {
					continue
				}

				if (event.Op&fsnotify.Create) == fsnotify.Create ||
					(event.Op&fsnotify.Write) == fsnotify.Write ||
					// (event.Op&fsnotify.Rename) == fsnotify.Rename ||
					(event.Op&fsnotify.Remove) == fsnotify.Remove {

					tn := time.Now().UnixNano() / 1e6
					if (tn - updates[event.Name]) < 1e3 {
						continue
					}
					updates[event.Name] = tn

					time.Sleep(100e6)
					hlog.Printf("info", "fsnotify event %v, file %v", event.Op, event.Name)

					load(event.Name)
				}

			case err, ok := <-watcher.Errors:
				if !ok && err != nil {
					hlog.Printf("info", "fsnotify err %s", err.Error())
				}
			}
		}
	}()

	return nil
}
