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
	"strings"

	"github.com/hooto/hlog4g/hlog"
	"github.com/hooto/httpsrv"

	"github.com/lynkdb/lynkapi/go/lynkapi"

	"github.com/lynkdb/lynkui/internal/data"
	"github.com/lynkdb/lynkui/internal/status"
)

type Datalet struct {
	*httpsrv.Controller
}

func (c Datalet) RunAction() {
	c.AutoRender = false
	c.Response.Out.Header().Set("Cache-Control", "no-cache")

	var rsp lynkapi.DataResults
	defer c.RenderJson(&rsp)

	var (
		name = c.Params.Value("pagelet")
	)

	pl := status.Assets.Pagelet(name)
	if pl == nil {
		hlog.Printf("info", "pagelet fetch %s fail", name)
		return
	}
	if pl.Datalet == nil {
		hlog.Printf("info", "pagelet fetch %s fail", name)
		return
	}

	if pl.Datalet.Query == nil {
		pl.Datalet.Query = &lynkapi.DataQuery{}
	}

	if pl.Datalet.Filter != nil {
		pl.Datalet.Query.Filter = pl.Datalet.Filter
	} else if pv := c.Params.Value("query_filter"); pv != "" {
		if js := base64Decode(pv); js != "" {
			var queryFilter lynkapi.DataQuery_Filter
			if err := jsonDecode([]byte(js), &queryFilter); err == nil {
				pl.Datalet.Query.Filter = &queryFilter
			}
		}
	}

	pl.Datalet.Query.TableName = pl.Datalet.TableName

	rsp.Kind = "DataResults"

	switch {
	case pl.Datalet.Query != nil:

		if pl.Datalet.List != nil && pl.Datalet.List.Sort != nil {
			pl.Datalet.Query.Sort = pl.Datalet.List.Sort
		}

		hlog.Printf("info", "query %s", string(jsonEncode(pl.Datalet.Query)))
		ds, err := data.Layout.Query(pl.Datalet.Query)
		if err != nil {
			hlog.Printf("info", "fetch instance client fail %s", err.Error())
		} else {

			ds2 := &lynkapi.DataResult{
				Name:   name,
				Status: ds.Status,
			}

			if ds2.Status.OK() && len(ds.Rows) > 0 {
				ds2.Spec, ds2.Rows = ds.Spec, ds.Rows
			}

			rsp.Results = append(rsp.Results, ds2)
		}
	}
}

func (c Datalet) DictQueryAction() {
	c.AutoRender = false

	var rsp lynkapi.DataResults
	defer c.RenderJson(&rsp)

	var nsArr = strings.Split(c.Params.Value("namespaces"), ",")
	for _, ns := range nsArr {
		if !lynkapi.NamespaceIdentifier.MatchString(ns) {
			continue
		}
		req := &lynkapi.DataQuery{
			TableName: "lynk_dict",
			Filter: &lynkapi.DataQuery_Filter{
				Field: "ns",
				Value: lynkapi.NewStringValue(ns),
			},
			Limit: 10000,
		}
		ds, err := data.Layout.Query(req)
		if err != nil {
			hlog.Printf("info", "fetch instance client fail %s", err.Error())
		} else {

			ds2 := &lynkapi.DataResult{
				Name:   ns,
				Status: ds.Status,
			}

			if ds2.Status.OK() && len(ds.Rows) > 0 {
				ds2.Spec, ds2.Rows = ds.Spec, ds.Rows
			}

			rsp.Results = append(rsp.Results, ds2)
		}
	}
}

func (c Datalet) UpsertAction() {
	c.AutoRender = false
	c.Response.Out.Header().Set("Cache-Control", "no-cache")

	var (
		req lynkapi.DataInsert
		rsp lynkapi.DataResult
	)
	defer c.RenderJson(&rsp)

	if err := c.Request.JsonDecode(&req); err != nil {
		rsp.Status = lynkapi.NewServiceStatus(lynkapi.StatusCode_BadRequest, err.Error())
		return
	}

	rs, err := data.Layout.Upsert(&req)
	if err != nil {
		rsp.Status = lynkapi.ParseError(err)
	} else {
		rsp.Status, rsp.Spec, rsp.Rows = rs.Status, rs.Spec, rs.Rows
	}
}
