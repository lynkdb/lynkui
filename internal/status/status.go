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

package status

import (
	"strings"
	"sync"

	"github.com/lynkdb/lynkui/go/lynkui"
)

var Assets = sets{
	items:    map[string]interface{}{},
	pagelets: map[string]*lynkui.Pagelet{},
}

type sets struct {
	mu       sync.Mutex
	items    map[string]interface{}
	pagelets map[string]*lynkui.Pagelet
}

func (it *sets) Pagelet(name string) *lynkui.Pagelet {
	it.mu.Lock()
	defer it.mu.Unlock()
	if pl, ok := it.pagelets[name]; ok {
		return pl
	}
	return nil
}

func (it *sets) SetPagelet(name string, vl *lynkui.Pagelet) {
	it.mu.Lock()
	defer it.mu.Unlock()
	it.pagelets[name] = vl
}

func (it *sets) Sync(name string, v interface{}) {
	it.mu.Lock()
	defer it.mu.Unlock()
	it.items[strings.TrimLeft(name, "/")] = v
}

func (it *sets) Get(name string) interface{} {
	it.mu.Lock()
	defer it.mu.Unlock()
	if v, ok := it.items[strings.TrimLeft(name, "/")]; ok {
		return v
	}
	return nil
}
