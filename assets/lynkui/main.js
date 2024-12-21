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

/**
 * lynkui | https://github.com/lynkdb/lynkui
 */
(function (global, undefined) {
    "use strict";

	if (!global) {
		global = window;
	}
    if (global && global.lynkui) {
        return;
    }

    var lynkui = (global.lynkui = {
        version: "0.0.2",
        basepath: "/",
        uipath: "~/lynkui",
        inited: false,
        tasklet: {},
        pagelet: {
            set: {},
        },
        datalet_data_set: {},
        cookie: {},
        session: {},
        storage: {},
        layout: {},
        url: {
            evs: {},
            evc: null,
        },
        lang: {
            data: {
                locale: "en",
                items: {},
            },
        },
        template: {
            datasets: {},
        },
        alert: {
            modal_instance: null,
        },
        modal: {
            version: "2.0",
            current: null,
            CurOptions: null,
            nextHistory: null,
            width: 600,
            height: 400,
            position: "center",
            data: {},
        },
        utilx: {},
        sessionData: {},
        job: {
            ticker: false,
            items: {},
        },
    });

    var _modal = lynkui.modal;
    var _alert = lynkui.alert;
    var pagelet = lynkui.pagelet;

    var init = function (cb) {
        if (lynkui.inited) {
            if (typeof cb === "function") {
                cb();
            }
            return;
        }
        seajs.config({
            base: lynkui.basepath,
            alias: {},
        });
        lynkui.inited = true;

        var mods = [
            lynkui.uipath + "/zepto/zepto.js",
            lynkui.uipath + "/bs/js/bootstrap.js",
            lynkui.uipath + "/bs/css/bootstrap.css",
            lynkui.uipath + "/lynkui/main.css",
            lynkui.uipath + "/lynkui/main-v2.css",
        ];

        seajs.use(mods, function () {
            $(document).keyup(function (e) {
                if (e.key === "Escape") {
                    if (_modal.current) {
                        var pid = _modal.prevId();
                        if (pid) {
                            _modal.prev();
                        } else {
                            _modal.close();
                        }
                    }
                }
            });

            if (typeof cb === "function") {
                cb();
            }
        });
    };

    lynkui.use = function () {
        var args = arguments,
            mods = [],
            cb = null;

        for (var i in args) {
            if (typeof args[i] === "object" && Array.isArray(args[i])) {
                for (var j in args[i]) {
                    if (typeof args[i][j] === "string") {
                        mods.push(args[i][j]);
                    }
                }
            } else if (typeof args[i] === "string") {
                mods.push(args[i]);
            } else if (typeof args[i] === "function") {
                cb = args[i];
            }
        }

        if (lynkui.app_version) {
            for (var i in mods) {
                if (/\?/.test(mods[i])) {
                    mods[i] += "&_=" + lynkui.app_version;
                } else {
                    mods[i] += "?_=" + lynkui.app_version;
                }
            }
        }

        init(function () {
            seajs.use(mods, cb);
        });
    };

    lynkui.main = function () {
        lynkui.use(function () {
            //
            $(document).on("click", ".lynkui-nav-item", function () {
                lynkui.pagelet.onclick($(this));
            });
            //
            $(document).on("click", ".lynkui-data-row-update", function () {
                lynkui.pagelet.dataRowUpdate($(this));
            });
            //
            $(document).on("click", ".lynkui-data-row-insert", function () {
                lynkui.pagelet.dataRowInsert($(this));
            });

            //
            lynkui.pagelet.run({
                name: "index",
            });
        });
    };

    lynkui.newEventProxy = function () {
        var args = arguments,
            ep = EventProxy.create();
        if (args.length > 0) {
            ep.assign.apply(ep, args);
        }
        return ep;
    };

    var tasklet = lynkui.tasklet;

    tasklet.run = function (vl, data) {
        if (!vl.post_tasklets || vl.post_tasklets.length == 0) {
            return;
        }
        for (var i in vl.post_tasklets) {
            if (vl.post_tasklets[i].nav_click) {
                tasklet.navClick(vl, vl.post_tasklets[i], data);
            }
        }
    };

    tasklet.navClick = function (vl, task, data) {
        if (!data || !data.rows || data.rows.length < 1) {
            return;
        }
        var defaultSelect = null;
        for (var i in data.rows) {
            if (
                data.rows[i].fields.ext_fields &&
                data.rows[i].fields.ext_fields.default_select &&
                data.rows[i].fields.ext_fields.default_select == "y"
            ) {
                defaultSelect = data.rows[i];
                break;
            }
        }
        if (!defaultSelect || !defaultSelect.fields.ext_fields.pagelet) {
            console.log(defaultSelect);
            return;
        }

        if (!defaultSelect.x_dict || defaultSelect.x_dict.length < 2) {
            return;
        }

        var dict = lynkui.utilx.object64Decode(defaultSelect.x_dict);
        if (!dict) {
            return;
        }

        var query_filter = {
            field: "dict_id",
            value: dict.id,
        };

        $("#nav-" + vl.name)
            .find("li.active")
            .removeClass("active");
        $("#nav-item-" + dict.id).addClass("active");

        lynkui.pagelet.run({
            name: defaultSelect.fields.ext_fields.pagelet,
            query_filter: query_filter,
        });
    };

    pagelet.run = function (vl) {
        if (!vl || !vl.name) {
            return;
        }
        var url = lynkui.basepath + "/api/v1/pagelet/fetch?name=" + vl.name;

        var ep = lynkui.newEventProxy("data", function (data) {
            var msg = lynkui.utilx.kindCheck(data, "Pagelet");
            if (msg) {
                return _alert.open("error", msg);
            }

            if (!data.template || !data.template.html) {
                return lynkui.alert.open("error", "no template found");
            }
            pagelet.set[vl.name] = lynkui.utilx.objectClone(data);

            if (data.datalet) {
                if (
                    data.datalet.filter &&
                    vl.query_filter &&
                    data.datalet.filter.field == vl.query_filter.field
                ) {
                    data.datalet.query_filter = vl.query_filter;
                }
            }
            pagelet.apply(data);
        });

        ep.fail(function (err) {
            lynkui.alert.open("error", "network error " + err);
        });

        lynkui.utilx.ajax(url, {
            callback: ep.done("data"),
        });
    };

    pagelet.apply = function (vl) {
        //
        if (vl.output && vl.template && vl.template.html) {
            //
            if (!vl.datalet || !vl.datalet.table_name) {
                return lynkui.template.render({
                    tplsrc: vl.template.html.html,
                    dstid: "lynkui-" + vl.output,
                    callback: function () {
                        pagelet.next(vl.next_pagelets);
                    },
                });
            }

            pagelet.datalet(vl, function (err, data) {
                if (err) {
                    console.log(err);
                    return;
                }
                let box = {
                    title: vl.name,
                    toolbar: {},
                    opts: {
                        update_enable: false,
                    },
                };
                if (vl.display_name) {
                    box.title = vl.display_name;
                }
                if (vl.exp_data_update_enable === true) {
                    box.opts.update_enable = true;
                }
                if (vl.exp_data_create_enable) {
                    let x_data = {
                        pagelet: vl.name,
                    };
                    if (vl.datalet && vl.datalet.query_filter) {
                        x_data.query_filter = vl.datalet.query_filter;
                    }
                    // console.log(x_data);
                    box.toolbar.row_insert_x_data = lynkui.utilx.object64Encode(x_data);
                }

                if (!data.rows) {
                    data.rows = [];
                }

                data._display_fields = [];
                if (data.rows.length > 0) {
                    if (
                        vl.datalet.list &&
                        vl.datalet.list.display_fields &&
                        vl.datalet.list.display_fields.length > 0
                    ) {
                        for (var i in data.spec.fields) {
                            var field = data.spec.fields[i];
                            field._style_class = "cw";
                            if (field.styles) {
                                if (field.styles.list_width) {
                                    field._style_class = field.styles.list_width;
                                }
                            }
                            if (vl.datalet.list.display_fields.includes(field.tag_name)) {
                                data._display_fields.push(field);
                            }
                        }
                    } else {
                        data._display_fields = data.spec.fields;
                    }
                }

                // console.log(data);

                data.box = box;

                lynkui.template.render({
                    tplsrc: vl.template.html.html,
                    dstid: "lynkui-" + vl.output,
                    data: data,
                    callback: function () {
                        tasklet.run(vl, data);
                    },
                });
            });
        } else {
            pagelet.next(vl.next_pagelets);
        }
    };

    pagelet.applyRefresh = function (pagelet_name) {
        let vl = pagelet.set[pagelet_name];
        if (!vl) {
            return;
        }
        pagelet.apply(vl);
    };

    pagelet.next = function (vls) {
        if (!vls || vls.length == 0) {
            return;
        }
        for (var i in vls) {
            var vl = vls[i];
            if (!vl.name) {
                continue;
            }
            pagelet.run(vl);
        }
    };

    pagelet.onclick = function (elem) {
        if (!elem) {
            return;
        }
        var x_pagelet = elem.attr("x_pagelet");
        if (!x_pagelet) {
            return;
        }
        var vl = pagelet.set[x_pagelet];
		console.log("click pagelet ", vl)
        if (!vl || !vl.datalet || !vl.event || vl.event.name != "onclick") {
            return;
        }
        var pl_next = pagelet.set[vl.event.pagelet];
        if (!pl_next || !pl_next.datalet) {
            console.log("next skip "+ vl.event.pagelet);
            return;
        }
        pl_next = lynkui.utilx.objectClone(pl_next);

        var dict = lynkui.utilx.object64Decode(elem.attr("x_dict"));
        if (!dict || !dict.id) {
            return;
        }

        var query_filter = {
            field: "dict_id",
            value: dict.id,
        };

        $("#nav-" + x_pagelet)
            .find("li.active")
            .removeClass("active");
        $("#nav-item-" + dict.id).addClass("active");

        pl_next.datalet.query_filter = query_filter;

        pagelet.apply(pl_next, []);
    };

    pagelet._dataResultConvert = function (vl, data) {
        if (!vl || !vl.datalet || !data.rows || !data.spec || !data.spec.fields) {
            return {};
        }
        var sets = {
            name: data.name,
            spec: {
                fields: data.spec.fields,
            },
            rows: [],
        };

        for (var i in data.rows) {
            var row = data.rows[i];

            var _row = {
                // x_dict: "",
                // x_data: "",
                id: row.id,
                fields: {},
            };

            if (!row.fields && row.values && data.spec.fields.length == row.values.length) {
                for (var j in data.spec.fields) {
                    _row.fields[data.spec.fields[j].name] = row.values[j];
                }
            } else if (row.fields) {
                _row.fields = row.fields;
            }

            if (data.spec.kind == "github.com/lynkdb/lynkapi/go/lynkapi.DataDict") {
                _row.x_dict = lynkui.utilx.object64Encode({
                    id: _row.fields.id,
                    ns: _row.fields.ns,
                    name: _row.fields.name,
                    // display_name: _row.fields.display_name,
                });
                // console.log(_row.fields);
            } else {
                _row.x_data = lynkui.utilx.object64Encode({
                    pagelet: vl.name,
                    query_filter: vl.datalet.query_filter,
                    id: row.id,
                });
                // console.log(row);
            }

            sets.rows.push(_row);
        }
        return sets;
    };

    pagelet.rowFieldValue = function (spec, row, name) {
        if (
            !spec ||
            !spec.fields ||
            spec.fields.length == 0 ||
            !row ||
            (!row.fields && !row.values) ||
            !name
        ) {
            return "";
        }
        let format = function (field, value) {
            if (field.styles) {
                if (field.styles.text_type == "md") {
                    return valueui.utils.sprintf("<pre>%s</pre>", value);
                }
                if (field.styles.unit) {
                    switch (field.styles.unit) {
                        case "unix-seconds":
                            return lynkui.utilx.unixTimeFormat(value, "Y-m-d H:i:s");

                        case "unix-milliseconds":
                            return lynkui.utilx.unixTimeFormat(value / 1e3, "Y-m-d H:i:s");

                        case "unix-microseconds":
                            return lynkui.utilx.unixTimeFormat(value / 1e6, "Y-m-d H:i:s");
                    }
                }
                if (field.styles.list_max_len && field.styles.list_max_len > 0) {
                    return lynkui.utilx.substr(value, field.styles.list_max_len);
                }
            }
            if (field.type == "string" && value) {
                return lynkui.utilx.substr(value, 512);
            }

            return value;
        };
        var field = null,
            field_index = -1;
        for (var i in spec.fields) {
            if (spec.fields[i].tag_name == name) {
                field = spec.fields[i];
                field_index = i;
                break;
            }
        }
        if (field) {
            if (row.fields && row.fields[name]) {
                return format(field, row.fields[name]);
            }
            if (row.values && row.values.length == spec.fields.length) {
                return format(field, row.values[field_index]);
            }
        }
        return "";
    };

    // data-result management
    pagelet.dataRowUpdate = function (elem) {
        if (!elem) {
            return;
        }

        var x_data = lynkui.utilx.object64Decode(elem.attr("x_data"));

        pagelet.dataRowUpsertForm(x_data, true);
    };

    pagelet.dataRowInsert = function (elem) {
        if (!elem) {
            return;
        }

        var x_data = lynkui.utilx.object64Decode(elem.attr("x_data"));

        return pagelet.dataRowUpsertForm(x_data, false);
    };

    pagelet.dataRowUpsertForm = function (x_data, is_update) {
        // console.log(x_data);
        if (!x_data || !x_data.pagelet) {
            return;
        }

        let pl = lynkui.pagelet.set[x_data.pagelet];
        if (!pl || !pl.datalet || !pl.datalet.table_name) {
            return;
        }

        var prev_fields = {},
            row_id = null;

        if (is_update) {
            if (!x_data.id) {
                return;
            }
            let ds = lynkui.datalet_data_set[x_data.pagelet];
            // console.log(ds);
            if (!ds) {
                return;
            }
            let row = null;
            for (var i in ds.rows) {
                if (ds.rows[i].id == x_data.id) {
                    row = ds.rows[i];
                    break;
                }
            }
            // console.log(row);
            if (!row) {
                return;
            }

            row_id = row.id;
            prev_fields = row.fields;
        }

        var query_filter = null;
        if (x_data.query_filter) {
            query_filter = x_data.query_filter;
        }

        var datalet = lynkui.utilx.objectClone(pl.datalet);

        let fields = [],
            ro_fields = {},
            dict_ns_dataset = {};
        for (var i in datalet.table_spec.fields) {
            var field = datalet.table_spec.fields[i];
            field._read_only = false;
            field._value = "";

            if (field.dict_ns && field.dict_ns.length > 0) {
                for (var j in field.dict_ns) {
                    dict_ns_dataset[field.dict_ns[j]] = field;
                }
            }

            if (prev_fields[field.tag_name]) {
                field._value = prev_fields[field.tag_name];
            }

            if (query_filter && query_filter.field == field.tag_name) {
                field._value = query_filter.value;
                field._read_only = true;
                ro_fields[field.tag_name] = field._value;
            } else if (
                lynkui.utilx.arrayObjectHas(field.attrs, "primary_key") ||
                lynkui.utilx.arrayObjectHas(field.attrs, "rand_hex") ||
                lynkui.utilx.arrayObjectHas(field.attrs, "object_id")
            ) {
                field._read_only = true;
                if (field._value != "") {
                    ro_fields[field.tag_name] = field._value;
                }
            }

            if (!field._read_only || is_update) {
                fields.push(field);
            }
        }

        lynkui.pagelet.dataRowUpsertCache = {
            id: row_id,
            spec: datalet,
            fields: fields,
            ro_fields: ro_fields,
            is_update: is_update,
            x_data: x_data,
        };
        // console.log(fields);
        // console.log(ro_fields);

        let title = "Data ";
        if (is_update) {
            title += "Update";
        } else {
            title += "Create";
        }

        var async_load_dict_list = function () {
            // return;
            var ns = Object.keys(dict_ns_dataset);
            if (ns.length == 0) {
                return;
            }
            let url = lynkui.basepath + "/api/v1/datalet/dict-query?namespaces=" + ns.join(",");

            lynkui.utilx.ajax(url, {
                callback: function (err, data) {
                    if (err || !data) {
                        return;
                    }
                    if (!data.results || data.results.length == 0) {
                        return;
                    }
                    for (var i in data.results) {
                        var dict_data = data.results[i];
                        var dict_field = dict_ns_dataset[dict_data.name];
                        if (!dict_field) {
                            continue;
                        }
                        // console.log(dict_data);
                        // console.log(dict_field);

                        var dict_id = prev_fields[dict_field.tag_name];
                        if (!dict_id) {
                            dict_id = "";
                        }

                        for (var j in dict_data.rows) {
                            var row = dict_data.rows[j];
                            if (row.id == dict_id) {
                                dict_data.rows[j]._selected = true;
                                break;
                            }
                        }

                        lynkui.template.render({
                            dstid: "data-row-upsert-field-form-" + dict_field.tag_name,
                            tplid: "data-row-upsert-field-select-tpl",
                            data: {
                                field: dict_field,
                                rows: dict_data.rows,
                            },
                        });
                    }
                },
            });
        };

        let tpluri =
            lynkui.basepath + "/" + lynkui.uipath + "/lynkui/tpl/core/v1/data-row-upsert-form.html";

        lynkui.modal.open({
            title: title,
            width: "max",
            height: "max",
            tpluri: tpluri,
            callback: function () {
                lynkui.template.render({
                    dstid: "data-row-upsert-field-list",
                    tplid: "data-row-upsert-field-list-tpl",
                    data: {
                        fields: fields,
                    },
                    callback: function (err) {
                        async_load_dict_list();
                    },
                });
            },
            buttons: [
                {
                    title: "Cancel",
                    style: "btn btn-dark",
                    onclick: "lynkui.modal.close()",
                },
                {
                    title: "Commit",
                    style: "btn btn-primary",
                    onclick: "lynkui.pagelet.dataRowUpsertCommit()",
                },
            ],
        });
    };

    pagelet.dataRowUpsertCommit = function () {
        if (!lynkui.pagelet.dataRowUpsertCache) {
            return;
        }

        let x_data = lynkui.pagelet.dataRowUpsertCache.x_data,
            spec = lynkui.pagelet.dataRowUpsertCache.spec,
            data_spec = lynkui.pagelet.dataRowUpsertCache.spec.table_spec,
            spec_fields = lynkui.pagelet.dataRowUpsertCache.spec.table_spec.fields,
            ro_fields = lynkui.pagelet.dataRowUpsertCache.ro_fields,
            row_id = lynkui.pagelet.dataRowUpsertCache.id;

        let req = {
            instance_name: spec.instance_name,
            table_name: spec.table_name,
            fields: [],
            values: [],
        };

        let fields = ro_fields;
        for (var i in spec_fields) {
            var spec_field = spec_fields[i];
            if (fields[spec_field.tag_name]) {
                continue;
            }
            var elem = $("#data-row-upsert-field-" + spec_field.tag_name);
            if (!elem || elem.length < 1) {
                continue;
            }
            var value = null;
            switch (spec_field.type) {
                case "string":
                    value = elem.val();
                    if (!value || value == "") {
                        value = elem.find("option:selected").val();
                    }
                    break;

                case "int":
                case "uint":
                    value = parseInt(elem.val());
                    break;

                case "float":
                    value = parseFloat(elem.val());
                    break;
            }
            if (!value) {
                continue;
            }
            console.log("set field " + spec_field.tag_name + " : " + value);
            fields[spec_field.tag_name] = value;
        }

        for (var name in fields) {
            req.fields.push(name);
            req.values.push(fields[name]);
        }
        console.log(req);
        // return;

        var url = lynkui.basepath + "/api/v1/datalet/upsert";
        lynkui.utilx.ajax(url, {
            data: lynkui.utilx.jsonEncode(req),
            callback: function (err, data) {
                if (err) {
                    return lynkui.modal.footAlert("warn", err, 3000);
                }
                // console.log(data);
                if (!data.status || !data.status.code) {
                    return lynkui.modal.footAlert("warn", "unknown error", 3000);
                } else if (data.status.code != "2000") {
                    return lynkui.modal.footAlert("warn", data.status.message, 3000);
                }
                //
                if (row_id) {
                    for (var name in fields) {
                        $("#data-row-" + row_id + "-field-" + name).text(
                            lynkui.pagelet.rowFieldValue(
                                data_spec,
                                {
                                    fields: fields,
                                },
                                name
                            )
                        );
                    }
                } else if (x_data && x_data.pagelet) {
                    pagelet.applyRefresh(x_data.pagelet);
                }

                //
                return lynkui.modal.footAlert("ok", "OK", 2000);
            },
        });
    };

    pagelet.datalet = function (vl, cb) {
        if (
            !vl ||
            !vl.template ||
            !vl.template.html ||
            !vl.output ||
            !vl.datalet ||
            !vl.datalet.table_name
        ) {
            // console.log("skip");
            // console.log(vl);
            return;
        }
        if (!cb || typeof cb !== "function") {
            return;
        }

        var url = lynkui.basepath + "/api/v1/datalet/run?pagelet=" + vl.name;
        if (vl.datalet.query_filter && vl.datalet.query_filter.field) {
            url += lynkui.utilx.sprintf(
                "&query_filter=%s",
                lynkui.utilx.object64Encode(vl.datalet.query_filter)
            );
        }

        lynkui.utilx.ajax(url, {
            callback: function (err, data) {
                // console.log(data);
                if (err) {
                    return lynkui.alert.open("error", err);
                }
                var msg = lynkui.utilx.kindCheck(data, "DataResults");
                if (msg) {
                    return lynkui.alert.open("error", msg);
                }
                if (data.results) {
                    var _data = {};
                    for (var i in data.results) {
                        if (data.results[i].name == vl.name) {
                            lynkui.datalet_data_set[vl.name] = data.results[i];
                            return cb(null, pagelet._dataResultConvert(vl, data.results[i]));
                        }
                    }
                }
                return cb("no data found", null);
            },
        });
    };

    var job = lynkui.job;

    job.register = function (opts) {
        if (!opts || !opts.id || typeof opts.func !== "function" || !opts.delay) {
            return;
        }

        if (opts.delay < 1000) {
            opts.delay = 1000;
        } else if (opts.delay > 60000) {
            opts.delay = 60000;
        }

        if (lynkui.job.items[opts.id]) {
            opts.updated = lynkui.job.items[opts.id].updated;
        } else {
            opts.updated = lynkui.utilx.unixTimeMillisecond();
        }

        lynkui.job.items[opts.id] = opts;

        if (!lynkui.job.ticker) {
            lynkui.job.ticker = setInterval(job.run, 1000);
            console.log("job ticker run");
        }
    };

    job.clean = function (id) {
        if (id && lynkui.job.items[id]) {
            delete lynkui.job.items[id];
            console.log("job clean " + id);
        }
    };

    job.run = function () {
        var tn = lynkui.utilx.unixTimeMillisecond();
        var rn = 0;
        for (var id in lynkui.job.items) {
            var task = lynkui.job.items[id];
            if (task.running === true) {
                if (task.updated + task.delay + 60000 < tn) {
                    delete lynkui.job.items[id];
                    console.log("job force clean " + id);
                }
                continue;
            }
            rn += 1;
            lynkui.job.items[id].running = true;
            if (task.updated + task.delay < tn) {
                // console.log("job exec " + id);
                task.func({
                    params: task.params,
                    callback: function (action) {
                        if (action && action === "clean") {
                            delete lynkui.job.items[id];
                            console.log("job clean " + id);
                        } else {
                            lynkui.job.items[id].running = false;
                            lynkui.job.items[id].updated = lynkui.utilx.unixTimeMillisecond();
                        }
                    },
                });
            } else {
                lynkui.job.items[id].running = false;
                // console.log("job skip " + id);
            }
        }
        if (lynkui.job.ticker && rn == 0) {
            clearInterval(lynkui.job.ticker);
            lynkui.job.ticker = false;
            console.log("job ticker stop");
        }
    };

    var utilx = lynkui.utilx;

    //
    utilx.objectClone = function (obj) {
        var copy;

        if (null == obj || typeof obj != "object") {
            return obj;
        }

        if (obj instanceof Date) {
            copy = new Date();
            copy.setTime(obj.getTime());
        } else if (obj instanceof Array) {
            return obj.slice(0);
        } else if (obj instanceof Object) {
            copy = {};
            for (var attr in obj) {
                if (obj.hasOwnProperty(attr)) {
                    copy[attr] = utilx.objectClone(obj[attr]);
                }
            }
        }

        return copy;
    };

    utilx.timeChars = {
        // Year
        Y: function () {
            return this.getFullYear();
        },
        // Month
        m: function () {
            return (this.getMonth() < 9 ? "0" : "") + (this.getMonth() + 1);
        },
        // Day
        d: function () {
            return (this.getDate() < 10 ? "0" : "") + this.getDate();
        },
        // Hour
        H: function () {
            return (this.getHours() < 10 ? "0" : "") + this.getHours();
        },
        // Minute
        i: function () {
            return (this.getMinutes() < 10 ? "0" : "") + this.getMinutes();
        },
        // Second
        s: function () {
            return (this.getSeconds() < 10 ? "0" : "") + this.getSeconds();
        },
        u: function () {
            var m = this.getMilliseconds();
            return (m < 10 ? "00" : m < 100 ? "0" : "") + m;
        },
    };

    Date.prototype.utilxTimeFormat = function (format) {
        if (!format) {
            return "";
        }
        var date = this;
        return format.replace(/(\\?)(.)/g, function (_, esc, chr) {
            return esc === "" && lynkui.utilx.timeChars[chr]
                ? lynkui.utilx.timeChars[chr].call(date)
                : chr;
        });
    };

    // http://tools.ietf.org/html/rfc2822#page-14
    // ISO 8601
    utilx.metaTimeParseFormat = function (time, format) {
        time = "" + time;
        if (time.length < 17) {
            return new Date().utilxTimeFormat(format);
        }

        var ut = Date.UTC(
            time.substr(0, 4),
            parseInt(time.substr(4, 2)) - 1,
            time.substr(6, 2),
            time.substr(8, 2),
            time.substr(10, 2),
            time.substr(12, 2)
        );
        if (!ut) {
            return new Date().utilxTimeFormat(format);
        }

        return new Date(ut).utilxTimeFormat(format);
    };

    utilx.timeParseFormat = function (time, format) {
        if (!time) {
            return new Date().utilxTimeFormat(format);
        }

        var tn = Date.parse(time);
        if (!tn) {
            tn = Date.parse(time.replace(/\-/g, "/"));
        }

        return new Date(tn).utilxTimeFormat(format);
    };

    utilx.unixTimeFormat = function (time, format) {
        if (!time) {
            return "";
        }

        return new Date(time * 1000).utilxTimeFormat(format);
    };

    utilx.unixMillisecondFormat = function (time, format) {
        if (!time) {
            return "";
        }

        return new Date(time).utilxTimeFormat(format);
    };

    utilx.unixTimeSecond = function () {
        return parseInt(Date.now() / 1000);
    };

    utilx.unixTimeMillisecond = function () {
        return parseInt(Date.now());
    };

    utilx.unixTimeUptime = function (sec) {
        if (!sec || sec < 1) {
            return "0";
        }
        sec = utilx.unixTimeSecond() - sec;
        var s = [];

        var d = parseInt(sec / 86400);
        if (d > 1) {
            s.push(d + " days");
        } else if (d == 1) {
            s.push(d + " day");
        }

        var s2 = [];
        sec = sec % 86400;
        var h = parseInt(sec / 3600);
        if (h < 10) {
            s2.push("0" + h);
        } else {
            s2.push(h);
        }

        sec = sec % 3600;
        var m = parseInt(sec / 60);
        if (m < 10) {
            s2.push("0" + m);
        } else {
            s2.push(m);
        }

        sec = sec % 60;
        if (sec < 10) {
            s2.push("0" + sec);
        } else {
            s2.push(sec);
        }
        s.push(s2.join(":"));

        return s.join(", ");
    };

    utilx.uriQuery = function () {
        // This function is anonymous, is executed immediately and
        // the return value is assigned to l4i.UriQuery!
        var query_string = {};
        var query = window.location.search.substring(1);
        var vars = query.split("&");

        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split("=");

            // If first entry with this name
            if (typeof query_string[pair[0]] === "undefined") {
                query_string[pair[0]] = pair[1];
                // If second entry with this name
            } else if (typeof query_string[pair[0]] === "string") {
                var arr = [query_string[pair[0]], pair[1]];
                query_string[pair[0]] = arr;
                // If third or later entry with this name
            } else {
                query_string[pair[0]].push(pair[1]);
            }
        }

        return query_string;
    };

    utilx.valuePercent = function (a, b) {
        if (b <= 0) {
            b = 1.0;
        } else {
            b = parseFloat(b);
        }
        a = parseFloat(a);
        return parseInt((100 * a) / b);
    };

    utilx.arrayObjectHas = function (ar, v) {
        if (ar && ar.length > 0 && v) {
            for (var i in ar) {
                if (ar[i] == v) {
                    return true;
                }
            }
        }
        return false;
    };

    utilx.versionCompare = function (v1, v2) {
        if (typeof v1 !== "string") {
            return 0;
        }
        if (typeof v2 !== "string") {
            return 0;
        }
        v1 = v1.split(".");
        v2 = v2.split(".");
        const k = Math.min(v1.length, v2.length);
        for (let i = 0; i < k; ++i) {
            v1[i] = parseInt(v1[i], 10);
            v2[i] = parseInt(v2[i], 10);
            if (v1[i] > v2[i]) {
                return 1;
            }
            if (v1[i] < v2[i]) {
                return -1;
            }
        }
        return v1.length == v2.length ? 0 : v1.length < v2.length ? -1 : 1;
    };

    utilx.object64Encode = function (o) {
        return btoa(JSON.stringify(o));
    };

    utilx.object64Decode = function (s) {
        return JSON.parse(atob(s));
    };

    utilx.jsonEncode = function (o) {
        return JSON.stringify(o);
    };

    utilx.jsonDecode = function (s) {
        return JSON.parse(s);
    };

    utilx.cryptoMd5 = function (str) {
        // http://kevin.vanzonneveld.net
        // +   original by: Webtoolkit.info (http://www.webtoolkit.info/)
        // + namespaced by: Michael White (http://getsprink.com)
        // +    tweaked by: Jack
        // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // +      input by: Brett Zamir (http://brett-zamir.me)
        // +   bugfixed by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
        // -    depends on: utf8_encode
        // *     example 1: md5('Kevin van Zonneveld');
        // *     returns 1: '6e658d4bfcb59cc13f96c14450ac40b9'
        var xl;

        var rotateLeft = function (lValue, iShiftBits) {
            return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
        };

        var addUnsigned = function (lX, lY) {
            var lX4, lY4, lX8, lY8, lResult;
            lX8 = lX & 0x80000000;
            lY8 = lY & 0x80000000;
            lX4 = lX & 0x40000000;
            lY4 = lY & 0x40000000;
            lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
            if (lX4 & lY4) {
                return lResult ^ 0x80000000 ^ lX8 ^ lY8;
            }
            if (lX4 | lY4) {
                if (lResult & 0x40000000) {
                    return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
                } else {
                    return lResult ^ 0x40000000 ^ lX8 ^ lY8;
                }
            } else {
                return lResult ^ lX8 ^ lY8;
            }
        };

        var _F = function (x, y, z) {
            return (x & y) | (~x & z);
        };
        var _G = function (x, y, z) {
            return (x & z) | (y & ~z);
        };
        var _H = function (x, y, z) {
            return x ^ y ^ z;
        };
        var _I = function (x, y, z) {
            return y ^ (x | ~z);
        };

        var _FF = function (a, b, c, d, x, s, ac) {
            a = addUnsigned(a, addUnsigned(addUnsigned(_F(b, c, d), x), ac));
            return addUnsigned(rotateLeft(a, s), b);
        };

        var _GG = function (a, b, c, d, x, s, ac) {
            a = addUnsigned(a, addUnsigned(addUnsigned(_G(b, c, d), x), ac));
            return addUnsigned(rotateLeft(a, s), b);
        };

        var _HH = function (a, b, c, d, x, s, ac) {
            a = addUnsigned(a, addUnsigned(addUnsigned(_H(b, c, d), x), ac));
            return addUnsigned(rotateLeft(a, s), b);
        };

        var _II = function (a, b, c, d, x, s, ac) {
            a = addUnsigned(a, addUnsigned(addUnsigned(_I(b, c, d), x), ac));
            return addUnsigned(rotateLeft(a, s), b);
        };

        var convertToWordArray = function (str) {
            var lWordCount;
            var lMessageLength = str.length;
            var lNumberOfWords_temp1 = lMessageLength + 8;
            var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
            var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
            var lWordArray = new Array(lNumberOfWords - 1);
            var lBytePosition = 0;
            var lByteCount = 0;
            while (lByteCount < lMessageLength) {
                lWordCount = (lByteCount - (lByteCount % 4)) / 4;
                lBytePosition = (lByteCount % 4) * 8;
                lWordArray[lWordCount] =
                    lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition);
                lByteCount++;
            }
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
            lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
            lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
            return lWordArray;
        };

        var wordToHex = function (lValue) {
            var wordToHexValue = "",
                wordToHexValue_temp = "",
                lByte,
                lCount;
            for (lCount = 0; lCount <= 3; lCount++) {
                lByte = (lValue >>> (lCount * 8)) & 255;
                wordToHexValue_temp = "0" + lByte.toString(16);
                wordToHexValue =
                    wordToHexValue + wordToHexValue_temp.substr(wordToHexValue_temp.length - 2, 2);
            }
            return wordToHexValue;
        };

        var x = [],
            k,
            AA,
            BB,
            CC,
            DD,
            a,
            b,
            c,
            d,
            S11 = 7,
            S12 = 12,
            S13 = 17,
            S14 = 22,
            S21 = 5,
            S22 = 9,
            S23 = 14,
            S24 = 20,
            S31 = 4,
            S32 = 11,
            S33 = 16,
            S34 = 23,
            S41 = 6,
            S42 = 10,
            S43 = 15,
            S44 = 21;

        var utf8_encode = function (string) {
            string = string.replace(/\r/g, "");
            var utftext = "";

            for (var n = 0; n < string.length; n++) {
                var c = string.charCodeAt(n);

                if (c < 128) {
                    utftext += String.fromCharCode(c);
                } else if (c > 127 && c < 2048) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                } else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
            }

            return utftext;
        };

        str = utf8_encode(str);
        x = convertToWordArray(str);
        a = 0x67452301;
        b = 0xefcdab89;
        c = 0x98badcfe;
        d = 0x10325476;

        xl = x.length;
        for (k = 0; k < xl; k += 16) {
            AA = a;
            BB = b;
            CC = c;
            DD = d;
            a = _FF(a, b, c, d, x[k + 0], S11, 0xd76aa478);
            d = _FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
            c = _FF(c, d, a, b, x[k + 2], S13, 0x242070db);
            b = _FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
            a = _FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf);
            d = _FF(d, a, b, c, x[k + 5], S12, 0x4787c62a);
            c = _FF(c, d, a, b, x[k + 6], S13, 0xa8304613);
            b = _FF(b, c, d, a, x[k + 7], S14, 0xfd469501);
            a = _FF(a, b, c, d, x[k + 8], S11, 0x698098d8);
            d = _FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
            c = _FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1);
            b = _FF(b, c, d, a, x[k + 11], S14, 0x895cd7be);
            a = _FF(a, b, c, d, x[k + 12], S11, 0x6b901122);
            d = _FF(d, a, b, c, x[k + 13], S12, 0xfd987193);
            c = _FF(c, d, a, b, x[k + 14], S13, 0xa679438e);
            b = _FF(b, c, d, a, x[k + 15], S14, 0x49b40821);
            a = _GG(a, b, c, d, x[k + 1], S21, 0xf61e2562);
            d = _GG(d, a, b, c, x[k + 6], S22, 0xc040b340);
            c = _GG(c, d, a, b, x[k + 11], S23, 0x265e5a51);
            b = _GG(b, c, d, a, x[k + 0], S24, 0xe9b6c7aa);
            a = _GG(a, b, c, d, x[k + 5], S21, 0xd62f105d);
            d = _GG(d, a, b, c, x[k + 10], S22, 0x2441453);
            c = _GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681);
            b = _GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
            a = _GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6);
            d = _GG(d, a, b, c, x[k + 14], S22, 0xc33707d6);
            c = _GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87);
            b = _GG(b, c, d, a, x[k + 8], S24, 0x455a14ed);
            a = _GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905);
            d = _GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
            c = _GG(c, d, a, b, x[k + 7], S23, 0x676f02d9);
            b = _GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);
            a = _HH(a, b, c, d, x[k + 5], S31, 0xfffa3942);
            d = _HH(d, a, b, c, x[k + 8], S32, 0x8771f681);
            c = _HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122);
            b = _HH(b, c, d, a, x[k + 14], S34, 0xfde5380c);
            a = _HH(a, b, c, d, x[k + 1], S31, 0xa4beea44);
            d = _HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
            c = _HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60);
            b = _HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
            a = _HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6);
            d = _HH(d, a, b, c, x[k + 0], S32, 0xeaa127fa);
            c = _HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085);
            b = _HH(b, c, d, a, x[k + 6], S34, 0x4881d05);
            a = _HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039);
            d = _HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
            c = _HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8);
            b = _HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665);
            a = _II(a, b, c, d, x[k + 0], S41, 0xf4292244);
            d = _II(d, a, b, c, x[k + 7], S42, 0x432aff97);
            c = _II(c, d, a, b, x[k + 14], S43, 0xab9423a7);
            b = _II(b, c, d, a, x[k + 5], S44, 0xfc93a039);
            a = _II(a, b, c, d, x[k + 12], S41, 0x655b59c3);
            d = _II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
            c = _II(c, d, a, b, x[k + 10], S43, 0xffeff47d);
            b = _II(b, c, d, a, x[k + 1], S44, 0x85845dd1);
            a = _II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f);
            d = _II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
            c = _II(c, d, a, b, x[k + 6], S43, 0xa3014314);
            b = _II(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
            a = _II(a, b, c, d, x[k + 4], S41, 0xf7537e82);
            d = _II(d, a, b, c, x[k + 11], S42, 0xbd3af235);
            c = _II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb);
            b = _II(b, c, d, a, x[k + 9], S44, 0xeb86d391);
            a = addUnsigned(a, AA);
            b = addUnsigned(b, BB);
            c = addUnsigned(c, CC);
            d = addUnsigned(d, DD);
        }

        var temp = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);

        return temp.toLowerCase();
    };

    utilx.sprintf = function () {
        return _sprintf.apply(this, arguments);
    };

    utilx.substr = function (str, siz) {
        var p10 = siz + siz / 10;
        if (str && str.length > p10) {
            return str.substr(0, siz) + " ...";
        }
        return str;
    };

    utilx.errorKindCheck = function (err, obj, apikind) {
        var msg = "";
        if (err) {
            if (typeof obj === "string") {
                msg = `Error Code : ${err}, Message : ${obj}`;
            } else {
                msg = err;
            }
            return msg;
        }
        const nerr = "Network Exception, Please try again later";
        if (obj && obj.error) {
            if (obj.error.code) {
                msg = `Error Code : ${obj.error.code}`;
            }
            if (obj.error.message) {
                msg += `, Message : ${obj.error.message}`;
            }
            if (msg.length < 1) {
                msg = nerr;
            }
            return msg;
        }
        if (!obj || !obj.kind || obj.kind == "") {
            return nerr;
        }
        if (obj.kind != apikind) {
            if (obj.message) {
                return _sprintf("Error %s, Message %s", obj.kind, obj.message);
            }
            return _sprintf("Error %s, Unknown Error", obj.kind);
        }
        return null;
    };

    utilx.kindCheck = function (obj, apikind) {
        if (!obj || !obj.kind || obj.kind == "") {
            return "network error";
        }
        if (obj.kind != apikind && !obj.kind.endsWith("." + apikind)) {
            if (obj.message) {
                return _sprintf("Error %s, Message %s", obj.kind, obj.message);
            }
            return _sprintf("Error %s, Unknown Error", obj.kind);
        }
        return null;
    };

    utilx.byteSizeFormat = function (size, tofix) {
        var ms = [
            [7, "ZiB"],
            [6, "EiB"],
            [5, "PiB"],
            [4, "TiB"],
            [3, "GiB"],
            [2, "MiB"],
            [1, "KiB"],
        ];

        if (!tofix || tofix < 0) {
            tofix = 0;
        } else if (tofix > 3) {
            tofix = 3;
        }

        for (var i in ms) {
            if (size >= Math.pow(1024, ms[i][0])) {
                return (size / Math.pow(1024, ms[i][0])).toFixed(tofix) + " " + ms[i][1];
            }
        }

        if (size == 0) {
            return size;
        }

        return size + " B";
    };

    utilx.ajax = function (url, options) {
        options = options || {};

        if (!url.startsWith("/")) {
            url = lynkui.basepath + url;
        }

        //
        if (options.debug || options.nocache) {
            if (/\?/.test(url)) {
                url += "&_=";
            } else {
                url += "?_=";
            }
            url += Math.random();
        } else if (options.app_version && options.app_version.length > 0) {
            if (/\?/.test(url)) {
                url += "&_=" + options.app_version;
            } else {
                url += "?_=" + options.app_version;
            }
        }

        //
        if (!options.method) {
            if (options.data) {
                options.method = "POST";
            } else {
                options.method = "GET";
            }
        }

        //
        if (!options.timeout) {
            options.timeout = 10000;
        }

        //
        $.ajax({
            url: url,
            type: options.method,
            data: options.data,
            timeout: options.timeout,
            success: function (rsp) {
                if (typeof options.callback === "function") {
                    options.callback(null, rsp);
                }
            },
            error: function (xhr, textStatus, error) {
                if (typeof options.callback === "function") {
                    if (error) {
                        options.callback(error, null);
                    } else {
                        options.callback(xhr.responseText, null);
                    }
                }
            },
        });
    };

    //
    var _alertTypeClassName = function (type) {
        var type_ui = "info";
        switch (type) {
            case "ok":
                type_ui = "success";
                break;

            case "warn":
                type_ui = "warning";
                break;

            case "error":
                type_ui = "danger";
                break;

            default:
                type_ui = "info";
        }
        return type_ui;
    };

    _alert.innerRefresh = function (obj, type, msg) {
        if (type == "") {
            $(obj).hide();
        } else {
            $(obj)
                .removeClass()
                .addClass("alert " + type)
                .html(msg)
                .fadeOut(200)
                .fadeIn(200);
        }
    };

    _alert.open = function (type, msg, options) {
        if (_alert.modal_instance !== null) {
            // _alert.modal_instance.dispose();
            _alert.modal_instance = null;
        }
        options = options || {};

        var type_ui = _alertTypeClassName(type);

        var close_ctn = "";
        if (true) {
            close_ctn =
                '<button type="button" class="btn-close" data-bs-dismiss="modal" _onclick="lynkui.alert.close()"></button>';
        }

        var btn_ctn = "";
        if (options.buttons && options.buttons.length > 0) {
            btn_ctn =
                '<div class="modal-footer">' +
                lynkui.template.buttonRender(options.buttons) +
                "</div>";
        }

        if (!options.title) {
            options.title = "Alert";
        }

        var ctn = _sprintf(
            '<div id="lynkui-alert" class="modal fade %s">' +
                '<div class="modal-dialog"><div class="modal-content">' +
                '  <div class="modal-header"><h5 class="modal-title">%s</h5>%s</div>' +
                '  <div class="modal-body" id="lynkui-alert-msg">%s</div>%s' +
                "</div></div></div>",
            type_ui,
            options.title,
            close_ctn,
            msg,
            btn_ctn
        );

        $("#lynkui-alert").remove();
        $("#lynkui-body").append(ctn);

        bootstrap.Modal.Default.keyboard = true;

        var elem = document.getElementById("lynkui-alert");

        lynkui.alert.modal_instance = new bootstrap.Modal(elem);

        lynkui.alert.modal_instance.show();
    };

    _alert.close = function (cb) {
        if (_alert.modal_instance) {
            _alert.modal_instance.hide();
            _alert.modal_instance.dispose();
            _alert.modal_instance = null;
        }
        if (lynkui.alert.modal_instance !== null) {
            lynkui.alert.modal_instance.hide();
            lynkui.alert.modal_instance.dispose();
        }
        lynkui.alert.modal_instance = null;
        $("#lynkui-alert").remove();
        $(".modal-backdrop").remove();

        if (typeof cb === "function") {
            cb();
        }
    };

    _alert.error = function (msg) {
        _alert.open("error", msg);
    };

    _alert.innerShow = function (obj, type, msg) {
        if (type == "") {
            $(obj).hide();
        } else {
            var type_ui = _alertTypeClassName(type);
            $(obj)
                .removeClass()
                .addClass("alert alert-" + type_ui)
                .html(msg)
                .fadeIn(200);
        }
    };

    _modal.open = function (options) {
        options = options || {};

        if (typeof options.success !== "function") {
            options.success = function () {};
        }

        if (typeof options.error !== "function") {
            options.error = function () {};
        }

        if (!options.position) {
            options.position = _modal.position;
        } else if (options.position != "center" && options.position != "cursor") {
            options.position = "center";
        }

        if (options.id === undefined) {
            options.id = "lynkui-modal-single";
        }

        if (options.close === undefined) {
            options.close = true;
        }

        if (options.buttons === undefined) {
            options.buttons = [];
        }

        // $("#"+ modalid).remove();

        if (options.backEnable !== false) {
            options.backEnable = true;
        }

        if (_modal.current != null && options.backEnable) {
            options.prevModalId = _modal.current;

            _modal.data[_modal.current].nextModalId = options.id;

            options.buttons.unshift({
                onclick: "lynkui.modal.prev()",
                title: lynkui.lang.T("Back"),
                style: "button is-dark btn-dark lynkui-base-pull-left",
            });
        }

        _modal.data[options.id] = options;

        if (typeof options.callback === "function") {
            _modal.switch(options.id, options.callback);
        } else {
            _modal.switch(options.id);
        }
    };

    _modal.switch = function (modalid, cb) {
        var options = _modal.data[modalid];
        if (options.id === undefined) {
            return;
        }

        if (_modal.current == null) {
            $("#" + modalid).remove();
        }

        var firstload = false;
        if (!_modal.current) {
            $("#lynkui-modal").remove();
            $("body").append(
                '<div id="lynkui-modal">\
            <div class="lynkui-modal-header" style="display:none">\
                <span id="lynkui-modal-header-title" class="title"></span>\
                <span class="close" onclick="lynkui.modal.close()">×</span>\
            </div>\
            <div class="lynkui-modal-body"><div id="lynkui-modal-body-page" class="lynkui-modal-body-page"></div></div>\
            <div id="lynkui-modal-footer-alert" style="display:none"></div>\
            <div id="lynkui-modal-footer" class="lynkui-modal-footer" style="display:none"></div>\
            </div>'
            );

            firstload = true;
        } else {
            $(".lynkui-modal-footer").empty();
        }

        if (options.title) {
            $(".lynkui-modal-header").css({
                display: "block",
            });
        } else {
            $(".lynkui-modal-header").css({
                display: "none",
            });
        }

        if (!options.close) {
            $(".lynkui-modal-header").find(".close").css({
                display: "none",
            });
        }

        var buttons = _modal.buttonRender(options.buttons);
        if (buttons.length > 10) {
            $(".lynkui-modal-footer").css({
                display: "inline-block",
            });
        }

        if (!document.getElementById(modalid)) {
            var body = "<div id='" + modalid + "' class='lynkui-modal-body-pagelet lynkui-scroll'>";

            if (options.tplsrc !== undefined) {
                if (options.data !== undefined) {
                    var tempFn = doT.template(options.tplsrc);
                    body += tempFn(options.data);
                } else {
                    body += options.tplsrc;
                }
            } else if (options.tplid !== undefined) {
                var elem = document.getElementById(options.tplid);
                if (!elem) {
                    return "";
                }

                var source = elem.value || elem.innerHTML;

                if (options.data !== undefined) {
                    var tempFn = doT.template(source);
                    body += tempFn(options.data);
                } else {
                    body += source;
                }
            } else if (options.tpluri) {
                if (/\?/.test(options.tpluri)) {
                    options.tpluri += "&_=";
                } else {
                    options.tpluri += "?_=";
                }
                options.tpluri += Math.random();

                $.ajax({
                    url: options.tpluri,
                    type: "GET",
                    timeout: 10000,
                    async: false,
                    success: function (rsp) {
                        if (options.data !== undefined) {
                            var tempFn = doT.template(rsp);
                            body += tempFn(options.data);
                        } else {
                            body += rsp;
                        }
                    },
                    error: function () {
                        body += "Failed on load template";
                    },
                });
            }

            body += "</div>";

            if (options.i18n) {
                body = lynkui.lang.TR(body);
            }

            $("#lynkui-modal-body-page").append(body);
        }

        $("#" + modalid).css({
            "z-index": "-100",
            display: "block",
        });

        if (!$("#lynkui-modal").is(":visible")) {
            $("#lynkui-modal")
                .css({
                    "z-index": "-100",
                })
                .css({
                    display: "block",
                });
        }

        var bw = $(window).width(),
            bh = $(window).height(),
            mh = $("#" + modalid).height(),
            mhh = $(".lynkui-modal-header").height(),
            mfh = $(".lynkui-modal-footer").height() + 20;

        //
        if (!options.width_min) {
            options.width_min = 200;
        } else {
            options.width_min = parseInt(options.width_min);
            if (options.width_min < 200) {
                options.width_min = 200;
            }
        }
        if (!options.width && _modal.width) {
            options.width = _modal.width;
        } else if (options.width == "max") {
            options.width = 10000;
        }
        options.width = parseInt(options.width);
        if (options.width < 1) {
            options.width = $("#" + modalid).outerWidth(true);
        }
        if (options.width + 100 > bw) {
            options.width = bw - 100;
        }
        if (options.width < options.width_min) {
            options.width = options.width_min;
        }

        //
        if (!options.height_min) {
            options.height_min = 100;
        } else {
            options.height_min = parseInt(options.height_min);
            if (options.height_min < 100) {
                options.height_min = 100;
            }
        }
        if (!options.height && _modal.height) {
            options.height = _modal.height;
        } else if (options.height == "auto") {
            options.height = mh + mhh + mfh + 10;
        } else if (options.height == "max") {
            options.height = 2000;
        }
        options.height = parseInt(options.height);
        // console.log(options.height);
        if (options.height < 100) {
            options.height = mh + mhh + mfh;
        }
        if (options.height + 100 > bh) {
            options.height = bh - 100;
        }
        if (options.height < options.height_min) {
            options.height = options.height_min;
        }
        // console.log("width " + options.width + ", min " + options.width_min);

        //
        var top = 0,
            left = 0;

        if (options.position == "center") {
            left = bw / 2 - options.width / 2;
            top = bh / 2 - options.height / 2;
        } else {
            var p = l4i.PosGet();
            if (p.left / bw > 0.66 && options.width < bw) {
                left = p.left - options.width + 10;
            } else {
                left = p.left - 10;
            }
            top = p.top - 10;
        }
        if (left > bw - options.width - 10) {
            left = bw - options.width - 10;
        }
        if (top + options.height + 40 > bh) {
            top = bh - options.height - 40;
        }
        if (top < 10) {
            top = 10;
        }

        $("#lynkui-modal").css({
            height: options.height + "px",
            width: options.width + "px",
        });

        options.inlet_width = options.width - 20;
        options.inlet_height = options.height - mhh - mfh - 20;

        var body_margin = "10px";
        if (buttons.length > 10) {
            body_margin = "10px 10px 0 10px";
            options.inlet_height += 10;
        }

        $(".lynkui-modal-body").css({
            margin: body_margin,
            width: options.inlet_width + "px",
            height: options.inlet_height + "px",
        });

        if (!$("#lynkui-modal-bg").is(":visible")) {
            $("#lynkui-modal-bg").remove();
            $("body").append('<div id="lynkui-modal-bg" class="lynkui-base-hide"></div>');
            $("#lynkui-modal-bg").fadeIn(150);
        }

        $("#" + modalid).css({
            "z-index": 1,
            width: options.inlet_width + "px", // options.width +"px",
            height: options.inlet_height + "px",
        });

        var pp = $("#" + modalid).position();
        var mov = pp.left;
        if (mov < 0) {
            mov = 0;
        }

        if (firstload) {
            if (options.title) {
                $(".lynkui-modal-header .title").text(options.title);
            }

            if (buttons.length > 10) {
                $(".lynkui-modal-footer").html(buttons);
            }

            $("#lynkui-modal")
                .css({
                    position: "fixed",
                    "z-index": 200,
                    top: top + "px",
                    left: left + "px",
                })
                .slideDown(100, function () {
                    // _modal.resize();
                    // options.success();
                });
        } else {
            $("#lynkui-modal").animate(
                {
                    position: "fixed",
                    "z-index": 200,
                    top: top + "px",
                    left: left + "px",
                },
                50,
                function () {
                    // _modal.resize();
                    // options.success();
                }
            );
        }

        $(".lynkui-modal-body-page").animate(
            {
                top: 0,
                left: "-" + mov + "px",
            },
            300,
            function () {
                if (!firstload) {
                    if (options.title !== undefined) {
                        $(".lynkui-modal-header .title").text(options.title);
                    }

                    if (buttons.length > 10) {
                        $(".lynkui-modal-footer").html(buttons);
                    }
                }

                $("#" + modalid + " .inputfocus").focus();

                _modal.resize();

                if (options.success) {
                    options.success();

                    if (_modal.data[modalid]) {
                        _modal.data[modalid].success = null;
                    }
                }

                if (cb) {
                    cb();
                }
            }
        );

        _modal.current = options.id;
        _modal.CurOptions = options;
        _modal.width = options.width;
        _modal.height = options.height;
        _modal.position = options.position;

        if (options.nextModalId !== undefined) {
            delete _modal.data[options.nextModalId];
            $("#" + options.nextModalId).remove();
            _modal.data[options.id].nextModalId = undefined;
        }
    };

    _modal.prevId = function () {
        var mp = _modal.data[_modal.current];
        if (mp.prevModalId !== undefined) {
            return mp.prevModalId;
        }
        return null;
    };

    _modal.prev = function (cb) {
        var previd = _modal.prevId();
        if (previd != null) {
            // _modal.nextHistory = _modal.current;
            _modal.switch(previd, cb);
        }
    };

    _modal.buttonRender = function (buttons) {
        var str = "";
        for (var i in buttons) {
            if (!buttons[i].title) {
                continue;
            }

            if (!buttons[i].style) {
                buttons[i].style = "btn-default";
            }

            if (buttons[i].href) {
                str +=
                    `<a class="btn btn-small ${buttons[i].style}"` +
                    ` href="${buttons[i].href}">${buttons[i].title}</a>`;
            } else if (buttons[i].onclick) {
                str +=
                    `<button class="btn btn-small ${buttons[i].style}"` +
                    ` onclick="${buttons[i].onclick}">${buttons[i].title}</button>`;
            }
        }
        // console.log(buttons);
        return str;
    };

    _modal.resize = function () {
        var h = $("#lynkui-modal").height(),
            hh = $(".lynkui-modal-header").height(),
            fh = $(".lynkui-modal-footer").height() + 20;
        var bh = h - hh - fh - 20;
        if (_modal.CurOptions.buttons && _modal.CurOptions.buttons.length > 0) {
            bh += 10;
        }
        if (bh == _modal.CurOptions.inlet_height) {
            return;
        }
        _modal.CurOptions.inlet_height = bh;
        $(".lynkui-modal-body").height(bh);
        $(".lynkui-modal-body-pagelet").height(bh);
    };

    _modal.footAlert = function (type, msg, time_close, tplid) {
        var timems = 200;
        if (time_close) {
            if (time_close < 1000) {
                time_close = 1000;
            }
        }
        tplid = tplid ? tplid : "lynkui-modal-footer";
        var elem = $("#" + tplid + "-alert");
        if (!elem || elem.length < 1) {
            return;
        }
        if (!type || type == "") {
            elem.hide(timems);
        } else {
            $("#" + tplid).slideUp(timems);
            var type_css = "alert alert-" + _alertTypeClassName(type);

            elem.removeClass(function (i, className) {
                return (className.match(/(^|\s)alert-\S+/g) || []).join(" ");
            })
                .addClass(type_css)
                .html(msg)
                .slideDown(timems);
            if (!time_close) {
                return;
            }
            setTimeout(function () {
                $("#" + tplid).slideDown(timems);
                elem.slideUp(timems);
                if (type == "ok") {
                    _modal.close();
                }
            }, time_close);
        }
    };

    _modal.close = function (cb) {
        if (!_modal.current) {
            if (cb) {
                cb();
            }
            return;
        }
        $("#lynkui-modal").slideUp(100, function () {
            _modal.data = {};
            _modal.current = null;
            _modal.CurOptions = null;
            $("#lynkui-modal").remove();
            if (cb) {
                cb();
            }
        });
        $("#lynkui-modal-bg").fadeOut(100);
    };

    _modal.scrollTop = function () {
        $(".lynkui-modal-body-pagelet.lynkui-scroll").scrollTop(0);
    };

    //
    var cookie = lynkui.cookie;

    cookie.set = function (key, val, sec, path) {
        var expires = "";

        if (sec) {
            var date = new Date();
            date.setTime(date.getTime() + sec * 1000);
            expires = "; expires=" + date.toGMTString();
        }

        if (!path) {
            path = "/";
        }

        document.cookie = key + "=" + val + expires + "; path=" + path;
    };

    cookie.setByDay = function (key, val, day, path) {
        cookie.set(key, val, day * 86400, path);
    };

    cookie.get = function (key) {
        var keyEQ = key + "=";
        var ca = document.cookie.split(";");

        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == " ") c = c.substring(1, c.length);
            if (c.indexOf(keyEQ) == 0) return c.substring(keyEQ.length, c.length);
        }

        return null;
    };

    cookie.del = function (key, path) {
        cookie.set(key, "", -1, path);
    };

    //
    var session = lynkui.session;

    session.set = function (key, val) {
        sessionStorage.setItem(key, val);
    };

    session.get = function (key) {
        return sessionStorage.getItem(key);
    };

    session.del = function (key) {
        sessionStorage.removeItem(key);
    };

    session.delByPrefix = function (prefix) {
        var prelen = prefix.length;
        var qs = {};

        for (var i = 0, len = sessionStorage.length; i < len; i++) {
            if (sessionStorage.key(i).slice(0, prelen) == prefix) {
                qs[i] = sessionStorage.key(i);
            }
        }

        for (var i in qs) {
            sessionStorage.removeItem(qs[i]);
        }
    };

    //
    var storage = lynkui.storage;

    storage.set = function (key, val) {
        localStorage.setItem(key, val);
    };

    storage.get = function (key) {
        return localStorage.getItem(key);
    };

    storage.del = function (key) {
        localStorage.removeItem(key);
    };

    storage.delByPrefix = function (prefix) {
        if (!prefix) {
            return;
        }

        var prelen = prefix.length;
        var qs = {};

        for (var i = 0, len = localStorage.length; i < len; i++) {
            if (localStorage.key(i).slice(0, prelen) == prefix) {
                qs[i] = localStorage.key(i);
            }
        }

        for (var i in qs) {
            localStorage.removeItem(qs[i]);
        }
    };

    var sessionData = lynkui.sessionData;

    sessionData.set = function (key, val) {
        session.set(key, val);
        storage.set(key, val);
    };

    sessionData.get = function (key) {
        var val = session.get(key);
        if (!val) {
            val = storage.get(key);
        }
        return val;
    };

    sessionData.del = function (key) {
        session.del(key);
        storage.del(key);
    };

    //
    var lang = lynkui.lang;

    lang.sync = function (items, lang) {
        if (!items || items.length < 1) {
            return;
        }
        if (!lang) {
            lang = "en";
        }
        lang.data.lang = lang;
        for (var i in items) {
            lang.data.items[items[i].key] = items[i].val;
        }
    };

    lang.T = function () {
        if (arguments && arguments.length > 0) {
            var text = lang.data.items[arguments[0].toLowerCase().trim()];
            if (text && text.length > 0) {
                arguments[0] = text;
            }
        }
        return _sprintf.apply(this, arguments);
    };

    lang.TR = function (text) {
        return text.replace(/{%([^%}]+)?%}/g, function (key) {
            return _sprintf.call(this, key.replace(/[{%%}]+/g, ""));
        });
    };

    var url = lynkui.url;

    url.eventRegister = function (name, func, pid) {
        if (!url.clickEnable) {
            $(document).on("click", ".lynkui-nav-item", function () {
                lynkui.url.eventHandler($(this));
                // console.log($(this));
            });
            url.clickEnable = true;
        }

        if (!pid) {
            pid = "lynkui-layout-module-navbar";
        }
        if (!name || typeof name != "string" || !func || typeof func != "function") {
            return;
        }

        url.evs[name] = {
            func: func,
            pid: pid,
        };
    };

    url.eventClean = function (pid) {
        if (!pid) {
            return;
        }

        for (var i in url.evs) {
            if (pid == url.evs[i].pid) {
                delete url.evs[i];
            }
            if (i == url.evc) {
                url.evc = null;
            }
        }
    };

    url.eventActive = function (nav_target) {
        url._event_action(nav_target, null, false);
    };

    url.eventHandler = function (nav_target, auto_prev) {
        url._event_action(nav_target, auto_prev, true);
    };

    url._event_action = function (nav_target, auto_prev, call_func) {
        var nav_name = "";
        if (typeof nav_target == "string") {
            nav_name = nav_target.replace("#", "");
            nav_target = $("body").find("a[href='#" + nav_name + "']");
        }

        if (typeof nav_target != "object") {
            return;
        }

        if (nav_name.length < 1) {
            nav_name = nav_target.attr("href");
            if (!nav_name) {
                nav_name = nav_target.find("a").attr("href");
            }
            if (!nav_name) {
                return;
            }
            nav_name = nav_name.replace("#", "");
        }

        if (nav_name == url.evc) {
            return;
        }

        // $(this).closest("ul").find("a.active").removeClass("active");
        // $(this).addClass("active");

        // name = name.replace("#", "");
        // var name = location.hash.replace("#", "");
        // if (!name) {
        //     return;
        // }

        if (url.evs[nav_name]) {
            if (url.evs[nav_name].pid) {
                if (auto_prev) {
                    var nav_prev = lynkui.storage.get("lynkui_" + url.evs[nav_name].pid);
                    if (nav_prev) {
                        if (url.evs[nav_prev]) {
                            if (call_func) {
                                url.evs[nav_prev].func(nav_prev);
                            }
                            url.evc = nav_prev;
                            var prev_tg = $("body").find("a[href='#" + nav_prev + "']");
                            if (prev_tg) {
                                prev_tg.parent().find(".active:first").removeClass("active");
                                prev_tg.addClass("active");
                            }

                            return;
                        }
                    }
                }

                var elem = $("#" + url.evs[nav_name].pid);
                if (elem) {
                    elem.find(".active:first").removeClass("active");
                    // elem.find("a[href='#"+ nav_name +"']").addClass("active");
                    nav_target.addClass("active");
                    lynkui.storage.set("lynkui_" + url.evs[nav_name].pid, nav_name);
                }
            } else {
                // nav_name.closest("ul").find("a.active:first").removeClass("active");
                nav_target.parent().find(".active:first").removeClass("active");
                nav_target.addClass("active");
            }

            if (call_func) {
                url.evs[nav_name].func(nav_name);
            }
            url.evc = nav_name;
        }
    };

    url.eventChanged = function () {
        return false;
    };

    //
    var layout = lynkui.layout;
    layout.template = function (name, cb) {
        lynkui.utilx.ajax("lynkui/tpl/layout-" + name + ".htm", {
            callback: cb,
        });
    };
    layout.render = function (name, data, cb) {
        //
        if (name != "std") {
            name = "std";
        }

        //
        data = data || {};
        data.navbar_brand = data.navbar_brand || {};
        data.navbar_nav = data.navbar_nav || {};
        data.navbar_nav.items = data.navbar_nav.items || [];
        data.navbar_nav.active = null;
        if (!data.navbar_nav.active && data.navbar_nav.items.length > 0) {
            data.navbar_nav.active = data.navbar_nav.items[0].path;
        }

        //
        lynkui.template.render({
            dstid: "lynkui-body",
            tplurl: "lynkui/tpl/layout-" + name + ".htm",
            callback: function (err) {
                lynkui.template.render({
                    dstid: "lynkui-layout-navbar",
                    tplid: "lynkui-layout-navbar-tpl",
                    data: data,
                });
                if (cb) {
                    cb();
                }
            },
        });
    };

    layout.moduleNavbarMenu = function (name, items, active) {
        if (!items || items.length < 1) {
            return;
        }
        items = lynkui.utilx.objectClone(items);

        var elem = document.getElementById("lynkui-layout-module-navbar-items");
        if (!elem) {
            return;
        }

        layout.module_navbar_menu_active = null;

        var ctn = "";
        for (var i in items) {
            if (!items[i].uri) {
                continue;
            }
            if (!items[i].style) {
                items[i].style = "";
            }
            if (items[i].uri == active) {
                items[i].style += " active";
            }
            if (items[i].onclick) {
                items[i]._onclick = 'onclick="' + items[i].onclick + '"';
            } else {
                items[i]._onclick = "";
            }

            ctn += _sprintf(
                '<li class="nav-item"><a class="nav-link %s lynkui-nav-item" href="#%s" %s>%s</a></li>',
                items[i].style,
                items[i].uri,
                items[i]._onclick,
                items[i].title
            );
        }
        if (ctn == "") {
            $("#lynkui-layout-module-navbar").addClass("lynkui-base-hide");
            return;
        }
        $("#lynkui-layout-module-navbar-items").html(ctn);
        $("#lynkui-layout-module-navbar").removeClass("lynkui-base-hide");
        url.eventClean("lynkui-layout-module-navbar-items");
    };

    layout.moduleNavbarMenuRefresh = function (div_target, cb) {
        if (!div_target) {
            return;
        }

        var elem = document.getElementById(div_target);
        if (!elem) {
            return;
        }
        $("#lynkui-layout-module-navbar-items").html(elem.innerHTML);

        if (cb && typeof cb === "function") {
            cb(null);
        }
    };

    layout.moduleNavbarOpToolRefresh = function (div_target, cb) {
        if (!div_target) {
            return;
        }

        if (!cb || typeof cb !== "function") {
            cb = function () {};
        }

        if (typeof div_target == "string" && div_target == layout.module_navbar_optool_active) {
            return cb();
        }

        // $("#lynkui-layout-module-navbar-optools").empty();
        if (typeof div_target == "string") {
            var opt = $("#lynkui-body").find(div_target);
            if (opt) {
                // $("#lynkui-layout-module-navbar-optools").html(opt.html());
                lynkui.template.render({
                    dstid: "lynkui-layout-module-navbar-optools",
                    tplsrc: opt.html(),
                    data: {},
                    callback: cb,
                });
                layout.module_navbar_optool_active = div_target;
            }
        }
    };

    layout.moduleNavbarOpToolClean = function () {
        $("#lynkui-layout-module-navbar-optools").html("");
        layout.module_navbar_optool_active = null;
    };

    var template = lynkui.template;

    var _templateHTMLFlush = function (options, txt) {
        if (options.prepend) {
            $("#" + options.dstid).prepend(txt);
        } else if (options.append) {
            $("#" + options.dstid).append(txt);
        } else if (options.afterAppend) {
            $("#" + options.dstid).after(txt);
        } else if (options.beforeAppend) {
            $("#" + options.dstid).before(txt);
        } else {
            $("#" + options.dstid).html(txt);
        }
    };

    template.buttonRender = function (buttons) {
        var str = "";
        for (var i in buttons) {
            if (!buttons[i].title) {
                continue;
            }

            if (!buttons[i].style) {
                buttons[i].style = "btn-dark";
            }

            if (buttons[i].href) {
                str +=
                    "<a class='btn btn-small " +
                    buttons[i].style +
                    "' href='" +
                    buttons[i].href +
                    "'>" +
                    buttons[i].title +
                    "</a>";
            } else if (buttons[i].onclick) {
                str +=
                    "<button class='btn btn-small " +
                    buttons[i].style +
                    "' onclick='" +
                    buttons[i].onclick +
                    "'>" +
                    buttons[i].title +
                    "</button>";
            }
        }

        return str;
    };

    template.render = function (options) {
        options = options || {};
        if (typeof options.callback !== "function") {
            options.callback = function () {};
        }

        if (!options.dstid) {
            return options.callback("dstid can not found", null);
        }

        if (typeof options.data === "object" && options.data_hash_skip === true) {
            var hash_id = lynkui.utilx.cryptoMd5(JSON.stringify(options.data));
            if (
                lynkui.template.datasets[options.dstid] &&
                lynkui.template.datasets[options.dstid] == hash_id
            ) {
                return options.callback(null, null);
            }
            lynkui.template.datasets[hash_id] = hash_id;
        }

        if (!options.tplsrc && options.tplid) {
            var elem = document.getElementById(options.tplid);
            if (!elem) {
                return options.callback("tplid can not found", null);
            }
            options.tplsrc = elem.value || elem.innerHTML;
        }

        if (options.tplsrc) {
            if (options.i18n) {
                options.tplsrc = lang.TR(options.tplsrc);
            }

            if (options.data !== undefined) {
                var tempFn = doT.template(options.tplsrc);
                _templateHTMLFlush(options, tempFn(options.data));
            } else {
                _templateHTMLFlush(options, options.tplsrc);
            }

            return options.callback(null, null);
        } else if (typeof options.tplurl === "string") {
            lynkui.utilx.ajax(options.tplurl, {
                callback: function (err, rsp) {
                    if (err) {
                        return options.callback(err);
                    }
                    if (options.i18n) {
                        rsp = lynkui.lang.TR(rsp);
                    }

                    if (options.data) {
                        var tempFn = doT.template(rsp);
                        _templateHTMLFlush(options, tempFn(options.data));
                    } else {
                        _templateHTMLFlush(options, rsp);
                    }

                    return options.callback(null, null);
                },
            });
        }
    };
})(this);

