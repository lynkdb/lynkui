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

package lynkui

import (
	"github.com/lynkdb/lynkapi/go/lynkapi"
)

type ServiceConfig struct {
	AppProjectPath string `json:"app_project_path" toml:"app_project_path" yaml:"app_project_path"`
	UrlEntryPath   string `json:"url_entry_path" toml:"url_entry_path" yaml:"url_entry_path"`
	RunMode        string `json:"run_mode,omitempty" toml:"run_mode,omitempty" yaml:"run_mode,omitempty"`

	AssetsPath string `json:"-" toml:"-" yaml:"-"`
}

type MainObjectSet struct {
	LynkDict []*lynkapi.DataDict `json:"lynk_dict,omitempty" toml:"lynk_dict,omitempty" yaml:"lynk_dict,omitempty"`

	// LynkData []*lynkapi.DataDict `json:"lynk_data,omitempty" toml:"lynk_data,omitempty" yaml:"lynk_data,omitempty"`
}
