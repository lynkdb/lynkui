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
	"encoding/base64"
	"encoding/json"
	"fmt"
)

func jsonPrint(o interface{}) {
	js, _ := json.MarshalIndent(o, "", "  ")
	fmt.Println(string(js))
}

func jsonEncode(o interface{}) []byte {
	js, _ := json.Marshal(o)
	return js
}

func jsonDecode(b []byte, o interface{}) error {
	return json.Unmarshal(b, o)
}

func base64Encode(o interface{}) string {
	return base64.StdEncoding.EncodeToString(jsonEncode(o))
}

func base64Decode(s string) string {
	b, err := base64.StdEncoding.DecodeString(s)
	if err == nil {
		return string(b)
	}
	return ""
}