//
var _sprintf = function () {
    //  discuss at: http://phpjs.org/functions/sprintf/
    // original by: Ash Searle (http://hexmen.com/blog/)
    // improved by: Michael White (http://getsprink.com)
    // improved by: Jack
    // improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // improved by: Dj
    // improved by: Allidylls
    //    input by: Paulo Freitas
    //    input by: Brett Zamir (http://brett-zamir.me)
    //   example 1: sprintf("%01.2f", 123.1);
    //   returns 1: 123.10
    //   example 2: sprintf("[%10s]", 'monkey');
    //   returns 2: '[    monkey]'
    //   example 3: sprintf("[%'#10s]", 'monkey');
    //   returns 3: '[####monkey]'
    //   example 4: sprintf("%d", 123456789012345);
    //   returns 4: '123456789012345'
    //   example 5: sprintf('%-03s', 'E');
    //   returns 5: 'E00'

    var regex =
        /%%|%(\d+\$)?([-+\'#0 ]*)(\*\d+\$|\*|\d+)?(\.(\*\d+\$|\*|\d+))?([scboxXuideEfFgG])/g;
    var a = arguments;
    var i = 0;
    var format = a[i++];

    // pad()
    var pad = function (str, len, chr, leftJustify) {
        if (!chr) {
            chr = " ";
        }
        var padding = str.length >= len ? "" : new Array((1 + len - str.length) >>> 0).join(chr);
        return leftJustify ? str + padding : padding + str;
    };

    // justify()
    var justify = function (value, prefix, leftJustify, minWidth, zeroPad, customPadChar) {
        var diff = minWidth - value.length;
        if (diff > 0) {
            if (leftJustify || !zeroPad) {
                value = pad(value, minWidth, customPadChar, leftJustify);
            } else {
                value =
                    value.slice(0, prefix.length) +
                    pad("", diff, "0", true) +
                    value.slice(prefix.length);
            }
        }
        return value;
    };

    // formatBaseX()
    var formatBaseX = function (value, base, prefix, leftJustify, minWidth, precision, zeroPad) {
        // Note: casts negative numbers to positive ones
        var number = value >>> 0;
        prefix =
            (prefix &&
                number &&
                {
                    2: "0b",
                    8: "0",
                    16: "0x",
                }[base]) ||
            "";
        value = prefix + pad(number.toString(base), precision || 0, "0", false);
        return justify(value, prefix, leftJustify, minWidth, zeroPad);
    };

    // formatString()
    var formatString = function (value, leftJustify, minWidth, precision, zeroPad, customPadChar) {
        if (precision != null) {
            value = value.slice(0, precision);
        }
        return justify(value, "", leftJustify, minWidth, zeroPad, customPadChar);
    };

    // doFormat()
    var doFormat = function (substring, valueIndex, flags, minWidth, _, precision, type) {
        var number, prefix, method, textTransform, value;

        if (substring === "%%") {
            return "%";
        }

        // parse flags
        var leftJustify = false;
        var positivePrefix = "";
        var zeroPad = false;
        var prefixBaseX = false;
        var customPadChar = " ";
        var flagsl = flags.length;
        for (var j = 0; flags && j < flagsl; j++) {
            switch (flags.charAt(j)) {
                case " ":
                    positivePrefix = " ";
                    break;
                case "+":
                    positivePrefix = "+";
                    break;
                case "-":
                    leftJustify = true;
                    break;
                case "'":
                    customPadChar = flags.charAt(j + 1);
                    break;
                case "0":
                    zeroPad = true;
                    customPadChar = "0";
                    break;
                case "#":
                    prefixBaseX = true;
                    break;
            }
        }

        // parameters may be null, undefined, empty-string or real valued
        // we want to ignore null, undefined and empty-string values
        if (!minWidth) {
            minWidth = 0;
        } else if (minWidth === "*") {
            minWidth = +a[i++];
        } else if (minWidth.charAt(0) == "*") {
            minWidth = +a[minWidth.slice(1, -1)];
        } else {
            minWidth = +minWidth;
        }

        // Note: undocumented perl feature:
        if (minWidth < 0) {
            minWidth = -minWidth;
            leftJustify = true;
        }

        if (!isFinite(minWidth)) {
            throw new Error("sprintf: (minimum-)width must be finite");
        }

        if (!precision) {
            precision = "fFeE".indexOf(type) > -1 ? 6 : type === "d" ? 0 : undefined;
        } else if (precision === "*") {
            precision = +a[i++];
        } else if (precision.charAt(0) == "*") {
            precision = +a[precision.slice(1, -1)];
        } else {
            precision = +precision;
        }

        // grab value using valueIndex if required?
        value = valueIndex ? a[valueIndex.slice(0, -1)] : a[i++];

        switch (type) {
            case "s":
                return formatString(
                    String(value),
                    leftJustify,
                    minWidth,
                    precision,
                    zeroPad,
                    customPadChar
                );
            case "c":
                return formatString(
                    String.fromCharCode(+value),
                    leftJustify,
                    minWidth,
                    precision,
                    zeroPad
                );
            case "b":
                return formatBaseX(
                    value,
                    2,
                    prefixBaseX,
                    leftJustify,
                    minWidth,
                    precision,
                    zeroPad
                );
            case "o":
                return formatBaseX(
                    value,
                    8,
                    prefixBaseX,
                    leftJustify,
                    minWidth,
                    precision,
                    zeroPad
                );
            case "x":
                return formatBaseX(
                    value,
                    16,
                    prefixBaseX,
                    leftJustify,
                    minWidth,
                    precision,
                    zeroPad
                );
            case "X":
                return formatBaseX(
                    value,
                    16,
                    prefixBaseX,
                    leftJustify,
                    minWidth,
                    precision,
                    zeroPad
                ).toUpperCase();
            case "u":
                return formatBaseX(
                    value,
                    10,
                    prefixBaseX,
                    leftJustify,
                    minWidth,
                    precision,
                    zeroPad
                );
            case "i":
            case "d":
                number = +value || 0;
                // Plain Math.round doesn't just truncate
                number = Math.round(number - (number % 1));
                prefix = number < 0 ? "-" : positivePrefix;
                value = prefix + pad(String(Math.abs(number)), precision, "0", false);
                return justify(value, prefix, leftJustify, minWidth, zeroPad);
            case "e":
            case "E":
            case "f": // Should handle locales (as per setlocale)
            case "F":
            case "g":
            case "G":
                number = +value;
                prefix = number < 0 ? "-" : positivePrefix;
                method = ["toExponential", "toFixed", "toPrecision"][
                    "efg".indexOf(type.toLowerCase())
                ];
                textTransform = ["toString", "toUpperCase"]["eEfFgG".indexOf(type) % 2];
                value = prefix + Math.abs(number)[method](precision);
                return justify(value, prefix, leftJustify, minWidth, zeroPad)[textTransform]();
            default:
                return substring;
        }
    };

    return format.replace(regex, doFormat);
};

// doT.js
// 2011-2014, Laura Doktorova, https://github.com/olado/doT
// Licensed under the MIT license.
(function (global, undefined) {
    "use strict";

	if (!global) {
		global = window;
	}
    if (global.doT) {
		return;
    }

    var doT = {
            version: "1.0.3",
            templateSettings: {
                evaluate: /\{\[([\s\S]+?(\}?)+)\]\}/g,
                interpolate: /\{\[=([\s\S]+?)\]\}/g,
                encode: /\{\[!([\s\S]+?)\]\}/g,
                use: /\{\[#([\s\S]+?)\]\}/g,
                useParams:
                    /(^|[^\w$])def(?:\.|\[[\'\"])([\w$\.]+)(?:[\'\"]\])?\s*\:\s*([\w$\.]+|\"[^\"]+\"|\'[^\']+\'|\{[^\}]+\})/g,
                define: /\{\[##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\]\}/g,
                defineParams: /^\s*([\w$]+):([\s\S]+)/,
                conditional: /\{\[\?(\?)?\s*([\s\S]*?)\s*\]\}/g,
                iterate: /\{\[~\s*(?:\]\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\]\})/g,
                varname: "it",
                strip: true,
                append: true,
                selfcontained: false,
                doNotSkipEncoded: false,
            },
            template: undefined, //fn, compile template
            compile: undefined, //fn, for express
        },
        _globals;

    global.doT = doT; 
    doT.encodeHTMLSource = function (doNotSkipEncoded) {
        var encodeHTMLRules = {
                "&": "&#38;",
                "<": "&#60;",
                ">": "&#62;",
                '"': "&#34;",
                "'": "&#39;",
                "/": "&#47;",
            },
            matchHTML = doNotSkipEncoded ? /[&<>"'\/]/g : /&(?!#?\w+;)|<|>|"|'|\//g;
        return function (code) {
            return code
                ? code.toString().replace(matchHTML, function (m) {
                      return encodeHTMLRules[m] || m;
                  })
                : "";
        };
    };

    _globals = (function () {
        return this || (0, eval)("this");
    })();

    if (typeof module !== "undefined" && module.exports) {
        module.exports = doT;
    } else if (typeof define === "function" && define.amd) {
        define(function () {
            return doT;
        });
    } else {
        _globals.doT = doT;
    }

    var startend = {
            append: {
                start: "'+(",
                end: ")+'",
                startencode: "'+encodeHTML(",
            },
            split: {
                start: "';out+=(",
                end: ");out+='",
                startencode: "';out+=encodeHTML(",
            },
        },
        skip = /$^/;

    function resolveDefs(c, block, def) {
        return (typeof block === "string" ? block : block.toString())
            .replace(c.define || skip, function (m, code, assign, value) {
                if (code.indexOf("def.") === 0) {
                    code = code.substring(4);
                }
                if (!(code in def)) {
                    if (assign === ":") {
                        if (c.defineParams)
                            value.replace(c.defineParams, function (m, param, v) {
                                def[code] = {
                                    arg: param,
                                    text: v,
                                };
                            });
                        if (!(code in def)) def[code] = value;
                    } else {
                        new Function("def", "def['" + code + "']=" + value)(def);
                    }
                }
                return "";
            })
            .replace(c.use || skip, function (m, code) {
                if (c.useParams)
                    code = code.replace(c.useParams, function (m, s, d, param) {
                        if (def[d] && def[d].arg && param) {
                            var rw = (d + ":" + param).replace(/'|\\/g, "_");
                            def.__exp = def.__exp || {};
                            def.__exp[rw] = def[d].text.replace(
                                new RegExp("(^|[^\\w$])" + def[d].arg + "([^\\w$])", "g"),
                                "$1" + param + "$2"
                            );
                            return s + "def.__exp['" + rw + "']";
                        }
                    });
                var v = new Function("def", "return " + code)(def);
                return v ? resolveDefs(c, v, def) : v;
            });
    }

    function unescape(code) {
        return code.replace(/\\('|\\)/g, "$1").replace(/[\r\t]/g, " ");
    }

    doT.template = function (tmpl, c, def) {
        c = c || doT.templateSettings;
        var cse = c.append ? startend.append : startend.split,
            needhtmlencode,
            sid = 0,
            indv,
            str = c.use || c.define ? resolveDefs(c, tmpl, def || {}) : tmpl;

        str = (
            "var out='" +
            (c.strip
                ? str
                      .replace(/(^|\r|)\t* +| +\t*(\r||$)/g, " ")
                      .replace(/\r||\t|\/\*[\s\S]*?\*\//g, "")
                : str
            )
                .replace(/'|\\/g, "\\$&")
                .replace(c.interpolate || skip, function (m, code) {
                    return cse.start + unescape(code) + cse.end;
                })
                .replace(c.encode || skip, function (m, code) {
                    needhtmlencode = true;
                    return cse.startencode + unescape(code) + cse.end;
                })
                .replace(c.conditional || skip, function (m, elsecase, code) {
                    return elsecase
                        ? code
                            ? "';}else if(" + unescape(code) + "){out+='"
                            : "';}else{out+='"
                        : code
                          ? "';if(" + unescape(code) + "){out+='"
                          : "';}out+='";
                })
                .replace(c.iterate || skip, function (m, iterate, vname, iname) {
                    if (!iterate) return "';} } out+='";
                    sid += 1;
                    indv = iname || "i" + sid;
                    iterate = unescape(iterate);
                    return (
                        "';var arr" +
                        sid +
                        "=" +
                        iterate +
                        ";if(arr" +
                        sid +
                        "){var " +
                        vname +
                        "," +
                        indv +
                        "=-1,l" +
                        sid +
                        "=arr" +
                        sid +
                        ".length-1;while(" +
                        indv +
                        "<l" +
                        sid +
                        "){" +
                        vname +
                        "=arr" +
                        sid +
                        "[" +
                        indv +
                        "+=1];out+='"
                    );
                })
                .replace(c.evaluate || skip, function (m, code) {
                    return "';" + unescape(code) + "out+='";
                }) +
            "';return out;"
        )
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t")
            .replace(/\r/g, "\\r")
            .replace(/(\s|;|\}|^|\{)out\+='';/g, "$1")
            .replace(/\+''/g, "");
        //.replace(/(\s|;|\}|^|\{)out\+=''\+/g,'$1out+=');

        if (needhtmlencode) {
            if (!c.selfcontained && _globals && !_globals._encodeHTML)
                _globals._encodeHTML = doT.encodeHTMLSource(c.doNotSkipEncoded);
            str =
                "var encodeHTML = typeof _encodeHTML !== 'undefined' ? _encodeHTML : (" +
                doT.encodeHTMLSource.toString() +
                "(" +
                (c.doNotSkipEncoded || "") +
                "));" +
                str;
        }
        try {
            return new Function(c.varname, str);
        } catch (e) {
            if (typeof console !== "undefined")
                console.log("Could not create a template function: " + str);
            throw e;
        }
    };

    doT.compile = function (tmpl, def) {
        return doT.template(tmpl, null, def);
    };
})(this);

/**
 * Sea.js 2.2.3 | seajs.org/LICENSE.md
 */
(function (global, undefined) {
	if (!global) {
		global = window;
	}
    // Avoid conflicting when `sea.js` is loaded multiple times
    if (global.seajs) {
        return;
    }

    var seajs = (global.seajs = {
        // The current version of Sea.js being used
        version: "2.2.3",
    });

    var data = (seajs.data = {});

    /**
     * util-lang.js - The minimal language enhancement
     */

    function isType(type) {
        return function (obj) {
            return {}.toString.call(obj) == "[object " + type + "]";
        };
    }

    var isObject = isType("Object");
    var isString = isType("String");
    var isArray = Array.isArray || isType("Array");
    var isFunction = isType("Function");
    var isUndefined = isType("Undefined");

    var _cid = 0;

    function cid() {
        return _cid++;
    }

    /**
     * util-events.js - The minimal events support
     */

    var events = (data.events = {});

    // Bind event
    seajs.on = function (name, callback) {
        var list = events[name] || (events[name] = []);
        list.push(callback);
        return seajs;
    };

    // Remove event. If `callback` is undefined, remove all callbacks for the
    // event. If `event` and `callback` are both undefined, remove all callbacks
    // for all events
    seajs.off = function (name, callback) {
        // Remove *all* events
        if (!(name || callback)) {
            events = data.events = {};
            return seajs;
        }

        var list = events[name];
        if (list) {
            if (callback) {
                for (var i = list.length - 1; i >= 0; i--) {
                    if (list[i] === callback) {
                        list.splice(i, 1);
                    }
                }
            } else {
                delete events[name];
            }
        }

        return seajs;
    };

    // Emit event, firing all bound callbacks. Callbacks receive the same
    // arguments as `emit` does, apart from the event name
    var emit = (seajs.emit = function (name, data) {
        var list = events[name],
            fn;

        if (list) {
            // Copy callback lists to prevent modification
            list = list.slice();

            // Execute event callbacks
            while ((fn = list.shift())) {
                fn(data);
            }
        }

        return seajs;
    });

    /**
     * util-path.js - The utilities for operating path such as id, uri
     */

    var DIRNAME_RE = /[^?#]*\//;

    var DOT_RE = /\/\.\//g;
    var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//;
    var DOUBLE_SLASH_RE = /([^:/])\/\//g;

    // Extract the directory portion of a path
    // dirname("a/b/c.js?t=123#xx/zz") ==> "a/b/"
    // ref: http://jsperf.com/regex-vs-split/2
    function dirname(path) {
        return path.match(DIRNAME_RE)[0];
    }

    // Canonicalize a path
    // realpath("http://test.com/a//./b/../c") ==> "http://test.com/a/c"
    function realpath(path) {
        // /a/b/./c/./d ==> /a/b/c/d
        path = path.replace(DOT_RE, "/");

        // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
        while (path.match(DOUBLE_DOT_RE)) {
            path = path.replace(DOUBLE_DOT_RE, "/");
        }

        // a//b/c  ==>  a/b/c
        path = path.replace(DOUBLE_SLASH_RE, "$1/");

        return path;
    }

    // Normalize an id
    // normalize("path/to/a") ==> "path/to/a.js"
    // NOTICE: substring is faster than negative slice and RegExp
    function normalize(path) {
        var last = path.length - 1;
        var lastC = path.charAt(last);

        // If the uri ends with `#`, just return it without '#'
        if (lastC === "#") {
            return path.substring(0, last);
        }

        return path.substring(last - 2) === ".js" ||
            path.indexOf("?") > 0 ||
            path.substring(last - 3) === ".css" ||
            lastC === "/"
            ? path
            : path + ".js";
    }

    var PATHS_RE = /^([^/:]+)(\/.+)$/;
    var VARS_RE = /{([^{]+)}/g;

    function parseAlias(id) {
        var alias = data.alias;
        return alias && isString(alias[id]) ? alias[id] : id;
    }

    function parsePaths(id) {
        var paths = data.paths;
        var m;

        if (paths && (m = id.match(PATHS_RE)) && isString(paths[m[1]])) {
            id = paths[m[1]] + m[2];
        }

        return id;
    }

    function parseVars(id) {
        var vars = data.vars;

        if (vars && id.indexOf("{") > -1) {
            id = id.replace(VARS_RE, function (m, key) {
                return isString(vars[key]) ? vars[key] : m;
            });
        }

        return id;
    }

    function parseMap(uri) {
        var map = data.map;
        var ret = uri;

        if (map) {
            for (var i = 0, len = map.length; i < len; i++) {
                var rule = map[i];

                ret = isFunction(rule) ? rule(uri) || uri : uri.replace(rule[0], rule[1]);

                // Only apply the first matched rule
                if (ret !== uri) break;
            }
        }

        return ret;
    }

    var ABSOLUTE_RE = /^\/\/.|:\//;
    var ROOT_DIR_RE = /^.*?\/\/.*?\//;

    function addBase(id, refUri) {
        var ret;
        var first = id.charAt(0);

        // Absolute
        if (ABSOLUTE_RE.test(id)) {
            ret = id;
        }
        // Relative
        else if (first === ".") {
            ret = realpath((refUri ? dirname(refUri) : data.cwd) + id);
        }
        // Root
        else if (first === "/") {
            var m = data.cwd.match(ROOT_DIR_RE);
            ret = m ? m[0] + id.substring(1) : id;
        }
        // Top-level
        else {
            ret = data.base + id;
        }

        // Add default protocol when uri begins with "//"
        if (ret.indexOf("//") === 0) {
            ret = location.protocol + ret;
        }

        return ret;
    }

    function id2Uri(id, refUri) {
        if (!id) return "";

        id = parseAlias(id);
        id = parsePaths(id);
        id = parseVars(id);
        id = normalize(id);

        var uri = addBase(id, refUri);
        uri = parseMap(uri);

        return uri;
    }

    var doc = document;
    var cwd = dirname(doc.URL);
    var scripts = doc.scripts;

    // Recommend to add `seajsnode` id for the `sea.js` script element
    var loaderScript = doc.getElementById("seajsnode") || scripts[scripts.length - 1];

    // When `sea.js` is inline, set loaderDir to current working directory
    var loaderDir = dirname(getScriptAbsoluteSrc(loaderScript) || cwd);

    function getScriptAbsoluteSrc(node) {
        return node.hasAttribute // non-IE6/7
            ? node.src // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
            : node.getAttribute("src", 4);
    }

    // For Developers
    seajs.resolve = id2Uri;

    /**
     * util-request.js - The utilities for requesting script and style files
     * ref: tests/research/load-js-css/test.html
     */

    var head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement;
    var baseElement = head.getElementsByTagName("base")[0];

    var IS_CSS_RE = /\.css(?:\?|$)/i;
    var currentlyAddingScript;
    var interactiveScript;

    // `onload` event is not supported in WebKit < 535.23 and Firefox < 9.0
    // ref:
    //  - https://bugs.webkit.org/show_activity.cgi?id=38995
    //  - https://bugzilla.mozilla.org/show_bug.cgi?id=185236
    //  - https://developer.mozilla.org/en/HTML/Element/link#Stylesheet_load_events
    var isOldWebKit =
        +navigator.userAgent.replace(/.*(?:AppleWebKit|AndroidWebKit)\/(\d+).*/, "$1") < 536;

    function request(url, callback, charset, crossorigin) {
        var isCSS = IS_CSS_RE.test(url);
        var node = doc.createElement(isCSS ? "link" : "script");

        if (charset) {
            node.charset = charset;
        }

        // crossorigin default value is `false`.
        if (!isUndefined(crossorigin)) {
            node.setAttribute("crossorigin", crossorigin);
        }

        addOnload(node, callback, isCSS, url);

        if (isCSS) {
            node.rel = "stylesheet";
            node.href = url;
        } else {
            node.async = true;
            node.src = url;
        }

        // For some cache cases in IE 6-8, the script executes IMMEDIATELY after
        // the end of the insert execution, so use `currentlyAddingScript` to
        // hold current node, for deriving url in `define` call
        currentlyAddingScript = node;

        // ref: #185 & http://dev.jquery.com/ticket/2709
        baseElement ? head.insertBefore(node, baseElement) : head.appendChild(node);

        currentlyAddingScript = null;
    }

    function addOnload(node, callback, isCSS, url) {
        var supportOnload = "onload" in node;

        // for Old WebKit and Old Firefox
        if (isCSS && (isOldWebKit || !supportOnload)) {
            setTimeout(function () {
                pollCss(node, callback);
            }, 1); // Begin after node insertion
            return;
        }

        if (supportOnload) {
            node.onload = onload;
            node.onerror = function () {
                emit("error", {
                    uri: url,
                    node: node,
                });
                onload();
            };
        } else {
            node.onreadystatechange = function () {
                if (/loaded|complete/.test(node.readyState)) {
                    onload();
                }
            };
        }

        function onload() {
            // Ensure only run once and handle memory leak in IE
            node.onload = node.onerror = node.onreadystatechange = null;

            // Remove the script to reduce memory leak
            if (!isCSS && !data.debug) {
                head.removeChild(node);
            }

            // Dereference the node
            node = null;

            callback();
        }
    }

    function pollCss(node, callback) {
        var sheet = node.sheet;
        var isLoaded;

        // for WebKit < 536
        if (isOldWebKit) {
            if (sheet) {
                isLoaded = true;
            }
        }
        // for Firefox < 9.0
        else if (sheet) {
            try {
                if (sheet.cssRules) {
                    isLoaded = true;
                }
            } catch (ex) {
                // The value of `ex.name` is changed from "NS_ERROR_DOM_SECURITY_ERR"
                // to "SecurityError" since Firefox 13.0. But Firefox is less than 9.0
                // in here, So it is ok to just rely on "NS_ERROR_DOM_SECURITY_ERR"
                if (ex.name === "NS_ERROR_DOM_SECURITY_ERR") {
                    isLoaded = true;
                }
            }
        }

        setTimeout(function () {
            if (isLoaded) {
                // Place callback here to give time for style rendering
                callback();
            } else {
                pollCss(node, callback);
            }
        }, 20);
    }

    function getCurrentScript() {
        if (currentlyAddingScript) {
            return currentlyAddingScript;
        }

        // For IE6-9 browsers, the script onload event may not fire right
        // after the script is evaluated. Kris Zyp found that it
        // could query the script nodes and the one that is in "interactive"
        // mode indicates the current script
        // ref: http://goo.gl/JHfFW
        if (interactiveScript && interactiveScript.readyState === "interactive") {
            return interactiveScript;
        }

        var scripts = head.getElementsByTagName("script");

        for (var i = scripts.length - 1; i >= 0; i--) {
            var script = scripts[i];
            if (script.readyState === "interactive") {
                interactiveScript = script;
                return interactiveScript;
            }
        }
    }

    // For Developers
    seajs.request = request;

    /**
     * util-deps.js - The parser for dependencies
     * ref: tests/research/parse-dependencies/test.html
     */

    var REQUIRE_RE =
        /"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|\/\*[\S\s]*?\*\/|\/(?:\\\/|[^\/\r])+\/(?=[^\/])|\/\/.*|\.\s*require|(?:^|[^$])\brequire\s*\(\s*(["'])(.+?)\1\s*\)/g;
    var SLASH_RE = /\\\\/g;

    function parseDependencies(code) {
        var ret = [];

        code.replace(SLASH_RE, "").replace(REQUIRE_RE, function (m, m1, m2) {
            if (m2) {
                ret.push(m2);
            }
        });

        return ret;
    }

    /**
     * module.js - The core of module loader
     */

    var cachedMods = (seajs.cache = {});
    var anonymousMeta;

    var fetchingList = {};
    var fetchedList = {};
    var callbackList = {};

    var STATUS = (Module.STATUS = {
        // 1 - The `module.uri` is being fetched
        FETCHING: 1,
        // 2 - The meta data has been saved to cachedMods
        SAVED: 2,
        // 3 - The `module.dependencies` are being loaded
        LOADING: 3,
        // 4 - The module are ready to execute
        LOADED: 4,
        // 5 - The module is being executed
        EXECUTING: 5,
        // 6 - The `module.exports` is available
        EXECUTED: 6,
    });

    function Module(uri, deps) {
        this.uri = uri;
        this.dependencies = deps || [];
        this.exports = null;
        this.status = 0;

        // Who depends on me
        this._waitings = {};

        // The number of unloaded dependencies
        this._remain = 0;
    }

    // Resolve module.dependencies
    Module.prototype.resolve = function () {
        var mod = this;
        var ids = mod.dependencies;
        var uris = [];

        for (var i = 0, len = ids.length; i < len; i++) {
            uris[i] = Module.resolve(ids[i], mod.uri);
        }
        return uris;
    };

    // Load module.dependencies and fire onload when all done
    Module.prototype.load = function () {
        var mod = this;

        // If the module is being loaded, just wait it onload call
        if (mod.status >= STATUS.LOADING) {
            return;
        }

        mod.status = STATUS.LOADING;

        // Emit `load` event for plugins such as combo plugin
        var uris = mod.resolve();
        emit("load", uris);

        var len = (mod._remain = uris.length);
        var m;

        // Initialize modules and register waitings
        for (var i = 0; i < len; i++) {
            m = Module.get(uris[i]);

            if (m.status < STATUS.LOADED) {
                // Maybe duplicate: When module has dupliate dependency, it should be it's count, not 1
                m._waitings[mod.uri] = (m._waitings[mod.uri] || 0) + 1;
            } else {
                mod._remain--;
            }
        }

        if (mod._remain === 0) {
            mod.onload();
            return;
        }

        // Begin parallel loading
        var requestCache = {};

        for (i = 0; i < len; i++) {
            m = cachedMods[uris[i]];

            if (m.status < STATUS.FETCHING) {
                m.fetch(requestCache);
            } else if (m.status === STATUS.SAVED) {
                m.load();
            }
        }

        // Send all requests at last to avoid cache bug in IE6-9. Issues#808
        for (var requestUri in requestCache) {
            if (requestCache.hasOwnProperty(requestUri)) {
                requestCache[requestUri]();
            }
        }
    };

    // Call this method when module is loaded
    Module.prototype.onload = function () {
        var mod = this;
        mod.status = STATUS.LOADED;

        if (mod.callback) {
            mod.callback();
        }

        // Notify waiting modules to fire onload
        var waitings = mod._waitings;
        var uri, m;

        for (uri in waitings) {
            if (waitings.hasOwnProperty(uri)) {
                m = cachedMods[uri];
                m._remain -= waitings[uri];
                if (m._remain === 0) {
                    m.onload();
                }
            }
        }

        // Reduce memory taken
        delete mod._waitings;
        delete mod._remain;
    };

    // Fetch a module
    Module.prototype.fetch = function (requestCache) {
        var mod = this;
        var uri = mod.uri;

        mod.status = STATUS.FETCHING;

        // Emit `fetch` event for plugins such as combo plugin
        var emitData = {
            uri: uri,
        };
        emit("fetch", emitData);
        var requestUri = emitData.requestUri || uri;

        // Empty uri or a non-CMD module
        if (!requestUri || fetchedList[requestUri]) {
            mod.load();
            return;
        }

        if (fetchingList[requestUri]) {
            callbackList[requestUri].push(mod);
            return;
        }

        fetchingList[requestUri] = true;
        callbackList[requestUri] = [mod];

        // Emit `request` event for plugins such as text plugin
        emit(
            "request",
            (emitData = {
                uri: uri,
                requestUri: requestUri,
                onRequest: onRequest,
                charset: isFunction(data.charset) ? data.charset(requestUri) : data.charset,
                crossorigin: isFunction(data.crossorigin)
                    ? data.crossorigin(requestUri)
                    : data.crossorigin,
            })
        );

        if (!emitData.requested) {
            requestCache ? (requestCache[emitData.requestUri] = sendRequest) : sendRequest();
        }

        function sendRequest() {
            seajs.request(
                emitData.requestUri,
                emitData.onRequest,
                emitData.charset,
                emitData.crossorigin
            );
        }

        function onRequest() {
            delete fetchingList[requestUri];
            fetchedList[requestUri] = true;

            // Save meta data of anonymous module
            if (anonymousMeta) {
                Module.save(uri, anonymousMeta);
                anonymousMeta = null;
            }

            // Call callbacks
            var m,
                mods = callbackList[requestUri];
            delete callbackList[requestUri];
            while ((m = mods.shift())) m.load();
        }
    };

    // Execute a module
    Module.prototype.exec = function () {
        var mod = this;

        // When module is executed, DO NOT execute it again. When module
        // is being executed, just return `module.exports` too, for avoiding
        // circularly calling
        if (mod.status >= STATUS.EXECUTING) {
            return mod.exports;
        }

        mod.status = STATUS.EXECUTING;

        // Create require
        var uri = mod.uri;

        function require(id) {
            return Module.get(require.resolve(id)).exec();
        }

        require.resolve = function (id) {
            return Module.resolve(id, uri);
        };

        require.async = function (ids, callback) {
            Module.use(ids, callback, uri + "_async_" + cid());
            return require;
        };

        // Exec factory
        var factory = mod.factory;

        var exports = isFunction(factory) ? factory(require, (mod.exports = {}), mod) : factory;

        if (exports === undefined) {
            exports = mod.exports;
        }

        // Reduce memory leak
        delete mod.factory;

        mod.exports = exports;
        mod.status = STATUS.EXECUTED;

        // Emit `exec` event
        emit("exec", mod);

        return exports;
    };

    // Resolve id to uri
    Module.resolve = function (id, refUri) {
        // Emit `resolve` event for plugins such as text plugin
        var emitData = {
            id: id,
            refUri: refUri,
        };
        emit("resolve", emitData);

        return emitData.uri || seajs.resolve(emitData.id, refUri);
    };

    // Define a module
    Module.define = function (id, deps, factory) {
        var argsLen = arguments.length;

        // define(factory)
        if (argsLen === 1) {
            factory = id;
            id = undefined;
        } else if (argsLen === 2) {
            factory = deps;

            // define(deps, factory)
            if (isArray(id)) {
                deps = id;
                id = undefined;
            }
            // define(id, factory)
            else {
                deps = undefined;
            }
        }

        // Parse dependencies according to the module factory code
        if (!isArray(deps) && isFunction(factory)) {
            deps = parseDependencies(factory.toString());
        }

        var meta = {
            id: id,
            uri: Module.resolve(id),
            deps: deps,
            factory: factory,
        };

        // Try to derive uri in IE6-9 for anonymous modules
        if (!meta.uri && doc.attachEvent) {
            var script = getCurrentScript();

            if (script) {
                meta.uri = script.src;
            }

            // NOTE: If the id-deriving methods above is failed, then falls back
            // to use onload event to get the uri
        }

        // Emit `define` event, used in nocache plugin, seajs node version etc
        emit("define", meta);

        meta.uri
            ? Module.save(meta.uri, meta) // Save information for "saving" work in the script onload event
            : (anonymousMeta = meta);
    };

    // Save meta data to cachedMods
    Module.save = function (uri, meta) {
        var mod = Module.get(uri);

        // Do NOT override already saved modules
        if (mod.status < STATUS.SAVED) {
            mod.id = meta.id || uri;
            mod.dependencies = meta.deps || [];
            mod.factory = meta.factory;
            mod.status = STATUS.SAVED;
        }
    };

    // Get an existed module or create a new one
    Module.get = function (uri, deps) {
        return cachedMods[uri] || (cachedMods[uri] = new Module(uri, deps));
    };

    // Use function is equal to load a anonymous module
    Module.use = function (ids, callback, uri) {
        var mod = Module.get(uri, isArray(ids) ? ids : [ids]);

        mod.callback = function () {
            var exports = [];
            var uris = mod.resolve();

            for (var i = 0, len = uris.length; i < len; i++) {
                exports[i] = cachedMods[uris[i]].exec();
            }

            if (callback) {
                callback.apply(global, exports);
            }

            delete mod.callback;
        };

        mod.load();
    };

    // Load preload modules before all other modules
    Module.preload = function (callback) {
        var preloadMods = data.preload;
        var len = preloadMods.length;

        if (len) {
            Module.use(
                preloadMods,
                function () {
                    // Remove the loaded preload modules
                    preloadMods.splice(0, len);

                    // Allow preload modules to add new preload modules
                    Module.preload(callback);
                },
                data.cwd + "_preload_" + cid()
            );
        } else {
            callback();
        }
    };

    // Public API

    seajs.use = function (ids, callback) {
        Module.preload(function () {
            Module.use(ids, callback, data.cwd + "_use_" + cid());
        });
        return seajs;
    };

    Module.define.cmd = {};
    global.define = Module.define;

    // For Developers

    seajs.Module = Module;
    data.fetchedList = fetchedList;
    data.cid = cid;

    seajs.require = function (id) {
        var mod = Module.get(Module.resolve(id));
        if (mod.status < STATUS.EXECUTING) {
            mod.onload();
            mod.exec();
        }
        return mod.exports;
    };

    /**
     * config.js - The configuration for the loader
     */

    var BASE_RE = /^(.+?\/)(\?\?)?(seajs\/)+/;

    // The root path to use for id2uri parsing
    // If loaderUri is `http://test.com/libs/seajs/[??][seajs/1.2.3/]sea.js`, the
    // baseUri should be `http://test.com/libs/`
    data.base = (loaderDir.match(BASE_RE) || ["", loaderDir])[1];

    // The loader directory
    data.dir = loaderDir;

    // The current working directory
    data.cwd = cwd;

    // The charset for requesting files
    data.charset = "utf-8";

    // The history of every config
    data.history = {};

    // The CORS options, Do't set CORS on default.
    //data.crossorigin = undefined

    // Modules that are needed to load before all other modules
    data.preload = (function () {
        var plugins = [];

        // Convert `seajs-xxx` to `seajs-xxx=1`
        // NOTE: use `seajs-xxx=1` flag in uri or cookie to preload `seajs-xxx`
        var str = location.search.replace(/(seajs-\w+)(&|$)/g, "$1=1$2");

        // Add cookie string
        str += " " + doc.cookie;

        // Exclude seajs-xxx=0
        str.replace(/(seajs-\w+)=1/g, function (m, name) {
            plugins.push(name);
        });

        return plugins;
    })();

    // data.alias - An object containing shorthands of module id
    // data.paths - An object containing path shorthands in module id
    // data.vars - The {xxx} variables in module id
    // data.map - An array containing rules to map module uri
    // data.debug - Debug mode. The default value is false

    seajs.config = function (configData) {
        for (var key in configData) {
            var curr = configData[key];
            var prev = data[key];

            // record the config
            data.history[key] = data.history[key] || [];
            data.history[key].push(clone(curr));

            // Merge object config such as alias, vars
            if (prev && isObject(prev)) {
                for (var k in curr) {
                    prev[k] = curr[k];
                }
            } else {
                // Concat array config such as map, preload
                if (isArray(prev)) {
                    curr = prev.concat(curr);
                }
                // Make sure that `data.base` is an absolute path
                else if (key === "base") {
                    // Make sure end with "/"
                    if (curr.slice(-1) !== "/") {
                        curr += "/";
                    }
                    curr = addBase(curr);
                }

                // Set config
                data[key] = curr;
            }
        }

        emit("config", configData);
        return seajs;
    };

    // simple clone an object
    function clone(obj) {
        if (isObject(obj)) {
            var copy = {};
            for (var k in obj) {
                copy[k] = obj[k];
            }
            return copy;
        }
        return obj;
    }
})(this);

/**
 * EventProxy | https://github.com/JacksonTian/eventproxy/
 */
(function (global, undefined) {
    "use strict";
	if (!global) {
		global = window;
	}
    if (global.EventProxy) {
        return;
    }

    var debug = function () {};

    /*!
     * refs
     */
    var SLICE = Array.prototype.slice;
    var CONCAT = Array.prototype.concat;
    var ALL_EVENT = "__all__";

    /**
     * EventProxy. An implementation of task/event based asynchronous pattern.
     * A module that can be mixed in to *any object* in order to provide it with custom events.
     * You may `bind` or `unbind` a callback function to an event;
     * `trigger`-ing an event fires all callbacks in succession.
     * Examples:
     * ```js
     * var render = function (template, resources) {};
     * var proxy = new EventProxy();
     * proxy.assign("template", "l10n", render);
     * proxy.trigger("template", template);
     * proxy.trigger("l10n", resources);
     * ```
     */
    var EventProxy = (global.EventProxy = function () {
        if (!(this instanceof EventProxy)) {
            return new EventProxy();
        }
        this._callbacks = {};
        this._fired = {};
    });

    /**
     * Bind an event, specified by a string name, `ev`, to a `callback` function.
     * Passing __ALL_EVENT__ will bind the callback to all events fired.
     * Examples:
     * ```js
     * var proxy = new EventProxy();
     * proxy.addListener("template", function (event) {
     *   // TODO
     * });
     * ```
     * @param {String} eventname Event name.
     * @param {Function} callback Callback.
     */
    EventProxy.prototype.addListener = function (ev, callback) {
        debug("Add listener for %s", ev);
        this._callbacks[ev] = this._callbacks[ev] || [];
        this._callbacks[ev].push(callback);
        return this;
    };
    /**
     * `addListener` alias, `bind`
     */
    EventProxy.prototype.bind = EventProxy.prototype.addListener;
    /**
     * `addListener` alias, `on`
     */
    EventProxy.prototype.on = EventProxy.prototype.addListener;
    /**
     * `addListener` alias, `subscribe`
     */
    EventProxy.prototype.subscribe = EventProxy.prototype.addListener;

    /**
     * Bind an event, but put the callback into head of all callbacks.
     * @param {String} eventname Event name.
     * @param {Function} callback Callback.
     */
    EventProxy.prototype.headbind = function (ev, callback) {
        debug("Add listener for %s", ev);
        this._callbacks[ev] = this._callbacks[ev] || [];
        this._callbacks[ev].unshift(callback);
        return this;
    };

    /**
     * Remove one or many callbacks.
     *
     * - If `callback` is null, removes all callbacks for the event.
     * - If `eventname` is null, removes all bound callbacks for all events.
     * @param {String} eventname Event name.
     * @param {Function} callback Callback.
     */
    EventProxy.prototype.removeListener = function (eventname, callback) {
        var calls = this._callbacks;
        if (!eventname) {
            debug("Remove all listeners");
            this._callbacks = {};
        } else {
            if (!callback) {
                debug("Remove all listeners of %s", eventname);
                calls[eventname] = [];
            } else {
                var list = calls[eventname];
                if (list) {
                    var l = list.length;
                    for (var i = 0; i < l; i++) {
                        if (callback === list[i]) {
                            debug("Remove a listener of %s", eventname);
                            list[i] = null;
                        }
                    }
                }
            }
        }
        return this;
    };
    /**
     * `removeListener` alias, unbind
     */
    EventProxy.prototype.unbind = EventProxy.prototype.removeListener;

    /**
     * Remove all listeners. It equals unbind()
     * Just add this API for as same as Event.Emitter.
     * @param {String} event Event name.
     */
    EventProxy.prototype.removeAllListeners = function (event) {
        return this.unbind(event);
    };

    /**
     * Bind the ALL_EVENT event
     */
    EventProxy.prototype.bindForAll = function (callback) {
        this.bind(ALL_EVENT, callback);
    };

    /**
     * Unbind the ALL_EVENT event
     */
    EventProxy.prototype.unbindForAll = function (callback) {
        this.unbind(ALL_EVENT, callback);
    };

    /**
     * Trigger an event, firing all bound callbacks. Callbacks are passed the
     * same arguments as `trigger` is, apart from the event name.
     * Listening for `"all"` passes the true event name as the first argument.
     * @param {String} eventname Event name
     * @param {Mix} data Pass in data
     */
    EventProxy.prototype.trigger = function (eventname, data) {
        var list, ev, callback, args, i, l;
        var both = 2;
        var calls = this._callbacks;
        debug("Emit event %s with data %j", eventname, data);
        while (both--) {
            ev = both ? eventname : ALL_EVENT;
            list = calls[ev];
            if (list) {
                for (i = 0, l = list.length; i < l; i++) {
                    if (!(callback = list[i])) {
                        list.splice(i, 1);
                        i--;
                        l--;
                    } else {
                        args = both ? SLICE.call(arguments, 1) : arguments;
                        callback.apply(this, args);
                    }
                }
            }
        }
        return this;
    };

    /**
     * `trigger` alias
     */
    EventProxy.prototype.emit = EventProxy.prototype.trigger;
    /**
     * `trigger` alias
     */
    EventProxy.prototype.fire = EventProxy.prototype.trigger;

    /**
     * Bind an event like the bind method, but will remove the listener after it was fired.
     * @param {String} ev Event name
     * @param {Function} callback Callback
     */
    EventProxy.prototype.once = function (ev, callback) {
        var self = this;
        var wrapper = function () {
            callback.apply(self, arguments);
            self.unbind(ev, wrapper);
        };
        this.bind(ev, wrapper);
        return this;
    };

    var later =
        (typeof process !== "undefined" && process.nextTick) ||
        function (fn) {
            setTimeout(fn, 0);
        };

    /**
     * emitLater
     * make emit async
     */
    EventProxy.prototype.emitLater = function () {
        var self = this;
        var args = arguments;
        later(function () {
            self.trigger.apply(self, args);
        });
    };

    /**
     * Bind an event, and trigger it immediately.
     * @param {String} ev Event name.
     * @param {Function} callback Callback.
     * @param {Mix} data The data that will be passed to calback as arguments.
     */
    EventProxy.prototype.immediate = function (ev, callback, data) {
        this.bind(ev, callback);
        this.trigger(ev, data);
        return this;
    };
    /**
     * `immediate` alias
     */
    EventProxy.prototype.asap = EventProxy.prototype.immediate;

    var _assign = function (eventname1, eventname2, cb, once) {
        var proxy = this;
        var argsLength = arguments.length;
        var times = 0;
        var flag = {};

        // Check the arguments length.
        if (argsLength < 3) {
            return this;
        }

        var events = SLICE.call(arguments, 0, -2);
        var callback = arguments[argsLength - 2];
        var isOnce = arguments[argsLength - 1];

        // Check the callback type.
        if (typeof callback !== "function") {
            return this;
        }
        debug("Assign listener for events %j, once is %s", events, !!isOnce);
        var bind = function (key) {
            var method = isOnce ? "once" : "bind";
            proxy[method](key, function (data) {
                proxy._fired[key] = proxy._fired[key] || {};
                proxy._fired[key].data = data;
                if (!flag[key]) {
                    flag[key] = true;
                    times++;
                }
            });
        };

        var length = events.length;
        for (var index = 0; index < length; index++) {
            bind(events[index]);
        }

        var _all = function (event) {
            if (times < length) {
                return;
            }
            if (!flag[event]) {
                return;
            }
            var data = [];
            for (var index = 0; index < length; index++) {
                data.push(proxy._fired[events[index]].data);
            }
            if (isOnce) {
                proxy.unbindForAll(_all);
            }
            debug("Events %j all emited with data %j", events, data);
            callback.apply(null, data);
        };
        proxy.bindForAll(_all);
    };

    /**
     * Assign some events, after all events were fired, the callback will be executed once.
     *
     * Examples:
     * ```js
     * proxy.all(ev1, ev2, callback);
     * proxy.all([ev1, ev2], callback);
     * proxy.all(ev1, [ev2, ev3], callback);
     * ```
     * @param {String} eventname1 First event name.
     * @param {String} eventname2 Second event name.
     * @param {Function} callback Callback, that will be called after predefined events were fired.
     */
    EventProxy.prototype.all = function (eventname1, eventname2, callback) {
        var args = CONCAT.apply([], arguments);
        args.push(true);
        _assign.apply(this, args);
        return this;
    };
    /**
     * `all` alias
     */
    EventProxy.prototype.assign = EventProxy.prototype.all;

    /**
     * Assign the only one 'error' event handler.
     * @param {Function(err)} callback
     */
    EventProxy.prototype.fail = function (callback) {
        var that = this;
        that.once("error", function (err) {
            that.unbind();
            // put all arguments to the error handler
            // fail(function(err, args1, args2, ...){})
            callback.apply(null, arguments);
        });
        return this;
    };

    /**
     * Assign some events, after all events were fired, the callback will be executed first time.
     * Then any event that predefined be fired again, the callback will executed with the newest data.
     * Examples:
     * ```js
     * proxy.tail(ev1, ev2, callback);
     * proxy.tail([ev1, ev2], callback);
     * proxy.tail(ev1, [ev2, ev3], callback);
     * ```
     * @param {String} eventname1 First event name.
     * @param {String} eventname2 Second event name.
     * @param {Function} callback Callback, that will be called after predefined events were fired.
     */
    EventProxy.prototype.tail = function () {
        var args = CONCAT.apply([], arguments);
        args.push(false);
        _assign.apply(this, args);
        return this;
    };
    /**
     * `tail` alias, assignAll
     */
    EventProxy.prototype.assignAll = EventProxy.prototype.tail;
    /**
     * `tail` alias, assignAlways
     */
    EventProxy.prototype.assignAlways = EventProxy.prototype.tail;

    /**
     * The callback will be executed after the event be fired N times.
     * @param {String} eventname Event name.
     * @param {Number} times N times.
     * @param {Function} callback Callback, that will be called after event was fired N times.
     */
    EventProxy.prototype.after = function (eventname, times, callback) {
        if (times === 0) {
            callback.call(null, []);
            return this;
        }
        var proxy = this,
            firedData = [];
        this._after = this._after || {};
        var group = eventname + "_group";
        this._after[group] = {
            index: 0,
            results: [],
        };
        debug("After emit %s times, event %s's listenner will execute", times, eventname);
        var all = function (name, data) {
            if (name === eventname) {
                times--;
                firedData.push(data);
                if (times < 1) {
                    debug("Event %s was emit %s, and execute the listenner", eventname, times);
                    proxy.unbindForAll(all);
                    callback.apply(null, [firedData]);
                }
            }
            if (name === group) {
                times--;
                proxy._after[group].results[data.index] = data.result;
                if (times < 1) {
                    debug("Event %s was emit %s, and execute the listenner", eventname, times);
                    proxy.unbindForAll(all);
                    callback.call(null, proxy._after[group].results);
                }
            }
        };
        proxy.bindForAll(all);
        return this;
    };

    /**
     * The `after` method's helper. Use it will return ordered results.
     * If you need manipulate result, you need callback
     * Examples:
     * ```js
     * var ep = new EventProxy();
     * ep.after('file', files.length, function (list) {
     *   // Ordered results
     * });
     * for (var i = 0; i < files.length; i++) {
     *   fs.readFile(files[i], 'utf-8', ep.group('file'));
     * }
     * ```
     * @param {String} eventname Event name, shoule keep consistent with `after`.
     * @param {Function} callback Callback function, should return the final result.
     */
    EventProxy.prototype.group = function (eventname, callback) {
        var that = this;
        var group = eventname + "_group";
        var index = that._after[group].index;
        that._after[group].index++;
        return function (err, data) {
            if (err) {
                // put all arguments to the error handler
                return that.emit.apply(that, ["error"].concat(SLICE.call(arguments)));
            }
            that.emit(group, {
                index: index,
                // callback(err, args1, args2, ...)
                result: callback ? callback.apply(null, SLICE.call(arguments, 1)) : data,
            });
        };
    };

    /**
     * The callback will be executed after any registered event was fired. It only executed once.
     * @param {String} eventname1 Event name.
     * @param {String} eventname2 Event name.
     * @param {Function} callback The callback will get a map that has data and eventname attributes.
     */
    EventProxy.prototype.any = function () {
        var proxy = this,
            callback = arguments[arguments.length - 1],
            events = SLICE.call(arguments, 0, -1),
            _eventname = events.join("_");

        debug("Add listenner for Any of events %j emit", events);
        proxy.once(_eventname, callback);

        var _bind = function (key) {
            proxy.bind(key, function (data) {
                debug("One of events %j emited, execute the listenner");
                proxy.trigger(_eventname, {
                    data: data,
                    eventName: key,
                });
            });
        };

        for (var index = 0; index < events.length; index++) {
            _bind(events[index]);
        }
    };

    /**
     * The callback will be executed when the event name not equals with assigned event.
     * @param {String} eventname Event name.
     * @param {Function} callback Callback.
     */
    EventProxy.prototype.not = function (eventname, callback) {
        var proxy = this;
        debug("Add listenner for not event %s", eventname);
        proxy.bindForAll(function (name, data) {
            if (name !== eventname) {
                debug("listenner execute of event %s emit, but not event %s.", name, eventname);
                callback(data);
            }
        });
    };

    /**
     * Success callback wrapper, will handler err for you.
     *
     * ```js
     * fs.readFile('foo.txt', ep.done('content'));
     *
     * // equal to =>
     *
     * fs.readFile('foo.txt', function (err, content) {
     *   if (err) {
     *     return ep.emit('error', err);
     *   }
     *   ep.emit('content', content);
     * });
     * ```
     *
     * ```js
     * fs.readFile('foo.txt', ep.done('content', function (content) {
     *   return content.trim();
     * }));
     *
     * // equal to =>
     *
     * fs.readFile('foo.txt', function (err, content) {
     *   if (err) {
     *     return ep.emit('error', err);
     *   }
     *   ep.emit('content', content.trim());
     * });
     * ```
     * @param {Function|String} handler, success callback or event name will be emit after callback.
     * @return {Function}
     */
    EventProxy.prototype.done = function (handler, callback) {
        var that = this;
        return function (err, data) {
            if (err) {
                // put all arguments to the error handler
                return that.emit.apply(that, ["error"].concat(SLICE.call(arguments)));
            }

            // callback(err, args1, args2, ...)
            var args = SLICE.call(arguments, 1);

            if (typeof handler === "string") {
                // getAsync(query, ep.done('query'));
                // or
                // getAsync(query, ep.done('query', function (data) {
                //   return data.trim();
                // }));
                if (callback) {
                    // only replace the args when it really return a result
                    return that.emit(handler, callback.apply(null, args));
                } else {
                    // put all arguments to the done handler
                    //ep.done('some');
                    //ep.on('some', function(args1, args2, ...){});
                    return that.emit.apply(that, [handler].concat(args));
                }
            }

            // speed improve for mostly case: `callback(err, data)`
            if (arguments.length <= 2) {
                return handler(data);
            }

            // callback(err, args1, args2, ...)
            handler.apply(null, args);
        };
    };

    /**
     * make done async
     * @return {Function} delay done
     */
    EventProxy.prototype.doneLater = function (handler, callback) {
        var _doneHandler = this.done(handler, callback);
        return function (err, data) {
            var args = arguments;
            later(function () {
                _doneHandler.apply(null, args);
            });
        };
    };

    /**
     * Create a new EventProxy
     * Examples:
     * ```js
     * var ep = EventProxy.create();
     * ep.assign('user', 'articles', function(user, articles) {
     *   // do something...
     * });
     * // or one line ways: Create EventProxy and Assign
     * var ep = EventProxy.create('user', 'articles', function(user, articles) {
     *   // do something...
     * });
     * ```
     * @return {EventProxy} EventProxy instance
     */
    EventProxy.create = function () {
        var ep = new EventProxy();
        var args = CONCAT.apply([], arguments);
        if (args.length) {
            var errorHandler = args[args.length - 1];
            var callback = args[args.length - 2];
            if (typeof errorHandler === "function" && typeof callback === "function") {
                args.pop();
                ep.fail(errorHandler);
            }
            ep.assign.apply(ep, args);
        }
        return ep;
    };

    // Backwards compatibility
    EventProxy.EventProxy = EventProxy;

    return EventProxy;
})(this);
