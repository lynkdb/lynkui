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

package websrv

import (
	"github.com/hooto/httpsrv"

	"github.com/lynkdb/lynkui/go/lynkui"
	"github.com/lynkdb/lynkui/internal/bindata"
)

func Setup(s *httpsrv.Service, cfg *lynkui.ServiceConfig) error {

	{
		mod := httpsrv.NewModule()

		mod.RegisterController(new(Index))

		if cfg.RunMode != "dev" {
			if nfs := bindata.NewFs("assets"); nfs != nil {
				mod.RegisterFileServer("/~", "", nfs)
			}
		} else {
			if cfg.AssetsPath != "" {
				mod.RegisterFileServer("/~", cfg.AssetsPath, nil)
			}
		}

		s.HandleModule(cfg.UrlEntryPath, mod)
	}

	{
		mod := httpsrv.NewModule()

		mod.RegisterController(new(Pagelet), new(Datalet))

		s.HandleModule(cfg.UrlEntryPath+"/api/v1", mod)
	}

	return nil
}

type Index struct {
	*httpsrv.Controller
}

func (c Index) IndexAction() {

	c.AutoRender = false
	c.Response.Out.Header().Set("Cache-Control", "no-cache")

	c.RenderHTML(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>lynkui</title>
  <script src="{{.URL_MOD_PATH}}/~/lynkui/main.js"></script>
  <script type="text/javascript">
    lynkui.basepath = "{{.URL_MOD_PATH}}";
    lynkui.uipath = "~";
    window.onload = lynkui.main();
  </script>
</head>
<body id="lynkui-body-content">loading</body>
</html>
`)
}
