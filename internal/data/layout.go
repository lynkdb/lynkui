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

package data

import (
	"fmt"
	"io/ioutil"
	"os"
	"sync"

	"github.com/lynkdb/lynkapi/go/codec"
	"github.com/lynkdb/lynkapi/go/lynkapi"
	"github.com/lynkdb/lynkui/go/lynkui"
)

type LayoutManager struct {
	mu     sync.RWMutex
	layout lynkui.DataLayout

	tables map[string]*lynkui.DataLayout_VirtualTable

	instances map[string]*lynkapi.DataInstance
	services  map[string]lynkapi.DataService

	clients map[string]lynkapi.Client

	file    string
	flusher func() error
}

type TableActive struct {
	Spec *lynkapi.TableSpec
}

type DataService interface {
	Query(req *lynkapi.DataQuery) (*lynkapi.DataResult, error)
	Upsert(req *lynkapi.DataInsert) (*lynkapi.DataResult, error)
}

var Layout = &LayoutManager{
	tables:    map[string]*lynkui.DataLayout_VirtualTable{},
	instances: map[string]*lynkapi.DataInstance{},
	services:  map[string]lynkapi.DataService{},
	clients:   map[string]lynkapi.Client{},
}

func Init(file string) error {

	Layout.mu.Lock()
	defer Layout.mu.Unlock()

	b, err := ioutil.ReadFile(file)
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	if err == nil {
		if err = codec.Json.Decode(b, &Layout.layout); err != nil {
			return err
		}
		for _, vt := range Layout.layout.Tables {
			Layout.tables[vt.Name] = vt
		}
	}

	Layout.file = file

	idx := Layout.table("lynk_dict")
	if idx == nil {
		Layout.layout.Tables = append(Layout.layout.Tables, &lynkui.DataLayout_VirtualTable{
			Name: "lynk_dict",
		})
	}

	for _, vt := range Layout.layout.Tables {
		switch vt.Name {
		case "lynk_dict":
			if vt.RefInstance == "" {
				vt.RefInstance = "lynkui"
			}
			if vt.RefTable == "" {
				vt.RefTable = "lynk_dict"
			}
		}
		Layout.tables[vt.Name] = vt
	}

	Layout.flusher = func() error {
		b, _ := codec.Json.Encode(Layout.layout, &codec.JsonOptions{
			Width: 120,
		})
		return ioutil.WriteFile(Layout.file, b, 0640)
	}

	for _, inst := range Layout.layout.Instances {
		Layout.instances[inst.Name] = inst
		Layout.clientConnect(inst)
	}

	return Layout.flusher()
}

func (it *LayoutManager) clientConnect(inst *lynkapi.DataInstance) error {

	if inst.Connect == nil {
		return nil
	}

	c, ok := it.clients[inst.Name]
	if !ok {
		cc := lynkapi.ClientConfig{
			Addr: inst.Connect.Address,
		}
		if c2, err := cc.NewClient(); err != nil {
			return err
		} else {
			c = c2
		}
		it.clients[inst.Name] = c
	}

	if inst.Spec == nil || len(inst.Spec.Tables) == 0 {
		rs := c.DataProject(&lynkapi.DataProjectRequest{})
		if rs.Status.OK() {
			for _, v := range rs.Instances {
				if v.Spec == nil || len(v.Spec.Tables) == 0 {
					continue
				}
				for _, v2 := range it.instances {
					if v.Name == v2.Name {
						v2.Spec = v.Spec
						break
					}
				}
			}
		}
	}

	return nil
}

func (it *LayoutManager) Flush() error {
	it.mu.Lock()
	defer it.mu.Unlock()
	if it.flusher != nil {
		return it.flusher()
	}
	return nil
}

