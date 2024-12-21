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
	"fmt"
	"strconv"
	"strings"

	"github.com/hooto/hlog4g/hlog"
	"github.com/hooto/httpsrv"

	"github.com/lynkdb/lynkui/go/lynkui"

	"github.com/lynkdb/lynkui/internal/bindata"
	"github.com/lynkdb/lynkui/internal/data"
	"github.com/lynkdb/lynkui/internal/status"
)

type Pagelet struct {
	*httpsrv.Controller
}

func (c Pagelet) FetchAction() {
	c.AutoRender = false
	c.Response.Out.Header().Set("Cache-Control", "no-cache")

	name := c.Params.Value("name")

	pl := status.Assets.Pagelet(name)
	if pl == nil {
		hlog.Printf("info", "pagelet (%s) fetch fail : object type error", name)
		return
	}
	// jsonPrint(pl)

	if pl.Datalet != nil && pl.Datalet.TableName != "" {
		if spec := data.Layout.TableSpec(pl.Datalet.TableName); spec != nil {
			pl.Datalet.TableSpec = spec
		}
	}

	if err := pageletPreRender(name, pl); err != nil {
		hlog.Printf("info", "pagelet (%s) pre-render err %s", name, err.Error())
		return
	}

	c.RenderJson(pl)
}

func pageletPreRender(plName string, item *lynkui.Pagelet) error {
	if item.Template == nil {
		return nil
	}

	attrExport := func(m map[string]string) string {
		str := ""
		for name, value := range m {
			str += fmt.Sprintf(" %s=\"%s\"", name, value)
		}
		return str
	}

	switch {

	case item.Template.Layout != nil:
		item.Template.Layout.Refix()
		str := fmt.Sprintf("<!-- pagelet:%s:tpl:layout -->\n", plName)
		str += fmt.Sprintf("<div class=\"container-fluid _lynkui-container\">\n")
		str += fmt.Sprintf("<div class=\"row _lynkui-row%s\"%s>\n",
			colUnitFilter("lynkui-row-", item.Template.Layout.Width),
			colCssFilter(item.Template.Layout))
		for _, v := range item.Template.Layout.Cols {
			str += fmt.Sprintf("  <div id=\"lynkui-%s\" class=\"_lynkui-col%s%s\"%s>%s</div>\n",
				v.Name, colUnitFilter("lynkui-col-", v.Width), colClassFilter(v), colCssFilter(v), v.Name)
		}
		str += "</div>\n"
		str += "</div>\n"
		item.Template.Html = &lynkui.TemplateHtml{
			Html: str,
		}

	case item.Template.Nav != nil:

		navAttr := map[string]string{
			"id":    "nav-{[=it.name]}",
			"class": fmt.Sprintf("nav lynkui-nav lynkui-gap-box%s", navClassFilter(item.Template.Nav)),
		}

		liAttr := map[string]string{
			"id":        "nav-item-{[=row.fields.id]}",
			"class":     "nav-item lynkui-nav-item",
			"x_pagelet": plName,
			"x_dict":    "{[=row.x_dict]}",
		}

		aAttr := map[string]string{
			"id":    "nav-link-{[=it.name]}-{[=row.fields.id]}",
			"class": "nav-link lynkui-nav-link",
			"href":  "#{[=row.fields.name]}",
		}

		str := fmt.Sprintf("<!-- pagelet:%s:tpl:nav -->\n", plName)

		str += "<nav" + attrExport(navAttr) + ">\n" +
			"{[~it.rows :row]}\n" +
			"<li" + attrExport(liAttr) + ">\n" +
			"  <a" + attrExport(aAttr) + ">{[=row.fields.display_name]}</a>\n" +
			"</li>\n" +
			"{[~]}\n" +
			"</nav>\n"

		item.Template.Html = &lynkui.TemplateHtml{
			Html: str,
		}

	case item.Template.Html != nil && item.Template.Html.Html == "":
		if b, err := bindata.Assets.ReadFile("/lynkui/tpl/" + item.Template.Html.File); err == nil {
			item.Template.Html.Html = string(b)
		} else if tpl := status.Assets.Get("lynkui/tpl/" + item.Template.Html.File); tpl != nil {
			if h, ok := tpl.(*lynkui.TemplateHtml); ok {
				item.Template.Html.Html = h.Html
			}
		}
	}

	return nil
}

func navClassFilter(c *lynkui.TemplateNav) string {
	if c.Display == "flex-column" {
		return " " + c.Display
	}
	return ""
}

func colUnitFilter(prefix, v string) string {
	if v == "auto" {
		return " " + prefix + v
	}
	return ""
}

func colClassFilter(c *lynkui.TemplateLayout) string {

	var (
		as = ""
		ar = strings.Split(c.StyleClass, ",")
	)
	for _, v := range ar {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if as == "" {
			as += " "
		} else {
			as += ","
		}
		as += v
	}
	return as
}

func colCssFilter(c *lynkui.TemplateLayout) string {

	var (
		css = []string{}
		fun = map[string]bool{
			"calc": true,
			"min":  true,
			"max":  true,
		}
	)

	unitFilter := func(s string) []string {
		if strings.HasSuffix(s, ")") {
			if n := strings.Index(s, "("); n > 0 {
				if _, ok := fun[s[:n]]; ok {
					return []string{s}
				}
			}
			return []string{}
		}

		ar := []string{}
		for _, v := range strings.Split(s, ",") {
			switch {
			case strings.HasSuffix(v, "rem"):
				if v, err := strconv.ParseFloat(v[:len(v)-3], 32); err == nil {
					ar = append(ar, fmt.Sprintf("%drem", int(v)))
				}
			case strings.HasSuffix(v, "px"):
				if v, err := strconv.ParseFloat(v[:len(v)-2], 32); err == nil {
					ar = append(ar, fmt.Sprintf("%dpx", int(v)))
				}
			case strings.HasSuffix(v, "vw"):
				if v, err := strconv.ParseFloat(v[:len(v)-2], 32); err == nil {
					ar = append(ar, fmt.Sprintf("%dvw", int(v)))
				}
			case strings.HasSuffix(v, "vh"):
				if v, err := strconv.ParseFloat(v[:len(v)-2], 32); err == nil {
					ar = append(ar, fmt.Sprintf("%dvh", int(v)))
				}
			case strings.HasSuffix(v, "%"):
				if v, err := strconv.ParseFloat(v[:len(v)-1], 32); err == nil {
					ar = append(ar, fmt.Sprintf("%d%%", int(v)))
				}
			}
		}
		return ar
	}

	for _, n := range [][]string{
		{"width", c.Width},
		{"height", c.Height},
	} {
		ar := unitFilter(n[1])
		switch len(ar) {
		case 1:
			css = append(css,
				fmt.Sprintf("%s:%s", n[0], ar[0]))
		case 2:
			css = append(css,
				fmt.Sprintf("min-%s:%s", n[0], ar[0]),
				fmt.Sprintf("max-%s:%s", n[0], ar[1]))
		case 3:
			css = append(css,
				fmt.Sprintf("min-%s:%s", n[0], ar[0]),
				fmt.Sprintf("%s:%s", n[0], ar[1]),
				fmt.Sprintf("max-%s:%s", n[0], ar[2]))
		}
	}
	if len(css) == 0 {
		return ""
	}

	return " style=\"" + strings.Join(css, ";") + ";\""
}
