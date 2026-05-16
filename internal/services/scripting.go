package services

// Scripting estilo Postman: o usuário escreve JavaScript que roda antes
// (pre-request) e depois (post-response/tests) do envio. O motor é o goja
// (ECMAScript puro em Go, sem cgo). O sandbox é o do goja — nenhum acesso a
// arquivo/rede/processo é injetado — e um watchdog interrompe scripts que
// passam de scriptTimeout (evita travar o app com loop infinito).
//
// A superfície exposta é um subset compatível com o Postman:
//   pm.variables / pm.environment .get/.set/.has/.unset   (mesma bag)
//   pm.request   .url/.method/.body/.headers/.params      (pre pode mutar)
//   pm.response  .code/.status/.responseTime/.headers/.text()/.json()
//   pm.test(nome, fn) + pm.expect(x) chai-ish
//   console.log/info/warn/error/debug
//
// Variáveis e resultados (tests/console) trafegam por callbacks Go; só
// pm.request é lido de volta via JSON após o pre-script.

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/dop251/goja"
)

// scriptTimeout é o teto de execução de um script (watchdog). var (não const)
// para os testes poderem baixá-lo sem esperar 5s reais.
var scriptTimeout = 5 * time.Second

// ScriptTest é o resultado de um pm.test(...).
type ScriptTest struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
	Error  string `json:"error"`
}

// ScriptResult agrega a saída de um script: asserções, console e um erro
// não-capturado (throw fora de pm.test, timeout, sintaxe).
type ScriptResult struct {
	Tests   []ScriptTest `json:"tests"`
	Console []string     `json:"console"`
	Error   string       `json:"error"`
}

// failed informa se há motivo para reprovar (erro fatal ou pm.test falho).
func (r ScriptResult) failed() bool {
	if r.Error != "" {
		return true
	}
	for _, t := range r.Tests {
		if !t.Passed {
			return true
		}
	}
	return false
}

// mergeScript junta a saída de pre + post num único ScriptResult (console e
// tests concatenados; erro do post prevalece — o do pre aborta antes).
func mergeScript(pre, post ScriptResult) ScriptResult {
	out := ScriptResult{
		Tests:   append(append([]ScriptTest{}, pre.Tests...), post.Tests...),
		Console: append(append([]string{}, pre.Console...), post.Console...),
		Error:   post.Error,
	}
	if out.Error == "" {
		out.Error = pre.Error
	}
	return out
}

// jsPrelude constrói pm/console/expect sobre os primitivos Go (__getVar,
// __setVar, __log, __recordTest, __reqJSON, __respJSON). ES5 conservador.
const jsPrelude = `
function __fmt(args){var p=[];for(var i=0;i<args.length;i++){var a=args[i];try{p.push(typeof a==='object'?JSON.stringify(a):String(a));}catch(_){p.push(String(a));}}return p.join(' ');}
var console={log:function(){__log('log',__fmt(arguments));},info:function(){__log('info',__fmt(arguments));},warn:function(){__log('warn',__fmt(arguments));},error:function(){__log('error',__fmt(arguments));},debug:function(){__log('debug',__fmt(arguments));}};
function __AssertionError(m){this.name='AssertionError';this.message=m;}
__AssertionError.prototype=Object.create(Error.prototype);
function __mkAssert(actual){
  var negate=false;
  function check(cond,msg){if(negate?cond:!cond){throw new __AssertionError(msg);}}
  function deep(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  var A={};
  A.equal=function(v){check(actual===v,'expected '+JSON.stringify(actual)+' to equal '+JSON.stringify(v));return A;};
  A.eql=function(v){check(deep(actual,v),'expected '+JSON.stringify(actual)+' to deeply equal '+JSON.stringify(v));return A;};
  A.include=function(v){var ok=false;if(typeof actual==='string'){ok=actual.indexOf(v)>=0;}else if(Array.isArray(actual)){ok=actual.indexOf(v)>=0;}else if(actual&&typeof actual==='object'){ok=Object.prototype.hasOwnProperty.call(actual,v);}check(ok,'expected '+JSON.stringify(actual)+' to include '+JSON.stringify(v));return A;};
  A.contain=A.include;
  A.a=function(t){var g=Array.isArray(actual)?'array':(actual===null?'null':typeof actual);check(g===t,'expected type '+t+' but got '+g);return A;};
  A.an=A.a;
  A.above=function(n){check(actual>n,'expected '+actual+' to be above '+n);return A;};
  A.least=function(n){check(actual>=n,'expected '+actual+' to be at least '+n);return A;};
  A.below=function(n){check(actual<n,'expected '+actual+' to be below '+n);return A;};
  A.status=function(c){var x=(actual&&actual.code!==undefined)?actual.code:actual;check(x===c,'expected status '+c+' but got '+x);return A;};
  A.property=function(p){check(actual&&Object.prototype.hasOwnProperty.call(actual,p),'expected property '+p);return A;};
  function g(name,fn){Object.defineProperty(A,name,{get:fn});}
  g('true',function(){check(actual===true,'expected true, got '+JSON.stringify(actual));return A;});
  g('false',function(){check(actual===false,'expected false, got '+JSON.stringify(actual));return A;});
  g('ok',function(){check(!!actual,'expected truthy, got '+JSON.stringify(actual));return A;});
  g('undefined',function(){check(actual===undefined,'expected undefined');return A;});
  g('null',function(){check(actual===null,'expected null');return A;});
  g('empty',function(){var e=actual==null||actual.length===0||(typeof actual==='object'&&Object.keys(actual).length===0);check(e,'expected empty');return A;});
  g('not',function(){negate=!negate;return A;});
  var pass=['to','be','been','is','that','which','have','has','with','at','of','same','and','deep'];
  for(var i=0;i<pass.length;i++){(function(k){g(k,function(){return A;});})(pass[i]);}
  return A;
}
var pm={};
pm.variables={get:function(k){return __getVar(k);},set:function(k,v){__setVar(k,String(v));},has:function(k){return __hasVar(k);},unset:function(k){__unsetVar(k);}};
pm.environment=pm.variables;
pm.collectionVariables=pm.variables;
pm.globals=pm.variables;
pm.expect=function(a){return __mkAssert(a);};
pm.test=function(name,fn){try{fn();__recordTest(name,true,'');}catch(e){__recordTest(name,false,(e&&e.message)?e.message:String(e));}};
pm.request=(function(){var r=JSON.parse(__reqJSON);if(!r.headers){r.headers={};}if(!r.params){r.params={};}return r;})();
if(typeof __respJSON==='string'){
  var __rp=JSON.parse(__respJSON);
  pm.response={code:__rp.status,status:__rp.status,responseTime:__rp.responseTime,headers:(__rp.headers||{}),text:function(){return __rp.body;},json:function(){return JSON.parse(__rp.body);}};
  Object.defineProperty(pm.response,'to',{get:function(){return __mkAssert(pm.response);}});
}
`

