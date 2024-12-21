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

package main

import (
	"encoding/json"
	"io/fs"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/hooto/hlog4g/hlog"
	"github.com/hooto/httpsrv"

	"github.com/lynkdb/lynkapi/go/lynkapi"
	"github.com/lynkdb/lynkapi/go/oneobject"

	"github.com/lynkdb/lynkui/internal/data"
	"github.com/lynkdb/lynkui/internal/status"
	"github.com/lynkdb/lynkui/internal/websrv"

	"github.com/lynkdb/lynkui/go/lynkui"
)

var (
	projectPath   = "./project/"
	projFileRx    = regexp.MustCompile(`project\.json$`)
	tplHtmlRx     = regexp.MustCompile(`template\/(.*)(\.html)$`)
	pageletFileRx = regexp.MustCompile(`pagelet\/(.*)(\.json)$`)

	stdPath       = "./tpl/"
	stdTemplateRx = regexp.MustCompile(`(.*)(\.html)$`)
	err           error
)

func templateRefresh() error {

	if projectPath, err = filepath.Abs(projectPath); err != nil {
		return err
	}

	if stdPath, err = filepath.Abs(stdPath); err != nil {
		return err
	}

	load := func(path string) error {

		var (
			obj     interface{}
			relpath = path[len(projectPath)+1:]
		)

		// hlog.Printf("info", "asset %s", relpath)
		switch {
		case projFileRx.MatchString(path):
			var item lynkui.Project
			if b, err := ioutil.ReadFile(path); err != nil {
				return err
			} else if err = json.Unmarshal(b, &item); err == nil {
				hlog.Printf("info", "asset %s, kind %s, name %v",
					relpath, item.Kind, item.Name)
				obj = item
			} else {
				hlog.Printf("warn", "asset %s, err %s", relpath, err.Error())
			}

		case pageletFileRx.MatchString(relpath):
			var item lynkui.Pagelet
			if b, err := os.ReadFile(path); err != nil {
				return err
			} else if err = json.Unmarshal(b, &item); err == nil {
				hlog.Printf("info", "asset %s, kind %s, name %v",
					relpath, item.Kind, item.Name)
				status.Assets.SetPagelet(item.Name, &item)
				obj = item
			} else {
				hlog.Printf("warn", "asset %s, err %s", relpath, err.Error())
			}

		case tplHtmlRx.MatchString(path):
			if b, err := ioutil.ReadFile(path); err != nil {
				return err
			} else {
				status.Assets.Sync(relpath, &lynkui.TemplateHtml{
					File: relpath,
					Html: string(b),
				})
				hlog.Printf("info", "asset %s", relpath)
			}

		default:
			return nil
		}

		if obj != nil {
			js, _ := json.MarshalIndent(obj, "", "  ")
			if err := ioutil.WriteFile(path, js, 0640); err == nil {
				hlog.Printf("warn", "asset %s, flush ok", relpath)
			} else {
				hlog.Printf("warn", "asset %s, flush fail %s", relpath, err.Error())
			}
		}

		return nil
	}

	{
		if err := data.Init(projectPath + "/data-layout.json"); err != nil {
			return err
		}

		type DataObjects struct {
			LynkDict []*lynkapi.DataDict `json:"lynk_dict,omitempty"`
		}
		var do DataObjects

		inst, err := oneobject.NewInstanceFromFile("index", projectPath+"/data-objects.json", &do)
		if err != nil {
			return err
		}

		inst.TableSetup("lynk_dict")

		for _, row := range []map[string]interface{}{
			{
				"ns":           "index",
				"name":         "topnav",
				"display_name": "TopNav Menu",
			},
			{
				"ns":           "index",
				"name":         "policynav",
				"display_name": "Policy Menu",
			},
			//
			{
				"ns":           "policynav",
				"name":         "policy-allow",
				"display_name": "Allow",
				"ext_fields": map[string]interface{}{
					"pagelet":        "nav-policy-list",
					"default_select": "y",
				},
			},
			{
				"ns":           "policynav",
				"name":         "policy-deny",
				"display_name": "Deny",
			},
			{
				"ns":           "policynav",
				"name":         "policy-item-hit",
				"display_name": "Item Hit",
			},
			{
				"ns":           "policynav",
				"name":         "policy-list-hit",
				"display_name": "List Hit",
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
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	defer watcher.Close()

	if err = filepath.Walk(projectPath, func(path string, info fs.FileInfo, err error) error {
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

	stdLoad := func(path string) error {

		var (
			relpath = path[len(stdPath)+1:]
		)

		switch {

		case stdTemplateRx.MatchString(path):
			if b, err := ioutil.ReadFile(path); err != nil {
				return err
			} else {
				status.Assets.Sync(relpath, &lynkui.TemplateHtml{
					File: relpath,
					Html: string(b),
				})
				hlog.Printf("info", "asset %s", relpath)
			}
		}

		return nil
	}

	if err = filepath.Walk(stdPath, func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		return stdLoad(path)

	}); err != nil {
		return err
	}

	var (
		updates = map[string]int64{}
	)

	for {
		select {

		case event, ok := <-watcher.Events:

			// hlog.Printf("info", "fsnotify event hit %v, file %v", event.Op, event.Name)

			if !ok || (!pageletFileRx.MatchString(event.Name) &&
				!tplHtmlRx.MatchString(event.Name)) {
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
			if !ok {
				hlog.Printf("info", "fsnotify err %s", err.Error())
			}
		}
	}
}

func main() {

	httpsrv.DefaultService.Config.UrlBasePath = "/demo"
	httpsrv.DefaultService.Config.HttpPort = 8002

	httpsrv.DefaultService.HandleModule("/", websrv.NewModule())
	httpsrv.DefaultService.HandleModule("/api/v1", websrv.NewApiModule())

	hlog.Print("Running")
	go httpsrv.DefaultService.Start()

	if err := templateRefresh(); err != nil {
		panic(err)
	}
}