func (it *LayoutManager) RegisterService(ds lynkapi.DataService) error {

	inst := ds.Instance()
	if inst == nil || inst.Name == "" {
		return fmt.Errorf("name not setup")
	}

	if !lynkapi.NameIdentifier.MatchString(inst.Name) {
		return fmt.Errorf("invalid name")
	}

	it.mu.Lock()
	defer it.mu.Unlock()

	it.instances[inst.Name] = inst
	it.services[inst.Name] = ds

	{
		hit := false
		for i, v := range it.layout.Instances {
			if v.Name == inst.Name {
				it.layout.Instances[i] = inst
				hit = true
				break
			}
		}
		if !hit {
			it.layout.Instances = append(it.layout.Instances, inst)
		}

		if it.flusher != nil {
			it.flusher()
		}
	}

	return nil
}

func (it *LayoutManager) TableSpec(name string) *lynkapi.TableSpec {

	it.mu.RLock()
	defer it.mu.RUnlock()

	vt, ok := it.tables[name]
	if !ok {
		return nil
	}
	if vt.RefInstance == "" || vt.RefTable == "" {
		return nil
	}

	inst, ok := it.instances[vt.RefInstance]
	if !ok {
		return nil
	}

	if inst.Spec == nil || len(inst.Spec.Tables) == 0 {
		c, ok := it.clients[vt.RefInstance]
		if !ok {
			return nil
		}
		rs := c.DataProject(&lynkapi.DataProjectRequest{})
		if rs.Status.OK() {
			for _, v := range rs.Instances {
				if v.Name != vt.RefInstance {
					continue
				}
				if v.Spec != nil {
					inst.Spec = v.Spec
				}
				break
			}
		}
	}

	return inst.TableSpec(vt.RefTable)
}

func (it *LayoutManager) Query(req *lynkapi.DataQuery) (*lynkapi.DataResult, error) {

	it.mu.RLock()
	defer it.mu.RUnlock()

	vt, ok := it.tables[req.TableName]
	if !ok {
		return nil, fmt.Errorf("table (%s) not found", req.TableName)
	}
	if vt.RefInstance == "" || vt.RefTable == "" {
		return nil, fmt.Errorf("ref-table not found")
	}
	req.InstanceName = vt.RefInstance
	req.TableName = vt.RefTable

	srv, ok := it.services[vt.RefInstance]
	if ok {

		rs, err := srv.Query(req)
		if err != nil {
			return nil, err
		}
		if !rs.OK() {
			return nil, rs.Err()
		}

		return rs, nil
	}

	if c, ok := it.clients[vt.RefInstance]; ok {
		rs := c.DataQuery(req)
		if rs.Status == nil {
			rs.Status = lynkapi.NewServiceStatus(lynkapi.StatusCode_Timeout, "status not found")
		}
		return rs, nil
	}

	return nil, fmt.Errorf("instance (%s) service not found", vt.RefInstance)
}

func (it *LayoutManager) Upsert(req *lynkapi.DataInsert) (*lynkapi.DataResult, error) {

	it.mu.Lock()
	defer it.mu.Unlock()

	vt, ok := it.tables[req.TableName]
	if !ok {
		return nil, fmt.Errorf("table (%s) not found", req.TableName)
	}
	if vt.RefInstance == "" || vt.RefTable == "" {
		return nil, fmt.Errorf("ref-table not found")
	}
	req.InstanceName = vt.RefInstance
	req.TableName = vt.RefTable

	if srv, ok := it.services[vt.RefInstance]; ok {

		rs, err := srv.Upsert(req)
		if err != nil {
			return nil, err
		}
		if !rs.OK() {
			return nil, rs.Err()
		}

		return rs, nil
	}

	if c, ok := it.clients[vt.RefInstance]; ok {
		rs := c.DataUpsert(req)
		if rs.Status == nil {
			rs.Status = lynkapi.NewServiceStatus(lynkapi.StatusCode_Timeout, "status not found")
		}
		return rs, nil
	}

	return nil, fmt.Errorf("instance (%s) service not found", vt.RefInstance)
}

func (it *LayoutManager) table(name string) *TableActive {

	if !lynkapi.NameIdentifier.MatchString(name) {
		return nil
	}

	// it.mu.Lock()
	// defer it.mu.Unlock()

	_, ok := it.tables[name]
	if !ok {
		return nil
	}

	return &TableActive{}
}