const jsReadback = `JSON.stringify({url:String(pm.request.url||''),method:String(pm.request.method||''),body:(pm.request.body==null?'':String(pm.request.body)),headers:(pm.request.headers||{}),params:(pm.request.params||{})})`

// runScript executa src na fase dada. Em "pre", cfg é mutável e as alterações
// de pm.request são aplicadas de volta; vars é a bag de variáveis (alterada
// in-place via pm.variables/environment). Em "post", resp alimenta
// pm.response. src vazio é no-op.
func runScript(src, phase string, cfg *RequestConfig, resp *ResponseData, vars map[string]string) ScriptResult {
	var res ScriptResult
	if strings.TrimSpace(src) == "" {
		return res
	}
	if vars == nil {
		vars = map[string]string{}
	}

	vm := goja.New()
	// Sem fs/rede/processo no escopo; só os primitivos abaixo.
	_ = vm.Set("__getVar", func(k string) string { return vars[k] })
	_ = vm.Set("__setVar", func(k, v string) { vars[k] = v })
	_ = vm.Set("__hasVar", func(k string) bool { _, ok := vars[k]; return ok })
	_ = vm.Set("__unsetVar", func(k string) { delete(vars, k) })
	_ = vm.Set("__log", func(level, msg string) {
		res.Console = append(res.Console, level+": "+msg)
	})
	_ = vm.Set("__recordTest", func(name string, passed bool, errMsg string) {
		res.Tests = append(res.Tests, ScriptTest{Name: name, Passed: passed, Error: errMsg})
	})

	reqSeed, _ := json.Marshal(map[string]any{
		"url": cfg.URL, "method": cfg.Method, "body": cfg.Body,
		"headers": nonNilMap(cfg.Headers), "params": nonNilMap(cfg.Params),
	})
	_ = vm.Set("__reqJSON", string(reqSeed))
	if phase == "post" && resp != nil {
		respSeed, _ := json.Marshal(map[string]any{
			"status": resp.Status, "body": resp.Body,
			"headers": nonNilMap(resp.Headers), "responseTime": resp.DurationMS,
		})
		_ = vm.Set("__respJSON", string(respSeed))
	}

	// Watchdog: interrompe o script se passar de scriptTimeout.
	timer := time.AfterFunc(scriptTimeout, func() {
		vm.Interrupt("script excedeu o tempo limite")
	})
	defer timer.Stop()

	if _, err := vm.RunString(jsPrelude); err != nil {
		res.Error = "erro interno no prelúdio de scripting: " + err.Error()
		return res
	}
	if _, err := vm.RunString(src); err != nil {
		res.Error = scriptErrMessage(err)
		return res
	}

	// pm.request só volta para a request no pre-script.
	if phase == "pre" {
		v, err := vm.RunString(jsReadback)
		if err == nil {
			applyRequestMutations(cfg, v.String())
		}
	}
	return res
}

func nonNilMap(m map[string]string) map[string]string {
	if m == nil {
		return map[string]string{}
	}
	return m
}

// scriptErrMessage normaliza o erro do goja (throw do usuário, sintaxe ou
// interrupção do watchdog) para uma mensagem curta.
func scriptErrMessage(err error) string {
	if ex, ok := err.(*goja.Exception); ok {
		return strings.TrimSpace(ex.Value().String())
	}
	if _, ok := err.(*goja.InterruptedError); ok {
		return "script excedeu o tempo limite"
	}
	return err.Error()
}

// applyRequestMutations relê o pm.request (JSON do readback) e copia url/
// method/body/headers/params de volta para o cfg.
func applyRequestMutations(cfg *RequestConfig, jsonStr string) {
	var m struct {
		URL     string         `json:"url"`
		Method  string         `json:"method"`
		Body    string         `json:"body"`
		Headers map[string]any `json:"headers"`
		Params  map[string]any `json:"params"`
	}
	if err := json.Unmarshal([]byte(jsonStr), &m); err != nil {
		return
	}
	cfg.URL = m.URL
	cfg.Method = m.Method
	cfg.Body = m.Body
	cfg.Headers = stringifyMap(m.Headers)
	cfg.Params = stringifyMap(m.Params)
}

// stringifyMap coage os valores (o script pode ter posto número/bool) para
// string, que é o que a request HTTP espera.
func stringifyMap(in map[string]any) map[string]string {
	if len(in) == 0 {
		return nil
	}
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = fmt.Sprint(v)
	}
	return out
}
