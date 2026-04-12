"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "../../node_modules/ajv/dist/compile/codegen/code.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.regexpCode = exports2.getEsmExportName = exports2.getProperty = exports2.safeStringify = exports2.stringify = exports2.strConcat = exports2.addCodeArg = exports2.str = exports2._ = exports2.nil = exports2._Code = exports2.Name = exports2.IDENTIFIER = exports2._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports2._CodeOrName = _CodeOrName;
    exports2.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        super();
        if (!exports2.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return false;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports2.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code) {
        super();
        this._items = typeof code === "string" ? [code] : code;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return false;
        const item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
          if (c instanceof Name)
            names[c.str] = (names[c.str] || 0) + 1;
          return names;
        }, {});
      }
    };
    exports2._Code = _Code;
    exports2.nil = new _Code("");
    function _(strs, ...args) {
      const code = [strs[0]];
      let i = 0;
      while (i < args.length) {
        addCodeArg(code, args[i]);
        code.push(strs[++i]);
      }
      return new _Code(code);
    }
    exports2._ = _;
    var plus = new _Code("+");
    function str2(strs, ...args) {
      const expr = [safeStringify(strs[0])];
      let i = 0;
      while (i < args.length) {
        expr.push(plus);
        addCodeArg(expr, args[i]);
        expr.push(plus, safeStringify(strs[++i]));
      }
      optimize(expr);
      return new _Code(expr);
    }
    exports2.str = str2;
    function addCodeArg(code, arg) {
      if (arg instanceof _Code)
        code.push(...arg._items);
      else if (arg instanceof Name)
        code.push(arg);
      else
        code.push(interpolate(arg));
    }
    exports2.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      while (i < expr.length - 1) {
        if (expr[i] === plus) {
          const res = mergeExprItems(expr[i - 1], expr[i + 1]);
          if (res !== void 0) {
            expr.splice(i - 1, 3, res);
            continue;
          }
          expr[i++] = "+";
        }
        i++;
      }
    }
    function mergeExprItems(a, b) {
      if (b === '""')
        return a;
      if (a === '""')
        return b;
      if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
          return;
        if (typeof b != "string")
          return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
          return a.slice(0, -1) + b.slice(1);
        return;
      }
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
      return;
    }
    function strConcat(c1, c2) {
      return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str2`${c1}${c2}`;
    }
    exports2.strConcat = strConcat;
    function interpolate(x) {
      return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
    }
    function stringify(x) {
      return new _Code(safeStringify(x));
    }
    exports2.stringify = stringify;
    function safeStringify(x) {
      return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    exports2.safeStringify = safeStringify;
    function getProperty(key) {
      return typeof key == "string" && exports2.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
    }
    exports2.getProperty = getProperty;
    function getEsmExportName(key) {
      if (typeof key == "string" && exports2.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
      }
      throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
    }
    exports2.getEsmExportName = getEsmExportName;
    function regexpCode(rx) {
      return new _Code(rx.toString());
    }
    exports2.regexpCode = regexpCode;
  }
});

// ../../node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS({
  "../../node_modules/ajv/dist/compile/codegen/scope.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ValueScope = exports2.ValueScopeName = exports2.Scope = exports2.varKinds = exports2.UsedValueState = void 0;
    var code_1 = require_code();
    var ValueError = class extends Error {
      constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`);
        this.value = name.value;
      }
    };
    var UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
      UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
    })(UsedValueState || (exports2.UsedValueState = UsedValueState = {}));
    exports2.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports2.Scope = Scope;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports2.ValueScopeName = ValueScopeName;
    var line = (0, code_1._)`\n`;
    var ValueScope = class extends Scope {
      constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
      }
      get() {
        return this._scope;
      }
      name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
      }
      value(nameOrPrefix, value) {
        var _a;
        if (value.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const name = this.toName(nameOrPrefix);
        const { prefix } = name;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
          const _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else {
          vs = this._values[prefix] = /* @__PURE__ */ new Map();
        }
        vs.set(valueKey, name);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name.setValue(value, { property: prefix, itemIndex });
        return name;
      }
      getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
          return;
        return vs.get(keyOrRef);
      }
      scopeRefs(scopeName, values = this._values) {
        return this._reduceValues(values, (name) => {
          if (name.scopePath === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return (0, code_1._)`${scopeName}${name.scopePath}`;
        });
      }
      scopeCode(values = this._values, usedValues, getCode) {
        return this._reduceValues(values, (name) => {
          if (name.value === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return name.value.code;
        }, usedValues, getCode);
      }
      _reduceValues(values, valueCode, usedValues = {}, getCode) {
        let code = code_1.nil;
        for (const prefix in values) {
          const vs = values[prefix];
          if (!vs)
            continue;
          const nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
          vs.forEach((name) => {
            if (nameSet.has(name))
              return;
            nameSet.set(name, UsedValueState.Started);
            let c = valueCode(name);
            if (c) {
              const def = this.opts.es5 ? exports2.varKinds.var : exports2.varKinds.const;
              code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
            } else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name)) {
              code = (0, code_1._)`${code}${c}${this.opts._n}`;
            } else {
              throw new ValueError(name);
            }
            nameSet.set(name, UsedValueState.Completed);
          });
        }
        return code;
      }
    };
    exports2.ValueScope = ValueScope;
  }
});

// ../../node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS({
  "../../node_modules/ajv/dist/compile/codegen/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.or = exports2.and = exports2.not = exports2.CodeGen = exports2.operators = exports2.varKinds = exports2.ValueScopeName = exports2.ValueScope = exports2.Scope = exports2.Name = exports2.regexpCode = exports2.stringify = exports2.getProperty = exports2.nil = exports2.strConcat = exports2.str = exports2._ = void 0;
    var code_1 = require_code();
    var scope_1 = require_scope();
    var code_2 = require_code();
    Object.defineProperty(exports2, "_", { enumerable: true, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports2, "str", { enumerable: true, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports2, "strConcat", { enumerable: true, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports2, "nil", { enumerable: true, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports2, "getProperty", { enumerable: true, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports2, "stringify", { enumerable: true, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports2, "regexpCode", { enumerable: true, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports2, "Name", { enumerable: true, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports2, "Scope", { enumerable: true, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports2, "ValueScope", { enumerable: true, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports2, "ValueScopeName", { enumerable: true, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports2, "varKinds", { enumerable: true, get: function() {
      return scope_2.varKinds;
    } });
    exports2.operators = {
      GT: new code_1._Code(">"),
      GTE: new code_1._Code(">="),
      LT: new code_1._Code("<"),
      LTE: new code_1._Code("<="),
      EQ: new code_1._Code("==="),
      NEQ: new code_1._Code("!=="),
      NOT: new code_1._Code("!"),
      OR: new code_1._Code("||"),
      AND: new code_1._Code("&&"),
      ADD: new code_1._Code("+")
    };
    var Node = class {
      optimizeNodes() {
        return this;
      }
      optimizeNames(_names, _constants) {
        return this;
      }
    };
    var Def = class extends Node {
      constructor(varKind, name, rhs) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.rhs = rhs;
      }
      render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (!names[this.name.str])
          return;
        if (this.rhs)
          this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    };
    var Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
          return;
        this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    };
    var AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    };
    var Label = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    };
    var Break = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
      }
    };
    var Throw = class extends Node {
      constructor(error) {
        super();
        this.error = error;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    };
    var AnyCode = class extends Node {
      constructor(code) {
        super();
        this.code = code;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants) {
        this.code = optimizeExpr(this.code, names, constants);
        return this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    };
    var ParentNode = class extends Node {
      constructor(nodes = []) {
        super();
        this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
      }
      optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i].optimizeNodes();
          if (Array.isArray(n))
            nodes.splice(i, 1, ...n);
          else if (n)
            nodes[i] = n;
          else
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i];
          if (n.optimizeNames(names, constants))
            continue;
          subtractNames(names, n.names);
          nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    };
    var BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    };
    var Root = class extends ParentNode {
    };
    var Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class _If extends BlockNode {
      constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
      }
      render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        if (this.else)
          code += "else " + this.else.render(opts);
        return code;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
          return this.nodes;
        let e = this.else;
        if (e) {
          const ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
          if (cond === false)
            return e instanceof _If ? e : e.nodes;
          if (this.nodes.length)
            return this;
          return new _If(not(cond), e instanceof _If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
          return void 0;
        return this;
      }
      optimizeNames(names, constants) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        if (!(super.optimizeNames(names, constants) || this.else))
          return;
        this.condition = optimizeExpr(this.condition, names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
          addNames(names, this.else.names);
        return names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super();
        this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iteration = optimizeExpr(this.iteration, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    };
    var ForRange = class extends For {
      constructor(varKind, name, from, to) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.from = from;
        this.to = to;
      }
      render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
      }
      get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    };
    var ForIter = class extends For {
      constructor(loop, varKind, name, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name;
        this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iterable = optimizeExpr(this.iterable, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    };
    var Func = class extends BlockNode {
      constructor(name, args, async) {
        super();
        this.name = name;
        this.args = args;
        this.async = async;
      }
      render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
      }
    };
    Func.kind = "func";
    var Return = class extends ParentNode {
      render(opts) {
        return "return " + super.render(opts);
      }
    };
    Return.kind = "return";
    var Try = class extends BlockNode {
      render(opts) {
        let code = "try" + super.render(opts);
        if (this.catch)
          code += this.catch.render(opts);
        if (this.finally)
          code += this.finally.render(opts);
        return code;
      }
      optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
      }
      optimizeNames(names, constants) {
        var _a, _b;
        super.optimizeNames(names, constants);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        if (this.catch)
          addNames(names, this.catch.names);
        if (this.finally)
          addNames(names, this.finally.names);
        return names;
      }
    };
    var Catch = class extends BlockNode {
      constructor(error) {
        super();
        this.error = error;
      }
      render(opts) {
        return `catch(${this.error})` + super.render(opts);
      }
    };
    Catch.kind = "catch";
    var Finally = class extends BlockNode {
      render(opts) {
        return "finally" + super.render(opts);
      }
    };
    Finally.kind = "finally";
    var CodeGen = class {
      constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      // returns unique name in the internal scope
      name(prefix) {
        return this._scope.name(prefix);
      }
      // reserves unique name in the external scope
      scopeName(prefix) {
        return this._extScope.name(prefix);
      }
      // reserves unique name in the external scope and assigns value to it
      scopeValue(prefixOrName, value) {
        const name = this._extScope.value(prefixOrName, value);
        const vs = this._values[name.prefix] || (this._values[name.prefix] = /* @__PURE__ */ new Set());
        vs.add(name);
        return name;
      }
      getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
      }
      // return code that assigns values in the external scope to the names that are used internally
      // (same names that were returned by gen.scopeName or gen.scopeValue)
      scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(varKind, nameOrPrefix, rhs, constant) {
        const name = this._scope.toName(nameOrPrefix);
        if (rhs !== void 0 && constant)
          this._constants[name.str] = rhs;
        this._leafNode(new Def(varKind, name, rhs));
        return name;
      }
      // `const` declaration (`var` in es5 mode)
      const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
      }
      // `let` declaration with optional assignment (`var` in es5 mode)
      let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
      }
      // `var` declaration with optional assignment
      var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
      }
      // assignment code
      assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
      }
      // `+=` code
      add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports2.operators.ADD, rhs));
      }
      // appends passed SafeExpr to code or executes Block
      code(c) {
        if (typeof c == "function")
          c();
        else if (c !== code_1.nil)
          this._leafNode(new AnyCode(c));
        return this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...keyValues) {
        const code = ["{"];
        for (const [key, value] of keyValues) {
          if (code.length > 1)
            code.push(",");
          code.push(key);
          if (key !== value || this.opts.es5) {
            code.push(":");
            (0, code_1.addCodeArg)(code, value);
          }
        }
        code.push("}");
        return new code_1._Code(code);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
          this.code(thenBody).else().code(elseBody).endIf();
        } else if (thenBody) {
          this.code(thenBody).endIf();
        } else if (elseBody) {
          throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
      }
      // `else if` clause - invalid without `if` or after `else` clauses
      elseIf(condition) {
        return this._elseNode(new If(condition));
      }
      // `else` clause - only valid after `if` or `else if` clauses
      else() {
        return this._elseNode(new Else());
      }
      // end `if` statement (needed if gen.if was used only with condition)
      endIf() {
        return this._endBlockNode(If, Else);
      }
      _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
          this.code(forBody).endFor();
        return this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      // `for` statement for a range of values
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name, (0, code_1._)`${arr}[${i}]`);
            forBody(name);
          });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        }
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
      }
      // end `for` loop
      endFor() {
        return this._endBlockNode(For);
      }
      // `label` statement
      label(label) {
        return this._leafNode(new Label(label));
      }
      // `break` statement
      break(label) {
        return this._leafNode(new Break(label));
      }
      // `return` statement
      return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      // `try` statement
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
          const error = this.name("e");
          this._currNode = node.catch = new Catch(error);
          catchCode(error);
        }
        if (finallyCode) {
          this._currNode = node.finally = new Finally();
          this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
      }
      // `throw` statement
      throw(error) {
        return this._leafNode(new Throw(error));
      }
      // start self-balancing block
      block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
          this.code(body).endBlock(nodeCount);
        return this;
      }
      // end the current self-balancing block
      endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) {
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(name, args = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name, args, async));
        if (funcBody)
          this.code(funcBody).endFunc();
        return this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        while (n-- > 0) {
          this._root.optimizeNodes();
          this._root.optimizeNames(this._root.names, this._constants);
        }
      }
      _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
      }
      _endBlockNode(N1, N2) {
        const n = this._currNode;
        if (n instanceof N1 || N2 && n instanceof N2) {
          this._nodes.pop();
          return this;
        }
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
          throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports2.CodeGen = CodeGen;
    function addNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
      return names;
    }
    function addExprNames(names, from) {
      return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
    }
    function optimizeExpr(expr, names, constants) {
      if (expr instanceof code_1.Name)
        return replaceName(expr);
      if (!canOptimize(expr))
        return expr;
      return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
          c = replaceName(c);
        if (c instanceof code_1._Code)
          items.push(...c._items);
        else
          items.push(c);
        return items;
      }, []));
      function replaceName(n) {
        const c = constants[n.str];
        if (c === void 0 || names[n.str] !== 1)
          return n;
        delete names[n.str];
        return c;
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
    }
    function not(x) {
      return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
    }
    exports2.not = not;
    var andCode = mappend(exports2.operators.AND);
    function and(...args) {
      return args.reduce(andCode);
    }
    exports2.and = and;
    var orCode = mappend(exports2.operators.OR);
    function or(...args) {
      return args.reduce(orCode);
    }
    exports2.or = or;
    function mappend(op) {
      return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
    }
    function par(x) {
      return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
    }
  }
});

// ../../node_modules/ajv/dist/compile/util.js
var require_util = __commonJS({
  "../../node_modules/ajv/dist/compile/util.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.checkStrictMode = exports2.getErrorPath = exports2.Type = exports2.useFunc = exports2.setEvaluated = exports2.evaluatedPropsToName = exports2.mergeEvaluated = exports2.eachItem = exports2.unescapeJsonPointer = exports2.escapeJsonPointer = exports2.escapeFragment = exports2.unescapeFragment = exports2.schemaRefOrVal = exports2.schemaHasRulesButRef = exports2.schemaHasRules = exports2.checkUnknownRules = exports2.alwaysValidSchema = exports2.toHash = void 0;
    var codegen_1 = require_codegen();
    var code_1 = require_code();
    function toHash(arr) {
      const hash = {};
      for (const item of arr)
        hash[item] = true;
      return hash;
    }
    exports2.toHash = toHash;
    function alwaysValidSchema(it, schema2) {
      if (typeof schema2 == "boolean")
        return schema2;
      if (Object.keys(schema2).length === 0)
        return true;
      checkUnknownRules(it, schema2);
      return !schemaHasRules(schema2, it.self.RULES.all);
    }
    exports2.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it, schema2 = it.schema) {
      const { opts, self } = it;
      if (!opts.strictSchema)
        return;
      if (typeof schema2 === "boolean")
        return;
      const rules = self.RULES.keywords;
      for (const key in schema2) {
        if (!rules[key])
          checkStrictMode(it, `unknown keyword: "${key}"`);
      }
    }
    exports2.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema2, rules) {
      if (typeof schema2 == "boolean")
        return !schema2;
      for (const key in schema2)
        if (rules[key])
          return true;
      return false;
    }
    exports2.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema2, RULES) {
      if (typeof schema2 == "boolean")
        return !schema2;
      for (const key in schema2)
        if (key !== "$ref" && RULES.all[key])
          return true;
      return false;
    }
    exports2.schemaHasRulesButRef = schemaHasRulesButRef;
    function schemaRefOrVal({ topSchemaRef, schemaPath }, schema2, keyword, $data) {
      if (!$data) {
        if (typeof schema2 == "number" || typeof schema2 == "boolean")
          return schema2;
        if (typeof schema2 == "string")
          return (0, codegen_1._)`${schema2}`;
      }
      return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
    }
    exports2.schemaRefOrVal = schemaRefOrVal;
    function unescapeFragment(str2) {
      return unescapeJsonPointer(decodeURIComponent(str2));
    }
    exports2.unescapeFragment = unescapeFragment;
    function escapeFragment(str2) {
      return encodeURIComponent(escapeJsonPointer(str2));
    }
    exports2.escapeFragment = escapeFragment;
    function escapeJsonPointer(str2) {
      if (typeof str2 == "number")
        return `${str2}`;
      return str2.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports2.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str2) {
      return str2.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports2.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs)) {
        for (const x of xs)
          f(x);
      } else {
        f(xs);
      }
    }
    exports2.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports2.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          if (from === true) {
            gen.assign(to, true);
          } else {
            gen.assign(to, (0, codegen_1._)`${to} || {}`);
            setEvaluated(gen, to, from);
          }
        }),
        mergeValues: (from, to) => from === true ? true : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === true ? true : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === true)
        return gen.var("props", true);
      const props = gen.var("props", (0, codegen_1._)`{}`);
      if (ps !== void 0)
        setEvaluated(gen, props, ps);
      return props;
    }
    exports2.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
    }
    exports2.setEvaluated = setEvaluated;
    var snippets = {};
    function useFunc(gen, f) {
      return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
      });
    }
    exports2.useFunc = useFunc;
    var Type;
    (function(Type2) {
      Type2[Type2["Num"] = 0] = "Num";
      Type2[Type2["Str"] = 1] = "Str";
    })(Type || (exports2.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        const isNumber = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports2.getErrorPath = getErrorPath;
    function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
      if (!mode)
        return;
      msg = `strict mode: ${msg}`;
      if (mode === true)
        throw new Error(msg);
      it.self.logger.warn(msg);
    }
    exports2.checkStrictMode = checkStrictMode;
  }
});

// ../../node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "../../node_modules/ajv/dist/compile/names.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var names = {
      // validation function arguments
      data: new codegen_1.Name("data"),
      // data passed to validation function
      // args passed from referencing schema
      valCxt: new codegen_1.Name("valCxt"),
      // validation/data context - should not be used directly, it is destructured to the names below
      instancePath: new codegen_1.Name("instancePath"),
      parentData: new codegen_1.Name("parentData"),
      parentDataProperty: new codegen_1.Name("parentDataProperty"),
      rootData: new codegen_1.Name("rootData"),
      // root data - same as the data passed to the first/top validation function
      dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
      // used to support recursiveRef and dynamicRef
      // function scoped variables
      vErrors: new codegen_1.Name("vErrors"),
      // null or array of validation errors
      errors: new codegen_1.Name("errors"),
      // counter of validation errors
      this: new codegen_1.Name("this"),
      // "globals"
      self: new codegen_1.Name("self"),
      scope: new codegen_1.Name("scope"),
      // JTD serialize/parse name for JSON string and position
      json: new codegen_1.Name("json"),
      jsonPos: new codegen_1.Name("jsonPos"),
      jsonLen: new codegen_1.Name("jsonLen"),
      jsonPart: new codegen_1.Name("jsonPart")
    };
    exports2.default = names;
  }
});

// ../../node_modules/ajv/dist/compile/errors.js
var require_errors = __commonJS({
  "../../node_modules/ajv/dist/compile/errors.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.extendErrors = exports2.resetErrorsCount = exports2.reportExtraError = exports2.reportError = exports2.keyword$DataError = exports2.keywordError = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    exports2.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports2.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error = exports2.keywordError, errorPaths, overrideAllErrors) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) {
        addError(gen, errObj);
      } else {
        returnErrors(it, (0, codegen_1._)`[${errObj}]`);
      }
    }
    exports2.reportError = reportError;
    function reportExtraError(cxt, error = exports2.keywordError, errorPaths) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      addError(gen, errObj);
      if (!(compositeRule || allErrors)) {
        returnErrors(it, names_1.default.vErrors);
      }
    }
    exports2.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports2.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      const err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
        gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
        if (it.opts.verbose) {
          gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
          gen.assign((0, codegen_1._)`${err}.data`, data);
        }
      });
    }
    exports2.extendErrors = extendErrors;
    function addError(gen, errObj) {
      const err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
      gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it, errs) {
      const { gen, validateName, schemaEnv } = it;
      if (schemaEnv.$async) {
        gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
        gen.return(false);
      }
    }
    var E = {
      keyword: new codegen_1.Name("keyword"),
      schemaPath: new codegen_1.Name("schemaPath"),
      // also used in JTD errors
      params: new codegen_1.Name("params"),
      propertyName: new codegen_1.Name("propertyName"),
      message: new codegen_1.Name("message"),
      schema: new codegen_1.Name("schema"),
      parentSchema: new codegen_1.Name("parentSchema")
    };
    function errorObjectCode(cxt, error, errorPaths) {
      const { createErrors } = cxt.it;
      if (createErrors === false)
        return (0, codegen_1._)`{}`;
      return errorObject(cxt, error, errorPaths);
    }
    function errorObject(cxt, error, errorPaths = {}) {
      const { gen, it } = cxt;
      const keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      extraErrorProps(cxt, error, keyValues);
      return gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      if (schemaPath) {
        schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
      }
      return [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      const { keyword, data, schemaValue, it } = cxt;
      const { opts, propertyName, topSchemaRef, schemaPath } = it;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
      if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
      }
      if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
      }
      if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// ../../node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "../../node_modules/ajv/dist/compile/validate/boolSchema.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.boolOrEmptySchema = exports2.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it) {
      const { gen, schema: schema2, validateName } = it;
      if (schema2 === false) {
        falseSchemaError(it, false);
      } else if (typeof schema2 == "object" && schema2.$async === true) {
        gen.return(names_1.default.data);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, null);
        gen.return(true);
      }
    }
    exports2.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it, valid) {
      const { gen, schema: schema2 } = it;
      if (schema2 === false) {
        gen.var(valid, false);
        falseSchemaError(it);
      } else {
        gen.var(valid, true);
      }
    }
    exports2.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it, overrideAllErrors) {
      const { gen, data } = it;
      const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it
      };
      (0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
    }
  }
});

// ../../node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS({
  "../../node_modules/ajv/dist/compile/rules.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getRules = exports2.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
    var jsonTypes = new Set(_jsonTypes);
    function isJSONType(x) {
      return typeof x == "string" && jsonTypes.has(x);
    }
    exports2.isJSONType = isJSONType;
    function getRules() {
      const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {}
      };
    }
    exports2.getRules = getRules;
  }
});

// ../../node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS({
  "../../node_modules/ajv/dist/compile/validate/applicability.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.shouldUseRule = exports2.shouldUseGroup = exports2.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema: schema2, self }, type2) {
      const group = self.RULES.types[type2];
      return group && group !== true && shouldUseGroup(schema2, group);
    }
    exports2.schemaHasRulesForType = schemaHasRulesForType;
    function shouldUseGroup(schema2, group) {
      return group.rules.some((rule) => shouldUseRule(schema2, rule));
    }
    exports2.shouldUseGroup = shouldUseGroup;
    function shouldUseRule(schema2, rule) {
      var _a;
      return schema2[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema2[kwd] !== void 0));
    }
    exports2.shouldUseRule = shouldUseRule;
  }
});

// ../../node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS({
  "../../node_modules/ajv/dist/compile/validate/dataType.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.reportTypeError = exports2.checkDataTypes = exports2.checkDataType = exports2.coerceAndCheckDataType = exports2.getJSONTypes = exports2.getSchemaTypes = exports2.DataType = void 0;
    var rules_1 = require_rules();
    var applicability_1 = require_applicability();
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var DataType;
    (function(DataType2) {
      DataType2[DataType2["Correct"] = 0] = "Correct";
      DataType2[DataType2["Wrong"] = 1] = "Wrong";
    })(DataType || (exports2.DataType = DataType = {}));
    function getSchemaTypes(schema2) {
      const types = getJSONTypes(schema2.type);
      const hasNull = types.includes("null");
      if (hasNull) {
        if (schema2.nullable === false)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema2.nullable !== void 0) {
          throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema2.nullable === true)
          types.push("null");
      }
      return types;
    }
    exports2.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports2.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it, types) {
      const { gen, data, opts } = it;
      const coerceTo = coerceToTypes(types, opts.coerceTypes);
      const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
      if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          if (coerceTo.length)
            coerceData(it, types, coerceTo);
          else
            reportTypeError(it);
        });
      }
      return checkTypes;
    }
    exports2.coerceAndCheckDataType = coerceAndCheckDataType;
    var COERCIBLE = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
    function coerceToTypes(types, coerceTypes) {
      return coerceTypes ? types.filter((t) => COERCIBLE.has(t) || coerceTypes === "array" && t === "array") : [];
    }
    function coerceData(it, types, coerceTo) {
      const { gen, data, opts } = it;
      const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
      const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
      }
      gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (const t of coerceTo) {
        if (COERCIBLE.has(t) || t === "array" && opts.coerceTypes === "array") {
          coerceSpecificType(t);
        }
      }
      gen.else();
      reportTypeError(it);
      gen.endIf();
      gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it, coerced);
      });
      function coerceSpecificType(t) {
        switch (t) {
          case "string":
            gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
            return;
          case "number":
            gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "integer":
            gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "boolean":
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
            gen.assign(coerced, null);
            return;
          case "array":
            gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
        }
      }
    }
    function assignParentData({ gen, parentData, parentDataProperty }, expr) {
      gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
    }
    function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
      const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
      let cond;
      switch (dataType) {
        case "null":
          return (0, codegen_1._)`${data} ${EQ} null`;
        case "array":
          cond = (0, codegen_1._)`Array.isArray(${data})`;
          break;
        case "object":
          cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
          break;
        case "integer":
          cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
          break;
        case "number":
          cond = numCond();
          break;
        default:
          return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
      }
      return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
      function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
      }
    }
    exports2.checkDataType = checkDataType;
    function checkDataTypes(dataTypes, data, strictNums, correct) {
      if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
      }
      let cond;
      const types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
      } else {
        cond = codegen_1.nil;
      }
      if (types.number)
        delete types.integer;
      for (const t in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
      return cond;
    }
    exports2.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema: schema2 }) => `must be ${schema2}`,
      params: ({ schema: schema2, schemaValue }) => typeof schema2 == "string" ? (0, codegen_1._)`{type: ${schema2}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it) {
      const cxt = getTypeErrorContext(it);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports2.reportTypeError = reportTypeError;
    function getTypeErrorContext(it) {
      const { gen, data, schema: schema2 } = it;
      const schemaCode = (0, util_1.schemaRefOrVal)(it, schema2, "type");
      return {
        gen,
        keyword: "type",
        data,
        schema: schema2.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema2,
        params: {},
        it
      };
    }
  }
});

// ../../node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS({
  "../../node_modules/ajv/dist/compile/validate/defaults.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.assignDefaults = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function assignDefaults(it, ty) {
      const { properties, items } = it.schema;
      if (ty === "object" && properties) {
        for (const key in properties) {
          assignDefault(it, key, properties[key].default);
        }
      } else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it, i, sch.default));
      }
    }
    exports2.assignDefaults = assignDefaults;
    function assignDefault(it, prop, defaultValue) {
      const { gen, compositeRule, data, opts } = it;
      if (defaultValue === void 0)
        return;
      const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
      }
      gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// ../../node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/code.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.validateUnion = exports2.validateArray = exports2.usePattern = exports2.callValidateCode = exports2.schemaProperties = exports2.allSchemaProperties = exports2.noPropertyInData = exports2.propertyInData = exports2.isOwnProperty = exports2.hasPropFunc = exports2.reportMissingProp = exports2.checkMissingProp = exports2.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      const { gen, data, it } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
        cxt.error();
      });
    }
    exports2.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
      return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports2.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, true);
      cxt.error();
    }
    exports2.reportMissingProp = reportMissingProp;
    function hasPropFunc(gen) {
      return gen.scopeValue("func", {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
      });
    }
    exports2.hasPropFunc = hasPropFunc;
    function isOwnProperty(gen, data, property) {
      return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
    }
    exports2.isOwnProperty = isOwnProperty;
    function propertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports2.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
      return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
    }
    exports2.noPropertyInData = noPropertyInData;
    function allSchemaProperties(schemaMap) {
      return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
    }
    exports2.allSchemaProperties = allSchemaProperties;
    function schemaProperties(it, schemaMap) {
      return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
    }
    exports2.schemaProperties = schemaProperties;
    function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
      const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
      const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      if (it.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
    }
    exports2.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      const u = opts.unicodeRegExp ? "u" : "";
      const { regExp } = opts.code;
      const rx = regExp(pattern, u);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
      });
    }
    exports2.usePattern = usePattern;
    function validateArray(cxt) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      if (it.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
      }
      gen.var(valid, true);
      validateItems(() => gen.break());
      return valid;
      function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid);
          gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports2.validateArray = validateArray;
    function validateUnion(cxt) {
      const { gen, schema: schema2, keyword, it } = cxt;
      if (!Array.isArray(schema2))
        throw new Error("ajv implementation error");
      const alwaysValid = schema2.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
      if (alwaysValid && !it.opts.unevaluated)
        return;
      const valid = gen.let("valid", false);
      const schValid = gen.name("_valid");
      gen.block(() => schema2.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: true
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        if (!merged)
          gen.if((0, codegen_1.not)(valid));
      }));
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
    }
    exports2.validateUnion = validateUnion;
  }
});

// ../../node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "../../node_modules/ajv/dist/compile/validate/keyword.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.validateKeywordUsage = exports2.validSchemaType = exports2.funcKeywordCode = exports2.macroKeywordCode = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var code_1 = require_code2();
    var errors_1 = require_errors();
    function macroKeywordCode(cxt, def) {
      const { gen, keyword, schema: schema2, parentSchema, it } = cxt;
      const macroSchema = def.macro.call(it.self, schema2, parentSchema, it);
      const schemaRef = useKeyword(gen, keyword, macroSchema);
      if (it.opts.validateSchema !== false)
        it.self.validateSchema(macroSchema, true);
      const valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true
      }, valid);
      cxt.pass(valid, () => cxt.error(true));
    }
    exports2.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      const { gen, keyword, schema: schema2, parentSchema, $data, it } = cxt;
      checkAsyncKeyword(it, def);
      const validate = !$data && def.compile ? def.compile.call(it.self, schema2, parentSchema, it) : def.validate;
      const validateRef = useKeyword(gen, keyword, validate);
      const valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword);
      cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === false) {
          assignValid();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => cxt.error());
        } else {
          const ruleErrs = def.async ? validateAsync() : validateSync();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
      }
      function validateSync() {
        const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !("compile" in def && !$data || def.schema === false);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports2.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      const { gen, data, it } = cxt;
      gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      const { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
      }, () => cxt.error());
    }
    function checkAsyncKeyword({ schemaEnv }, def) {
      if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
    }
    function useKeyword(gen, keyword, result) {
      if (result === void 0)
        throw new Error(`keyword "${keyword}" failed to compile`);
      return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
    }
    function validSchemaType(schema2, schemaType, allowUndefined = false) {
      return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema2) : st === "object" ? schema2 && typeof schema2 == "object" && !Array.isArray(schema2) : typeof schema2 == st || allowUndefined && typeof schema2 == "undefined");
    }
    exports2.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema: schema2, opts, self, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
      }
      const deps = def.dependencies;
      if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema2, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      }
      if (def.validateSchema) {
        const valid = def.validateSchema(schema2[keyword]);
        if (!valid) {
          const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self.errorsText(def.validateSchema.errors);
          if (opts.validateSchema === "log")
            self.logger.error(msg);
          else
            throw new Error(msg);
        }
      }
    }
    exports2.validateKeywordUsage = validateKeywordUsage;
  }
});

// ../../node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "../../node_modules/ajv/dist/compile/validate/subschema.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.extendSubschemaMode = exports2.extendSubschemaData = exports2.getSubschema = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function getSubschema(it, { keyword, schemaProp, schema: schema2, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema2 !== void 0) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      }
      if (keyword !== void 0) {
        const sch = it.schema[keyword];
        return schemaProp === void 0 ? {
          schema: sch,
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}`
        } : {
          schema: sch[schemaProp],
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
        };
      }
      if (schema2 !== void 0) {
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) {
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
          schema: schema2,
          schemaPath,
          topSchemaRef,
          errSchemaPath
        };
      }
      throw new Error('either "keyword" or "schema" must be passed');
    }
    exports2.getSubschema = getSubschema;
    function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
      if (data !== void 0 && dataProp !== void 0) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      }
      const { gen } = it;
      if (dataProp !== void 0) {
        const { errorPath, dataPathArr, opts } = it;
        const nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
        dataContextProps(nextData);
        if (propertyName !== void 0)
          subschema.propertyName = propertyName;
      }
      if (dataTypes)
        subschema.dataTypes = dataTypes;
      function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it.dataLevel + 1;
        subschema.dataTypes = [];
        it.definedProperties = /* @__PURE__ */ new Set();
        subschema.parentData = it.data;
        subschema.dataNames = [...it.dataNames, _nextData];
      }
    }
    exports2.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      if (compositeRule !== void 0)
        subschema.compositeRule = compositeRule;
      if (createErrors !== void 0)
        subschema.createErrors = createErrors;
      if (allErrors !== void 0)
        subschema.allErrors = allErrors;
      subschema.jtdDiscriminator = jtdDiscriminator;
      subschema.jtdMetadata = jtdMetadata;
    }
    exports2.extendSubschemaMode = extendSubschemaMode;
  }
});

// ../../node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "../../node_modules/fast-deep-equal/index.js"(exports2, module2) {
    "use strict";
    module2.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// ../../node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS({
  "../../node_modules/json-schema-traverse/index.js"(exports2, module2) {
    "use strict";
    var traverse = module2.exports = function(schema2, opts, cb) {
      if (typeof opts == "function") {
        cb = opts;
        opts = {};
      }
      cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      };
      var post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema2, "", schema2);
    };
    traverse.keywords = {
      additionalItems: true,
      items: true,
      contains: true,
      additionalProperties: true,
      propertyNames: true,
      not: true,
      if: true,
      then: true,
      else: true
    };
    traverse.arrayKeywords = {
      items: true,
      allOf: true,
      anyOf: true,
      oneOf: true
    };
    traverse.propsKeywords = {
      $defs: true,
      definitions: true,
      properties: true,
      patternProperties: true,
      dependencies: true
    };
    traverse.skipKeywords = {
      default: true,
      enum: true,
      const: true,
      required: true,
      maximum: true,
      minimum: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      multipleOf: true,
      maxLength: true,
      minLength: true,
      pattern: true,
      format: true,
      maxItems: true,
      minItems: true,
      uniqueItems: true,
      maxProperties: true,
      minProperties: true
    };
    function _traverse(opts, pre, post, schema2, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema2 && typeof schema2 == "object" && !Array.isArray(schema2)) {
        pre(schema2, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema2) {
          var sch = schema2[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords) {
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema2, i);
            }
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object") {
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema2, prop);
            }
          } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
            _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema2);
          }
        }
        post(schema2, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      }
    }
    function escapeJsonPtr(str2) {
      return str2.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  }
});

// ../../node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS({
  "../../node_modules/ajv/dist/compile/resolve.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getSchemaRefs = exports2.resolveUrl = exports2.normalizeId = exports2._getFullPath = exports2.getFullPath = exports2.inlineRef = void 0;
    var util_1 = require_util();
    var equal = require_fast_deep_equal();
    var traverse = require_json_schema_traverse();
    var SIMPLE_INLINED = /* @__PURE__ */ new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const"
    ]);
    function inlineRef(schema2, limit = true) {
      if (typeof schema2 == "boolean")
        return true;
      if (limit === true)
        return !hasRef(schema2);
      if (!limit)
        return false;
      return countKeys(schema2) <= limit;
    }
    exports2.inlineRef = inlineRef;
    var REF_KEYWORDS = /* @__PURE__ */ new Set([
      "$ref",
      "$recursiveRef",
      "$recursiveAnchor",
      "$dynamicRef",
      "$dynamicAnchor"
    ]);
    function hasRef(schema2) {
      for (const key in schema2) {
        if (REF_KEYWORDS.has(key))
          return true;
        const sch = schema2[key];
        if (Array.isArray(sch) && sch.some(hasRef))
          return true;
        if (typeof sch == "object" && hasRef(sch))
          return true;
      }
      return false;
    }
    function countKeys(schema2) {
      let count = 0;
      for (const key in schema2) {
        if (key === "$ref")
          return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
          continue;
        if (typeof schema2[key] == "object") {
          (0, util_1.eachItem)(schema2[key], (sch) => count += countKeys(sch));
        }
        if (count === Infinity)
          return Infinity;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      if (normalize !== false)
        id = normalizeId(id);
      const p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports2.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      const serialized = resolver.serialize(p);
      return serialized.split("#")[0] + "#";
    }
    exports2._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports2.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      id = normalizeId(id);
      return resolver.resolve(baseId, id);
    }
    exports2.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema2, baseId) {
      if (typeof schema2 == "boolean")
        return {};
      const { schemaId, uriResolver } = this.opts;
      const schId = normalizeId(schema2[schemaId] || baseId);
      const baseIds = { "": schId };
      const pathPrefix = getFullPath(uriResolver, schId, false);
      const localRefs = {};
      const schemaRefs = /* @__PURE__ */ new Set();
      traverse(schema2, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId] == "string")
          innerBaseId = addRef.call(this, sch[schemaId]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          const _resolve = this.opts.uriResolver.resolve;
          ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
          if (schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          if (typeof schOrRef == "string")
            schOrRef = this.refs[schOrRef];
          if (typeof schOrRef == "object") {
            checkAmbiguosRef(sch, schOrRef.schema, ref);
          } else if (ref !== normalizeId(fullPath)) {
            if (ref[0] === "#") {
              checkAmbiguosRef(sch, localRefs[ref], ref);
              localRefs[ref] = sch;
            } else {
              this.refs[ref] = fullPath;
            }
          }
          return ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      });
      return localRefs;
      function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== void 0 && !equal(sch1, sch2))
          throw ambiguos(ref);
      }
      function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
      }
    }
    exports2.getSchemaRefs = getSchemaRefs;
  }
});

// ../../node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS({
  "../../node_modules/ajv/dist/compile/validate/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.getData = exports2.KeywordCxt = exports2.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema();
    var dataType_1 = require_dataType();
    var applicability_1 = require_applicability();
    var dataType_2 = require_dataType();
    var defaults_1 = require_defaults();
    var keyword_1 = require_keyword();
    var subschema_1 = require_subschema();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var errors_1 = require_errors();
    function validateFunctionCode(it) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          topSchemaObjCode(it);
          return;
        }
      }
      validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
    }
    exports2.validateFunctionCode = validateFunctionCode;
    function validateFunction({ gen, validateName, schema: schema2, schemaEnv, opts }, body) {
      if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
          gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema2, opts)}`);
          destructureValCxtES5(gen, opts);
          gen.code(body);
        });
      } else {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema2, opts)).code(body));
      }
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it) {
      const { schema: schema2, opts, gen } = it;
      validateFunction(it, () => {
        if (opts.$comment && schema2.$comment)
          commentKeyword(it);
        checkNoDefault(it);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
          resetEvaluated(it);
        typeAndKeywords(it);
        returnResults(it);
      });
      return;
    }
    function resetEvaluated(it) {
      const { gen, validateName } = it;
      it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema2, opts) {
      const schId = typeof schema2 == "object" && schema2[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it, valid) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          subSchemaObjCode(it, valid);
          return;
        }
      }
      (0, boolSchema_1.boolOrEmptySchema)(it, valid);
    }
    function schemaCxtHasRules({ schema: schema2, self }) {
      if (typeof schema2 == "boolean")
        return !schema2;
      for (const key in schema2)
        if (self.RULES.all[key])
          return true;
      return false;
    }
    function isSchemaObj(it) {
      return typeof it.schema != "boolean";
    }
    function subSchemaObjCode(it, valid) {
      const { schema: schema2, gen, opts } = it;
      if (opts.$comment && schema2.$comment)
        commentKeyword(it);
      updateContext(it);
      checkAsyncSchema(it);
      const errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it, errsCount);
      gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it) {
      (0, util_1.checkUnknownRules)(it);
      checkRefsAndKeywords(it);
    }
    function typeAndKeywords(it, errsCount) {
      if (it.opts.jtd)
        return schemaKeywords(it, [], false, errsCount);
      const types = (0, dataType_1.getSchemaTypes)(it.schema);
      const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
      schemaKeywords(it, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it) {
      const { schema: schema2, errSchemaPath, opts, self } = it;
      if (schema2.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema2, self.RULES)) {
        self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
      }
    }
    function checkNoDefault(it) {
      const { schema: schema2, opts } = it;
      if (schema2.default !== void 0 && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
      }
    }
    function updateContext(it) {
      const schId = it.schema[it.opts.schemaId];
      if (schId)
        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
    }
    function checkAsyncSchema(it) {
      if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema: schema2, errSchemaPath, opts }) {
      const msg = schema2.$comment;
      if (opts.$comment === true) {
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      } else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it) {
      const { gen, schemaEnv, validateName, ValidationError, opts } = it;
      if (schemaEnv.$async) {
        gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
          assignEvaluated(it);
        gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
      }
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.props`, props);
      if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it, types, typeErrors, errsCount) {
      const { gen, schema: schema2, data, allErrors, opts, self } = it;
      const { RULES } = self;
      if (schema2.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema2, RULES))) {
        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
        return;
      }
      if (!opts.jtd)
        checkStrictTypes(it, types);
      gen.block(() => {
        for (const group of RULES.rules)
          groupKeywords(group);
        groupKeywords(RULES.post);
      });
      function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema2, group))
          return;
        if (group.type) {
          gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
          iterateKeywords(it, group);
          if (types.length === 1 && types[0] === group.type && typeErrors) {
            gen.else();
            (0, dataType_2.reportTypeError)(it);
          }
          gen.endIf();
        } else {
          iterateKeywords(it, group);
        }
        if (!allErrors)
          gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
      }
    }
    function iterateKeywords(it, group) {
      const { gen, schema: schema2, opts: { useDefaults } } = it;
      if (useDefaults)
        (0, defaults_1.assignDefaults)(it, group.type);
      gen.block(() => {
        for (const rule of group.rules) {
          if ((0, applicability_1.shouldUseRule)(schema2, rule)) {
            keywordCode(it, rule.keyword, rule.definition, group.type);
          }
        }
      });
    }
    function checkStrictTypes(it, types) {
      if (it.schemaEnv.meta || !it.opts.strictTypes)
        return;
      checkContextTypes(it, types);
      if (!it.opts.allowUnionTypes)
        checkMultipleTypes(it, types);
      checkKeywordTypes(it, it.dataTypes);
    }
    function checkContextTypes(it, types) {
      if (!types.length)
        return;
      if (!it.dataTypes.length) {
        it.dataTypes = types;
        return;
      }
      types.forEach((t) => {
        if (!includesType(it.dataTypes, t)) {
          strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
        }
      });
      narrowSchemaTypes(it, types);
    }
    function checkMultipleTypes(it, ts) {
      if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
      }
    }
    function checkKeywordTypes(it, ts) {
      const rules = it.self.RULES.all;
      for (const keyword in rules) {
        const rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
          const { type: type2 } = rule.definition;
          if (type2.length && !type2.some((t) => hasApplicableType(ts, t))) {
            strictTypesError(it, `missing type "${type2.join(",")}" for keyword "${keyword}"`);
          }
        }
      }
    }
    function hasApplicableType(schTs, kwdT) {
      return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
    }
    function includesType(ts, t) {
      return ts.includes(t) || t === "integer" && ts.includes("number");
    }
    function narrowSchemaTypes(it, withTypes) {
      const ts = [];
      for (const t of it.dataTypes) {
        if (includesType(withTypes, t))
          ts.push(t);
        else if (withTypes.includes("integer") && t === "number")
          ts.push("integer");
      }
      it.dataTypes = ts;
    }
    function strictTypesError(it, msg) {
      const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`;
      (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
        this.gen = it.gen;
        this.allErrors = it.allErrors;
        this.keyword = keyword;
        this.data = it.data;
        this.schema = it.schema[keyword];
        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it.schema;
        this.params = {};
        this.it = it;
        this.def = def;
        if (this.$data) {
          this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        } else {
          this.schemaCode = this.schemaValue;
          if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
            throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
          }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
          this.errsCount = it.gen.const("_errs", names_1.default.errors);
        }
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
          failAction();
        else
          this.error();
        if (successAction) {
          this.gen.else();
          successAction();
          if (this.allErrors)
            this.gen.endIf();
        } else {
          if (this.allErrors)
            this.gen.endIf();
          else
            this.gen.else();
        }
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error();
          if (!this.allErrors)
            this.gen.if(false);
          return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams);
          this._error(append, errorPaths);
          this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
      }
      $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
      }
      reset() {
        if (this.errsCount === void 0)
          throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
      }
      ok(cond) {
        if (!this.allErrors)
          this.gen.if(cond);
      }
      setParams(obj, assign) {
        if (assign)
          Object.assign(this.params, obj);
        else
          this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid);
          codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
          gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
          gen.elseIf(this.invalid$data());
          this.$dataError();
          if (valid !== codegen_1.nil)
            gen.assign(valid, false);
        }
        gen.else();
      }
      invalid$data() {
        const { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            const st = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        subschemaCode(nextContext, valid);
        return nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        const { it, gen } = this;
        if (!it.opts.unevaluated)
          return;
        if (it.props !== true && schemaCxt.props !== void 0) {
          it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
        }
        if (it.items !== true && schemaCxt.items !== void 0) {
          it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
        }
      }
      mergeValidEvaluated(schemaCxt, valid) {
        const { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
          gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
          return true;
        }
      }
    };
    exports2.KeywordCxt = KeywordCxt;
    function keywordCode(it, keyword, def, ruleType) {
      const cxt = new KeywordCxt(it, def, keyword);
      if ("code" in def) {
        def.code(cxt, ruleType);
      } else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      } else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
      } else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      }
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer;
      let data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
      } else {
        const matches = RELATIVE_JSON_POINTER.exec($data);
        if (!matches)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches[1];
        jsonPointer = matches[2];
        if (jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
          return data;
      }
      let expr = data;
      const segments = jsonPointer.split("/");
      for (const segment of segments) {
        if (segment) {
          data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
          expr = (0, codegen_1._)`${expr} && ${data}`;
        }
      }
      return expr;
      function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
      }
    }
    exports2.getData = getData;
  }
});

// ../../node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS({
  "../../node_modules/ajv/dist/runtime/validation_error.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
      }
    };
    exports2.default = ValidationError;
  }
});

// ../../node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "../../node_modules/ajv/dist/compile/ref_error.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var resolve_1 = require_resolve();
    var MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports2.default = MissingRefError;
  }
});

// ../../node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "../../node_modules/ajv/dist/compile/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.resolveSchema = exports2.getCompilingSchema = exports2.resolveRef = exports2.compileSchema = exports2.SchemaEnv = void 0;
    var codegen_1 = require_codegen();
    var validation_error_1 = require_validation_error();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var validate_1 = require_validate();
    var SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema2;
        if (typeof env.schema == "object")
          schema2 = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema2 === null || schema2 === void 0 ? void 0 : schema2[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema2 === null || schema2 === void 0 ? void 0 : schema2.$async;
        this.refs = {};
      }
    };
    exports2.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      const _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
      const { es5, lines } = this.opts.code;
      const { ownProperties } = this.opts;
      const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
      let _ValidationError;
      if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
          ref: validation_error_1.default,
          code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
        });
      }
      const validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil],
        // TODO can its length be used as dataLevel if nil is removed?
        dataLevel: 0,
        dataTypes: [],
        definedProperties: /* @__PURE__ */ new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._)`""`,
        opts: this.opts,
        self: this
      };
      let sourceCode;
      try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        if (this.opts.code.process)
          sourceCode = this.opts.code.process(sourceCode, sch);
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate });
        validate.errors = null;
        validate.schema = sch.schema;
        validate.schemaEnv = sch;
        if (sch.$async)
          validate.$async = true;
        if (this.opts.code.source === true) {
          validate.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
          const { props, items } = schemaCxt;
          validate.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          };
          if (validate.source)
            validate.source.evaluated = (0, codegen_1.stringify)(validate.evaluated);
        }
        sch.validate = validate;
        return sch;
      } catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
          this.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports2.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      const schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve7.call(this, root, ref);
      if (_sch === void 0) {
        const schema2 = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
        const { schemaId } = this.opts;
        if (schema2)
          _sch = new SchemaEnv({ schema: schema2, schemaId, root, baseId });
      }
      if (_sch === void 0)
        return;
      return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports2.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
      return sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
          return sch;
      }
    }
    exports2.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve7(root, ref) {
      let sch;
      while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      const p = this.opts.uriResolver.parse(ref);
      const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
      let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
      }
      const id = (0, resolve_1.normalizeId)(refPath);
      const schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
          return;
        return getJsonPointer.call(this, p, sch);
      }
      if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
      if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
      if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema: schema2 } = schOrRef;
        const { schemaId } = this.opts;
        const schId = schema2[schemaId];
        if (schId)
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema: schema2, schemaId, root, baseId });
      }
      return getJsonPointer.call(this, p, schOrRef);
    }
    exports2.resolveSchema = resolveSchema;
    var PREVENT_SCOPE_CHANGE = /* @__PURE__ */ new Set([
      "properties",
      "patternProperties",
      "enum",
      "dependencies",
      "definitions"
    ]);
    function getJsonPointer(parsedRef, { baseId, schema: schema2, root }) {
      var _a;
      if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
      for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema2 === "boolean")
          return;
        const partSchema = schema2[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema2 = partSchema;
        const schId = typeof schema2 === "object" && schema2[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
      }
      let env;
      if (typeof schema2 != "boolean" && schema2.$ref && !(0, util_1.schemaHasRulesButRef)(schema2, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema2.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      const { schemaId } = this.opts;
      env = env || new SchemaEnv({ schema: schema2, schemaId, root, baseId });
      if (env.schema !== env.root.schema)
        return env;
      return void 0;
    }
  }
});

// ../../node_modules/ajv/dist/refs/data.json
var require_data = __commonJS({
  "../../node_modules/ajv/dist/refs/data.json"(exports2, module2) {
    module2.exports = {
      $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
      type: "object",
      required: ["$data"],
      properties: {
        $data: {
          type: "string",
          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
        }
      },
      additionalProperties: false
    };
  }
});

// ../../node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS({
  "../../node_modules/fast-uri/lib/utils.js"(exports2, module2) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
    var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
    function stringArrayToHexStripped(input) {
      let acc = "";
      let code = 0;
      let i = 0;
      for (i = 0; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (code === 48) {
          continue;
        }
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
        break;
      }
      for (i += 1; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
      }
      return acc;
    }
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function consumeIsZone(buffer) {
      buffer.length = 0;
      return true;
    }
    function consumeHextets(buffer, address, output) {
      if (buffer.length) {
        const hex = stringArrayToHexStripped(buffer);
        if (hex !== "") {
          address.push(hex);
        } else {
          output.error = true;
          return false;
        }
        buffer.length = 0;
      }
      return true;
    }
    function getIPV6(input) {
      let tokenCount = 0;
      const output = { error: false, address: "", zone: "" };
      const address = [];
      const buffer = [];
      let endipv6Encountered = false;
      let endIpv6 = false;
      let consume = consumeHextets;
      for (let i = 0; i < input.length; i++) {
        const cursor = input[i];
        if (cursor === "[" || cursor === "]") {
          continue;
        }
        if (cursor === ":") {
          if (endipv6Encountered === true) {
            endIpv6 = true;
          }
          if (!consume(buffer, address, output)) {
            break;
          }
          if (++tokenCount > 7) {
            output.error = true;
            break;
          }
          if (i > 0 && input[i - 1] === ":") {
            endipv6Encountered = true;
          }
          address.push(":");
          continue;
        } else if (cursor === "%") {
          if (!consume(buffer, address, output)) {
            break;
          }
          consume = consumeIsZone;
        } else {
          buffer.push(cursor);
          continue;
        }
      }
      if (buffer.length) {
        if (consume === consumeIsZone) {
          output.zone = buffer.join("");
        } else if (endIpv6) {
          address.push(buffer.join(""));
        } else {
          address.push(stringArrayToHexStripped(buffer));
        }
      }
      output.address = address.join("");
      return output;
    }
    function normalizeIPv6(host) {
      if (findToken(host, ":") < 2) {
        return { host, isIPV6: false };
      }
      const ipv6 = getIPV6(host);
      if (!ipv6.error) {
        let newHost = ipv6.address;
        let escapedHost = ipv6.address;
        if (ipv6.zone) {
          newHost += "%" + ipv6.zone;
          escapedHost += "%25" + ipv6.zone;
        }
        return { host: newHost, isIPV6: true, escapedHost };
      } else {
        return { host, isIPV6: false };
      }
    }
    function findToken(str2, token) {
      let ind = 0;
      for (let i = 0; i < str2.length; i++) {
        if (str2[i] === token) ind++;
      }
      return ind;
    }
    function removeDotSegments(path12) {
      let input = path12;
      const output = [];
      let nextSlash = -1;
      let len = 0;
      while (len = input.length) {
        if (len === 1) {
          if (input === ".") {
            break;
          } else if (input === "/") {
            output.push("/");
            break;
          } else {
            output.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".") {
              break;
            } else if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/") {
            if (input[1] === "." || input[1] === "/") {
              output.push("/");
              break;
            }
          }
        } else if (len === 3) {
          if (input === "/..") {
            if (output.length !== 0) {
              output.pop();
            }
            output.push("/");
            break;
          }
        }
        if (input[0] === ".") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(3);
              continue;
            }
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(2);
              continue;
            } else if (input[2] === ".") {
              if (input[3] === "/") {
                input = input.slice(3);
                if (output.length !== 0) {
                  output.pop();
                }
                continue;
              }
            }
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output.push(input);
          break;
        } else {
          output.push(input.slice(0, nextSlash));
          input = input.slice(nextSlash);
        }
      }
      return output.join("");
    }
    function normalizeComponentEncoding(component, esc) {
      const func = esc !== true ? escape : unescape;
      if (component.scheme !== void 0) {
        component.scheme = func(component.scheme);
      }
      if (component.userinfo !== void 0) {
        component.userinfo = func(component.userinfo);
      }
      if (component.host !== void 0) {
        component.host = func(component.host);
      }
      if (component.path !== void 0) {
        component.path = func(component.path);
      }
      if (component.query !== void 0) {
        component.query = func(component.query);
      }
      if (component.fragment !== void 0) {
        component.fragment = func(component.fragment);
      }
      return component;
    }
    function recomposeAuthority(component) {
      const uriTokens = [];
      if (component.userinfo !== void 0) {
        uriTokens.push(component.userinfo);
        uriTokens.push("@");
      }
      if (component.host !== void 0) {
        let host = unescape(component.host);
        if (!isIPv4(host)) {
          const ipV6res = normalizeIPv6(host);
          if (ipV6res.isIPV6 === true) {
            host = `[${ipV6res.escapedHost}]`;
          } else {
            host = component.host;
          }
        }
        uriTokens.push(host);
      }
      if (typeof component.port === "number" || typeof component.port === "string") {
        uriTokens.push(":");
        uriTokens.push(String(component.port));
      }
      return uriTokens.length ? uriTokens.join("") : void 0;
    }
    module2.exports = {
      nonSimpleDomain,
      recomposeAuthority,
      normalizeComponentEncoding,
      removeDotSegments,
      isIPv4,
      isUUID,
      normalizeIPv6,
      stringArrayToHexStripped
    };
  }
});

// ../../node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS({
  "../../node_modules/fast-uri/lib/schemes.js"(exports2, module2) {
    "use strict";
    var { isUUID } = require_utils();
    var URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu;
    var supportedSchemeNames = (
      /** @type {const} */
      [
        "http",
        "https",
        "ws",
        "wss",
        "urn",
        "urn:uuid"
      ]
    );
    function isValidSchemeName(name) {
      return supportedSchemeNames.indexOf(
        /** @type {*} */
        name
      ) !== -1;
    }
    function wsIsSecure(wsComponent) {
      if (wsComponent.secure === true) {
        return true;
      } else if (wsComponent.secure === false) {
        return false;
      } else if (wsComponent.scheme) {
        return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
      } else {
        return false;
      }
    }
    function httpParse(component) {
      if (!component.host) {
        component.error = component.error || "HTTP URIs must have a host.";
      }
      return component;
    }
    function httpSerialize(component) {
      const secure = String(component.scheme).toLowerCase() === "https";
      if (component.port === (secure ? 443 : 80) || component.port === "") {
        component.port = void 0;
      }
      if (!component.path) {
        component.path = "/";
      }
      return component;
    }
    function wsParse(wsComponent) {
      wsComponent.secure = wsIsSecure(wsComponent);
      wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
      wsComponent.path = void 0;
      wsComponent.query = void 0;
      return wsComponent;
    }
    function wsSerialize(wsComponent) {
      if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
        wsComponent.port = void 0;
      }
      if (typeof wsComponent.secure === "boolean") {
        wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
        wsComponent.secure = void 0;
      }
      if (wsComponent.resourceName) {
        const [path12, query] = wsComponent.resourceName.split("?");
        wsComponent.path = path12 && path12 !== "/" ? path12 : void 0;
        wsComponent.query = query;
        wsComponent.resourceName = void 0;
      }
      wsComponent.fragment = void 0;
      return wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path) {
        urnComponent.error = "URN can not be parsed";
        return urnComponent;
      }
      const matches = urnComponent.path.match(URN_REG);
      if (matches) {
        const scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches[1].toLowerCase();
        urnComponent.nss = matches[2];
        const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
        const schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0;
        if (schemeHandler) {
          urnComponent = schemeHandler.parse(urnComponent, options);
        }
      } else {
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      }
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0) {
        throw new Error("URN without nid cannot be serialized");
      }
      const scheme = options.scheme || urnComponent.scheme || "urn";
      const nid = urnComponent.nid.toLowerCase();
      const urnScheme = `${scheme}:${options.nid || nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      if (schemeHandler) {
        urnComponent = schemeHandler.serialize(urnComponent, options);
      }
      const uriComponent = urnComponent;
      const nss = urnComponent.nss;
      uriComponent.path = `${nid || options.nid}:${nss}`;
      options.skipEscape = true;
      return uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      const uuidComponent = urnComponent;
      uuidComponent.uuid = uuidComponent.nss;
      uuidComponent.nss = void 0;
      if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
        uuidComponent.error = uuidComponent.error || "UUID is not valid.";
      }
      return uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      const urnComponent = uuidComponent;
      urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
      return urnComponent;
    }
    var http = (
      /** @type {SchemeHandler} */
      {
        scheme: "http",
        domainHost: true,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var https = (
      /** @type {SchemeHandler} */
      {
        scheme: "https",
        domainHost: http.domainHost,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var ws = (
      /** @type {SchemeHandler} */
      {
        scheme: "ws",
        domainHost: true,
        parse: wsParse,
        serialize: wsSerialize
      }
    );
    var wss = (
      /** @type {SchemeHandler} */
      {
        scheme: "wss",
        domainHost: ws.domainHost,
        parse: ws.parse,
        serialize: ws.serialize
      }
    );
    var urn = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn",
        parse: urnParse,
        serialize: urnSerialize,
        skipNormalize: true
      }
    );
    var urnuuid = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn:uuid",
        parse: urnuuidParse,
        serialize: urnuuidSerialize,
        skipNormalize: true
      }
    );
    var SCHEMES = (
      /** @type {Record<SchemeName, SchemeHandler>} */
      {
        http,
        https,
        ws,
        wss,
        urn,
        "urn:uuid": urnuuid
      }
    );
    Object.setPrototypeOf(SCHEMES, null);
    function getSchemeHandler(scheme) {
      return scheme && (SCHEMES[
        /** @type {SchemeName} */
        scheme
      ] || SCHEMES[
        /** @type {SchemeName} */
        scheme.toLowerCase()
      ]) || void 0;
    }
    module2.exports = {
      wsIsSecure,
      SCHEMES,
      isValidSchemeName,
      getSchemeHandler
    };
  }
});

// ../../node_modules/fast-uri/index.js
var require_fast_uri = __commonJS({
  "../../node_modules/fast-uri/index.js"(exports2, module2) {
    "use strict";
    var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizeComponentEncoding, isIPv4, nonSimpleDomain } = require_utils();
    var { SCHEMES, getSchemeHandler } = require_schemes();
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = /** @type {T} */
        serialize(parse(uri, options), options);
      } else if (typeof uri === "object") {
        uri = /** @type {T} */
        parse(serialize(uri, options), options);
      }
      return uri;
    }
    function resolve7(baseURI, relativeURI, options) {
      const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
      const resolved = resolveComponent(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, true);
      schemelessOptions.skipEscape = true;
      return serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative2, options, skipNormalization) {
      const target = {};
      if (!skipNormalization) {
        base = parse(serialize(base, options), options);
        relative2 = parse(serialize(relative2, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative2.scheme) {
        target.scheme = relative2.scheme;
        target.userinfo = relative2.userinfo;
        target.host = relative2.host;
        target.port = relative2.port;
        target.path = removeDotSegments(relative2.path || "");
        target.query = relative2.query;
      } else {
        if (relative2.userinfo !== void 0 || relative2.host !== void 0 || relative2.port !== void 0) {
          target.userinfo = relative2.userinfo;
          target.host = relative2.host;
          target.port = relative2.port;
          target.path = removeDotSegments(relative2.path || "");
          target.query = relative2.query;
        } else {
          if (!relative2.path) {
            target.path = base.path;
            if (relative2.query !== void 0) {
              target.query = relative2.query;
            } else {
              target.query = base.query;
            }
          } else {
            if (relative2.path[0] === "/") {
              target.path = removeDotSegments(relative2.path);
            } else {
              if ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path) {
                target.path = "/" + relative2.path;
              } else if (!base.path) {
                target.path = relative2.path;
              } else {
                target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative2.path;
              }
              target.path = removeDotSegments(target.path);
            }
            target.query = relative2.query;
          }
          target.userinfo = base.userinfo;
          target.host = base.host;
          target.port = base.port;
        }
        target.scheme = base.scheme;
      }
      target.fragment = relative2.fragment;
      return target;
    }
    function equal(uriA, uriB, options) {
      if (typeof uriA === "string") {
        uriA = unescape(uriA);
        uriA = serialize(normalizeComponentEncoding(parse(uriA, options), true), { ...options, skipEscape: true });
      } else if (typeof uriA === "object") {
        uriA = serialize(normalizeComponentEncoding(uriA, true), { ...options, skipEscape: true });
      }
      if (typeof uriB === "string") {
        uriB = unescape(uriB);
        uriB = serialize(normalizeComponentEncoding(parse(uriB, options), true), { ...options, skipEscape: true });
      } else if (typeof uriB === "object") {
        uriB = serialize(normalizeComponentEncoding(uriB, true), { ...options, skipEscape: true });
      }
      return uriA.toLowerCase() === uriB.toLowerCase();
    }
    function serialize(cmpts, opts) {
      const component = {
        host: cmpts.host,
        scheme: cmpts.scheme,
        userinfo: cmpts.userinfo,
        port: cmpts.port,
        path: cmpts.path,
        query: cmpts.query,
        nid: cmpts.nid,
        nss: cmpts.nss,
        uuid: cmpts.uuid,
        fragment: cmpts.fragment,
        reference: cmpts.reference,
        resourceName: cmpts.resourceName,
        secure: cmpts.secure,
        error: ""
      };
      const options = Object.assign({}, opts);
      const uriTokens = [];
      const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);
      if (component.path !== void 0) {
        if (!options.skipEscape) {
          component.path = escape(component.path);
          if (component.scheme !== void 0) {
            component.path = component.path.split("%3A").join(":");
          }
        } else {
          component.path = unescape(component.path);
        }
      }
      if (options.reference !== "suffix" && component.scheme) {
        uriTokens.push(component.scheme, ":");
      }
      const authority = recomposeAuthority(component);
      if (authority !== void 0) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (component.path && component.path[0] !== "/") {
          uriTokens.push("/");
        }
      }
      if (component.path !== void 0) {
        let s = component.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = removeDotSegments(s);
        }
        if (authority === void 0 && s[0] === "/" && s[1] === "/") {
          s = "/%2F" + s.slice(2);
        }
        uriTokens.push(s);
      }
      if (component.query !== void 0) {
        uriTokens.push("?", component.query);
      }
      if (component.fragment !== void 0) {
        uriTokens.push("#", component.fragment);
      }
      return uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
    function parse(uri, opts) {
      const options = Object.assign({}, opts);
      const parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      };
      let isIP = false;
      if (options.reference === "suffix") {
        if (options.scheme) {
          uri = options.scheme + ":" + uri;
        } else {
          uri = "//" + uri;
        }
      }
      const matches = uri.match(URI_PARSE);
      if (matches) {
        parsed.scheme = matches[1];
        parsed.userinfo = matches[3];
        parsed.host = matches[4];
        parsed.port = parseInt(matches[5], 10);
        parsed.path = matches[6] || "";
        parsed.query = matches[7];
        parsed.fragment = matches[8];
        if (isNaN(parsed.port)) {
          parsed.port = matches[5];
        }
        if (parsed.host) {
          const ipv4result = isIPv4(parsed.host);
          if (ipv4result === false) {
            const ipv6result = normalizeIPv6(parsed.host);
            parsed.host = ipv6result.host.toLowerCase();
            isIP = ipv6result.isIPV6;
          } else {
            isIP = true;
          }
        }
        if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) {
          parsed.reference = "same-document";
        } else if (parsed.scheme === void 0) {
          parsed.reference = "relative";
        } else if (parsed.fragment === void 0) {
          parsed.reference = "absolute";
        } else {
          parsed.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
          parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
        }
        const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
          if (parsed.host && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
            try {
              parsed.host = URL.domainToASCII(parsed.host.toLowerCase());
            } catch (e) {
              parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
            }
          }
        }
        if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
          if (uri.indexOf("%") !== -1) {
            if (parsed.scheme !== void 0) {
              parsed.scheme = unescape(parsed.scheme);
            }
            if (parsed.host !== void 0) {
              parsed.host = unescape(parsed.host);
            }
          }
          if (parsed.path) {
            parsed.path = escape(unescape(parsed.path));
          }
          if (parsed.fragment) {
            parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment));
          }
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(parsed, options);
        }
      } else {
        parsed.error = parsed.error || "URI can not be parsed.";
      }
      return parsed;
    }
    var fastUri = {
      SCHEMES,
      normalize,
      resolve: resolve7,
      resolveComponent,
      equal,
      serialize,
      parse
    };
    module2.exports = fastUri;
    module2.exports.default = fastUri;
    module2.exports.fastUri = fastUri;
  }
});

// ../../node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS({
  "../../node_modules/ajv/dist/runtime/uri.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports2.default = uri;
  }
});

// ../../node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "../../node_modules/ajv/dist/core.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.CodeGen = exports2.Name = exports2.nil = exports2.stringify = exports2.str = exports2._ = exports2.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports2, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports2, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports2, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports2, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports2, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports2, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports2, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    var ref_error_1 = require_ref_error();
    var rules_1 = require_rules();
    var compile_1 = require_compile();
    var codegen_2 = require_codegen();
    var resolve_1 = require_resolve();
    var dataType_1 = require_dataType();
    var util_1 = require_util();
    var $dataRefSchema = require_data();
    var uri_1 = require_uri();
    var defaultRegExp = (str2, flags) => new RegExp(str2, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
    var EXT_SCOPE_NAMES = /* @__PURE__ */ new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]);
    var removedOptions = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    };
    var deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    };
    var MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
      const s = o.strict;
      const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
      const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
      const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
      const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver
      };
    }
    var Ajv5 = class {
      constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = {};
        this._compilations = /* @__PURE__ */ new Set();
        this._loading = {};
        this._cache = /* @__PURE__ */ new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
          addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
          addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
          this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data, meta, schemaId } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId === "id") {
          _dataRefSchema = { ...$dataRefSchema };
          _dataRefSchema.id = _dataRefSchema.$id;
          delete _dataRefSchema.$id;
        }
        if (meta && $data)
          this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
      }
      defaultMeta() {
        const { meta, schemaId } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v;
        if (typeof schemaKeyRef == "string") {
          v = this.getSchema(schemaKeyRef);
          if (!v)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else {
          v = this.compile(schemaKeyRef);
        }
        const valid = v(data);
        if (!("$async" in v))
          this.errors = v.errors;
        return valid;
      }
      compile(schema2, _meta) {
        const sch = this._addSchema(schema2, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema2, meta) {
        if (typeof this.opts.loadSchema != "function") {
          throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema2, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          const sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          if ($ref && !this.getSchema($ref)) {
            await runCompileAsync.call(this, { $ref }, true);
          }
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            checkLoaded.call(this, e);
            await loadMissingSchema.call(this, e.missingSchema);
            return _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref]) {
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
          }
        }
        async function loadMissingSchema(ref) {
          const _schema = await _loadSchema.call(this, ref);
          if (!this.refs[ref])
            await loadMetaSchema.call(this, _schema.$schema);
          if (!this.refs[ref])
            this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          const p = this._loading[ref];
          if (p)
            return p;
          try {
            return await (this._loading[ref] = loadSchema(ref));
          } finally {
            delete this._loading[ref];
          }
        }
      }
      // Adds schema to the instance
      addSchema(schema2, key, _meta, _validateSchema = this.opts.validateSchema) {
        if (Array.isArray(schema2)) {
          for (const sch of schema2)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema2 === "object") {
          const { schemaId } = this.opts;
          id = schema2[schemaId];
          if (id !== void 0 && typeof id != "string") {
            throw new Error(`schema ${schemaId} must be string`);
          }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema2, _meta, key, _validateSchema, true);
        return this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(schema2, key, _validateSchema = this.opts.validateSchema) {
        this.addSchema(schema2, key, true, _validateSchema);
        return this;
      }
      //  Validate schema against its meta-schema
      validateSchema(schema2, throwOrLogError) {
        if (typeof schema2 == "boolean")
          return true;
        let $schema;
        $schema = schema2.$schema;
        if ($schema !== void 0 && typeof $schema != "string") {
          throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
          this.logger.warn("meta-schema not available");
          this.errors = null;
          return true;
        }
        const valid = this.validate($schema, schema2);
        if (!valid && throwOrLogError) {
          const message = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(message);
          else
            throw new Error(message);
        }
        return valid;
      }
      // Get compiled schema by `key` or `ref`.
      // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
      getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
          keyRef = sch;
        if (sch === void 0) {
          const { schemaId } = this.opts;
          const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
          sch = compile_1.resolveSchema.call(this, root, keyRef);
          if (!sch)
            return;
          this.refs[keyRef] = sch;
        }
        return sch.validate || this._compileSchemaEnv(sch);
      }
      // Remove cached schema(s).
      // If no parameter is passed all schemas but meta-schemas are removed.
      // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
      // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
      removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
          this._removeAllSchemas(this.schemas, schemaKeyRef);
          this._removeAllSchemas(this.refs, schemaKeyRef);
          return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            this._removeAllSchemas(this.schemas);
            this._removeAllSchemas(this.refs);
            this._cache.clear();
            return this;
          case "string": {
            const sch = getSchEnv.call(this, schemaKeyRef);
            if (typeof sch == "object")
              this._cache.delete(sch.schema);
            delete this.schemas[schemaKeyRef];
            delete this.refs[schemaKeyRef];
            return this;
          }
          case "object": {
            const cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            if (id) {
              id = (0, resolve_1.normalizeId)(id);
              delete this.schemas[id];
              delete this.refs[id];
            }
            return this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(definitions) {
        for (const def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string") {
          keyword = kwdOrDef;
          if (typeof def == "object") {
            this.logger.warn("these parameters are deprecated, see docs for addKeyword");
            def.keyword = keyword;
          }
        } else if (typeof kwdOrDef == "object" && def === void 0) {
          def = kwdOrDef;
          keyword = def.keyword;
          if (Array.isArray(keyword) && !keyword.length) {
            throw new Error("addKeywords: keyword must be string or non-empty array");
          }
        } else {
          throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
          (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
          return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
        return this;
      }
      getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      // Remove keyword
      removeKeyword(keyword) {
        const { RULES } = this;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        for (const group of RULES.rules) {
          const i = group.rules.findIndex((rule) => rule.keyword === keyword);
          if (i >= 0)
            group.rules.splice(i, 1);
        }
        return this;
      }
      // Add format
      addFormat(name, format) {
        if (typeof format == "string")
          format = new RegExp(format);
        this.formats[name] = format;
        return this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        if (!errors || errors.length === 0)
          return "No errors";
        return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
          const segments = jsonPointer.split("/").slice(1);
          let keywords = metaSchema;
          for (const seg of segments)
            keywords = keywords[seg];
          for (const key in rules) {
            const rule = rules[key];
            if (typeof rule != "object")
              continue;
            const { $data } = rule.definition;
            const schema2 = keywords[key];
            if ($data && schema2)
              keywords[key] = schemaOrData(schema2);
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas, regex) {
        for (const keyRef in schemas) {
          const sch = schemas[keyRef];
          if (!regex || regex.test(keyRef)) {
            if (typeof sch == "string") {
              delete schemas[keyRef];
            } else if (sch && !sch.meta) {
              this._cache.delete(sch.schema);
              delete schemas[keyRef];
            }
          }
        }
      }
      _addSchema(schema2, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId } = this.opts;
        if (typeof schema2 == "object") {
          id = schema2[schemaId];
        } else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          else if (typeof schema2 != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema2);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema2, baseId);
        sch = new compile_1.SchemaEnv({ schema: schema2, schemaId, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
          if (baseId)
            this._checkUnique(baseId);
          this.refs[baseId] = sch;
        }
        if (validateSchema)
          this.validateSchema(schema2, true);
        return sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
          throw new Error(`schema with key or id "${id}" already exists`);
        }
      }
      _compileSchemaEnv(sch) {
        if (sch.meta)
          this._compileMetaSchema(sch);
        else
          compile_1.compileSchema.call(this, sch);
        if (!sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
          compile_1.compileSchema.call(this, sch);
        } finally {
          this.opts = currentOpts;
        }
      }
    };
    Ajv5.ValidationError = validation_error_1.default;
    Ajv5.MissingRefError = ref_error_1.default;
    exports2.default = Ajv5;
    function checkOptions(checkOpts, options, msg, log = "error") {
      for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
          this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      keyRef = (0, resolve_1.normalizeId)(keyRef);
      return this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      const optsSchemas = this.opts.schemas;
      if (!optsSchemas)
        return;
      if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
      else
        for (const key in optsSchemas)
          this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (const name in this.opts.formats) {
        const format = this.opts.formats[name];
        if (format)
          this.addFormat(name, format);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
          def.keyword = keyword;
        this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      const metaOpts = { ...this.opts };
      for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === false)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      const { RULES } = this;
      (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      });
      if (!def)
        return;
      if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
      }
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      const post = definition === null || definition === void 0 ? void 0 : definition.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES } = this;
      let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
      if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES.rules.push(ruleGroup);
      }
      RULES.keywords[keyword] = true;
      if (!definition)
        return;
      const rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
      else
        ruleGroup.rules.push(rule);
      RULES.all[keyword] = rule;
      (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
      } else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
      }
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      if (metaSchema === void 0)
        return;
      if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
      def.validateSchema = this.compile(metaSchema, true);
    }
    var $dataRef = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function schemaOrData(schema2) {
      return { anyOf: [schema2, $dataRef] };
    }
  }
});

// ../../node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/core/id.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var def = {
      keyword: "id",
      code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/core/ref.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.callRef = exports2.getValidate = void 0;
    var ref_error_1 = require_ref_error();
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var util_1 = require_util();
    var def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        const { gen, schema: $ref, it } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self } = it;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          const rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          const v = getValidate(cxt, sch);
          callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
          const valid = gen.name("valid");
          const schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt);
          cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      const { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports2.getValidate = getValidate;
    function callRef(cxt, v, sch, $async) {
      const { gen, it } = cxt;
      const { allErrors, schemaEnv: env, opts } = it;
      const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      if ($async)
        callAsyncRef();
      else
        callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
          addEvaluatedFrom(v);
          if (!allErrors)
            gen.assign(valid, true);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
          addErrorsFrom(e);
          if (!allErrors)
            gen.assign(valid, false);
        });
        cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
      }
      function addErrorsFrom(source) {
        const errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
        gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
          return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it.props !== true) {
          if (schEvaluated && !schEvaluated.dynamicProps) {
            if (schEvaluated.props !== void 0) {
              it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
            }
          } else {
            const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
          }
        }
        if (it.items !== true) {
          if (schEvaluated && !schEvaluated.dynamicItems) {
            if (schEvaluated.items !== void 0) {
              it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
            }
          } else {
            const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
          }
        }
      }
    }
    exports2.callRef = callRef;
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/core/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var id_1 = require_id();
    var ref_1 = require_ref();
    var core2 = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      id_1.default,
      ref_1.default
    ];
    exports2.default = core2;
  }
});

// ../../node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/validation/limitNumber.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    var def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/validation/multipleOf.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    };
    var def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, it } = cxt;
        const prec = it.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "../../node_modules/ajv/dist/runtime/ucs2length.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    function ucs2length(str2) {
      const len = str2.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str2.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str2.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports2.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// ../../node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/validation/limitLength.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var ucs2length_1 = require_ucs2length();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode, it } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/validation/pattern.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var code_1 = require_code2();
    var util_1 = require_util();
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    };
    var def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema: schema2, schemaCode, it } = cxt;
        const u = it.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          const { regExp } = it.opts.code;
          const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
          const valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
          cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          const regExp = (0, code_1.usePattern)(cxt, schema2);
          cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
        }
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/validation/limitProperties.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/validation/required.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    };
    var def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, schemaCode, data, $data, it } = cxt;
        const { opts } = it;
        if (!$data && schema2.length === 0)
          return;
        const useLoop = schema2.length >= opts.loopRequired;
        if (it.allErrors)
          allErrorsMode();
        else
          exitOnErrorMode();
        if (opts.strictRequired) {
          const props = cxt.parentSchema.properties;
          const { definedProperties } = cxt.it;
          for (const requiredKey of schema2) {
            if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
              const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
              const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
            }
          }
        }
        function allErrorsMode() {
          if (useLoop || $data) {
            cxt.block$data(codegen_1.nil, loopAllRequired);
          } else {
            for (const prop of schema2) {
              (0, code_1.checkReportMissingProp)(cxt, prop);
            }
          }
        }
        function exitOnErrorMode() {
          const missing = gen.let("missing");
          if (useLoop || $data) {
            const valid = gen.let("valid", true);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid));
            cxt.ok(valid);
          } else {
            gen.if((0, code_1.checkMissingProp)(cxt, schema2, missing));
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
          }
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop });
            gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing });
          gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.error();
              gen.break();
            });
          }, codegen_1.nil);
        }
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/validation/limitItems.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "../../node_modules/ajv/dist/runtime/equal.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports2.default = equal;
  }
});

// ../../node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var dataType_1 = require_dataType();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
      params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
    };
    var def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema: schema2, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema2)
          return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
          const i = gen.let("i", (0, codegen_1._)`${data}.length`);
          const j = gen.let("j");
          cxt.setParams({ i, j });
          gen.assign(valid, true);
          gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
        }
        function loopN(i, j) {
          const item = gen.name("item");
          const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
          const indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`);
            gen.if(wrongType, (0, codegen_1._)`continue`);
            if (itemTypes.length > 1)
              gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
            gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
              cxt.error();
              gen.assign(valid, false).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j) {
          const eql = (0, util_1.useFunc)(gen, equal_1.default);
          const outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
            cxt.error();
            gen.assign(valid, false).break(outer);
          })));
        }
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/validation/const.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    };
    var def = {
      keyword: "const",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schemaCode, schema: schema2 } = cxt;
        if ($data || schema2 && typeof schema2 == "object") {
          cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        } else {
          cxt.fail((0, codegen_1._)`${schema2} !== ${data}`);
        }
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/validation/enum.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    };
    var def = {
      keyword: "enum",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema: schema2, schemaCode, it } = cxt;
        if (!$data && schema2.length === 0)
          throw new Error("enum must have non-empty array");
        const useLoop = schema2.length >= it.opts.loopEnum;
        let eql;
        const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
        let valid;
        if (useLoop || $data) {
          valid = gen.let("valid");
          cxt.block$data(valid, loopEnum);
        } else {
          if (!Array.isArray(schema2))
            throw new Error("ajv implementation error");
          const vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema2.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, false);
          gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
          const sch = schema2[i];
          return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
        }
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/validation/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var limitNumber_1 = require_limitNumber();
    var multipleOf_1 = require_multipleOf();
    var limitLength_1 = require_limitLength();
    var pattern_1 = require_pattern();
    var limitProperties_1 = require_limitProperties();
    var required_1 = require_required();
    var limitItems_1 = require_limitItems();
    var uniqueItems_1 = require_uniqueItems();
    var const_1 = require_const();
    var enum_1 = require_enum();
    var validation = [
      // number
      limitNumber_1.default,
      multipleOf_1.default,
      // string
      limitLength_1.default,
      pattern_1.default,
      // object
      limitProperties_1.default,
      required_1.default,
      // array
      limitItems_1.default,
      uniqueItems_1.default,
      // any
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      const_1.default,
      enum_1.default
    ];
    exports2.default = validation;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/additionalItems.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { parentSchema, it } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      const { gen, schema: schema2, data, keyword, it } = cxt;
      it.items = true;
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema2 === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      } else if (typeof schema2 == "object" && !(0, util_1.alwaysValidSchema)(it, schema2)) {
        const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
          if (!it.allErrors)
            gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
      }
    }
    exports2.validateAdditionalItems = validateAdditionalItems;
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/items.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.validateTuple = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        const { schema: schema2, it } = cxt;
        if (Array.isArray(schema2))
          return validateTuple(cxt, "additionalItems", schema2);
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema2))
          return;
        cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      const { gen, parentSchema, data, keyword, it } = cxt;
      checkStrictTuple(parentSchema);
      if (it.opts.unevaluated && schArr.length && it.items !== true) {
        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
      }
      const valid = gen.name("valid");
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
          return;
        gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid));
        cxt.ok(valid);
      });
      function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
          const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
          (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
        }
      }
    }
    exports2.validateTuple = validateTuple;
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/prefixItems.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var items_1 = require_items();
    var def = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/items2020.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var additionalItems_1 = require_additionalItems();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { schema: schema2, parentSchema, it } = cxt;
        const { prefixItems } = parentSchema;
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema2))
          return;
        if (prefixItems)
          (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
          cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    };
    var def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, parentSchema, data, it } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it.opts.next) {
          min = minContains === void 0 ? 1 : minContains;
          max = maxContains;
        } else {
          min = 1;
        }
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        cxt.setParams({ min, max });
        if (max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
          cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema2)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          if (max !== void 0)
            cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
          cxt.pass(cond);
          return;
        }
        it.items = true;
        const valid = gen.name("valid");
        if (max === void 0 && min === 1) {
          validateItems(valid, () => gen.if(valid, () => gen.break()));
        } else if (min === 0) {
          gen.let(valid, true);
          if (max !== void 0)
            gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
        } else {
          gen.let(valid, false);
          validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          const schValid = gen.name("_valid");
          const count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: true
            }, _valid);
            block();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`);
          if (max === void 0) {
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
          } else {
            gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
            if (min === 1)
              gen.assign(valid, true);
            else
              gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
          }
        }
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/dependencies.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.validateSchemaDeps = exports2.validatePropertyDeps = exports2.error = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    exports2.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
      },
      params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
      // TODO change to reference
    };
    var def = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: exports2.error,
      code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema: schema2 }) {
      const propertyDeps = {};
      const schemaDeps = {};
      for (const key in schema2) {
        if (key === "__proto__")
          continue;
        const deps = Array.isArray(schema2[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema2[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      const { gen, data, it } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      const missing = gen.let("missing");
      for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        });
        if (it.allErrors) {
          gen.if(hasProperty, () => {
            for (const depProp of deps) {
              (0, code_1.checkReportMissingProp)(cxt, depProp);
            }
          });
        } else {
          gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
    }
    exports2.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
          continue;
        gen.if(
          (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties),
          () => {
            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
          },
          () => gen.var(valid, true)
          // TODO var
        );
        cxt.ok(valid);
      }
    }
    exports2.validateSchemaDeps = validateSchemaDeps;
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    };
    var def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error,
      code(cxt) {
        const { gen, schema: schema2, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema2))
          return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key });
          cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: true
          }, valid);
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(true);
            if (!it.allErrors)
              gen.break();
          });
        });
        cxt.ok(valid);
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var util_1 = require_util();
    var error = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    };
    var def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: true,
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, parentSchema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, opts } = it;
        it.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema2))
          return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            if (!props.length && !patProps.length)
              additionalPropertyCode(key);
            else
              gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else if (props.length) {
            definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
          } else {
            definedProp = codegen_1.nil;
          }
          if (patProps.length) {
            definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
          }
          return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema2 === false) {
            deleteAdditional(key);
            return;
          }
          if (schema2 === false) {
            cxt.setParams({ additionalProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (typeof schema2 == "object" && !(0, util_1.alwaysValidSchema)(it, schema2)) {
            const valid = gen.name("valid");
            if (opts.removeAdditional === "failing") {
              applyAdditionalSchema(key, valid, false);
              gen.if((0, codegen_1.not)(valid), () => {
                cxt.reset();
                deleteAdditional(key);
              });
            } else {
              applyAdditionalSchema(key, valid);
              if (!allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          const subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          if (errors === false) {
            Object.assign(subschema, {
              compositeRule: true,
              createErrors: false,
              allErrors: false
            });
          }
          cxt.subschema(subschema, valid);
        }
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/properties.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var validate_1 = require_validate();
    var code_1 = require_code2();
    var util_1 = require_util();
    var additionalProperties_1 = require_additionalProperties();
    var def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema: schema2, parentSchema, data, it } = cxt;
        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) {
          additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema2);
        for (const prop of allProps) {
          it.definedProperties.add(prop);
        }
        if (it.opts.unevaluated && allProps.length && it.props !== true) {
          it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
        }
        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema2[p]));
        if (properties.length === 0)
          return;
        const valid = gen.name("valid");
        for (const prop of properties) {
          if (hasDefault(prop)) {
            applyPropertySchema(prop);
          } else {
            gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
            applyPropertySchema(prop);
            if (!it.allErrors)
              gen.else().var(valid, true);
            gen.endIf();
          }
          cxt.it.definedProperties.add(prop);
          cxt.ok(valid);
        }
        function hasDefault(prop) {
          return it.opts.useDefaults && !it.compositeRule && schema2[prop].default !== void 0;
        }
        function applyPropertySchema(prop) {
          cxt.subschema({
            keyword: "properties",
            schemaProp: prop,
            dataProp: prop
          }, valid);
        }
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/patternProperties.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var util_2 = require_util();
    var def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema: schema2, data, parentSchema, it } = cxt;
        const { opts } = it;
        const patterns = (0, code_1.allSchemaProperties)(schema2);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema2[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) {
          return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
          it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
        }
        const { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
          for (const pat of patterns) {
            if (checkProperties)
              checkMatchingProperties(pat);
            if (it.allErrors) {
              validateProperties(pat);
            } else {
              gen.var(valid, true);
              validateProperties(pat);
              gen.if(valid);
            }
          }
        }
        function checkMatchingProperties(pat) {
          for (const prop in checkProperties) {
            if (new RegExp(pat).test(prop)) {
              (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
            }
          }
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              const alwaysValid = alwaysValidPatterns.includes(pat);
              if (!alwaysValid) {
                cxt.subschema({
                  keyword: "patternProperties",
                  schemaProp: pat,
                  dataProp: key,
                  dataPropType: util_2.Type.Str
                }, valid);
              }
              if (it.opts.unevaluated && props !== true) {
                gen.assign((0, codegen_1._)`${props}[${key}]`, true);
              } else if (!alwaysValid && !it.allErrors) {
                gen.if((0, codegen_1.not)(valid), () => gen.break());
              }
            });
          });
        }
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/not.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      code(cxt) {
        const { gen, schema: schema2, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema2)) {
          cxt.fail();
          return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
      },
      error: { message: "must NOT be valid" }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/anyOf.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var code_1 = require_code2();
    var def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: true,
      code: code_1.validateUnion,
      error: { message: "must match a schema in anyOf" }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/oneOf.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    };
    var def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema: schema2, parentSchema, it } = cxt;
        if (!Array.isArray(schema2))
          throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
          return;
        const schArr = schema2;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            if ((0, util_1.alwaysValidSchema)(it, sch)) {
              gen.var(schValid, true);
            } else {
              schCxt = cxt.subschema({
                keyword: "oneOf",
                schemaProp: i,
                compositeRule: true
              }, schValid);
            }
            if (i > 0) {
              gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
            }
            gen.if(schValid, () => {
              gen.assign(valid, true);
              gen.assign(passing, i);
              if (schCxt)
                cxt.mergeEvaluated(schCxt, codegen_1.Name);
            });
          });
        }
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/allOf.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        const { gen, schema: schema2, it } = cxt;
        if (!Array.isArray(schema2))
          throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema2.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
          const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid);
          cxt.mergeEvaluated(schCxt);
        });
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/if.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    };
    var def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, parentSchema, it } = cxt;
        if (parentSchema.then === void 0 && parentSchema.else === void 0) {
          (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it, "then");
        const hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
          return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
          const ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause });
          gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else if (hasThen) {
          gen.if(schValid, validateClause("then"));
        } else {
          gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
          const schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: true,
            createErrors: false,
            allErrors: false
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            const schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid);
            cxt.mergeValidEvaluated(schCxt, valid);
            if (ifClause)
              gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
            else
              cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it, keyword) {
      const schema2 = it.schema[keyword];
      return schema2 !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema2);
    }
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it }) {
        if (parentSchema.if === void 0)
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/applicator/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var additionalItems_1 = require_additionalItems();
    var prefixItems_1 = require_prefixItems();
    var items_1 = require_items();
    var items2020_1 = require_items2020();
    var contains_1 = require_contains();
    var dependencies_1 = require_dependencies();
    var propertyNames_1 = require_propertyNames();
    var additionalProperties_1 = require_additionalProperties();
    var properties_1 = require_properties();
    var patternProperties_1 = require_patternProperties();
    var not_1 = require_not();
    var anyOf_1 = require_anyOf();
    var oneOf_1 = require_oneOf();
    var allOf_1 = require_allOf();
    var if_1 = require_if();
    var thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = false) {
      const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default
      ];
      if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
      else
        applicator.push(additionalItems_1.default, items_1.default);
      applicator.push(contains_1.default);
      return applicator;
    }
    exports2.default = getApplicator;
  }
});

// ../../node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/format/format.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    };
    var def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: true,
      error,
      code(cxt, ruleType) {
        const { gen, data, $data, schema: schema2, schemaCode, it } = cxt;
        const { opts, errSchemaPath, schemaEnv, self } = it;
        if (!opts.validateFormats)
          return;
        if ($data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self.formats,
            code: opts.code.formats
          });
          const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
          const fType = gen.let("fType");
          const format = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
          cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            if (opts.strictSchema === false)
              return codegen_1.nil;
            return (0, codegen_1._)`${schemaCode} && !${format}`;
          }
          function invalidFmt() {
            const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
            const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
            return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          const formatDef = self.formats[schema2];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === true)
            return;
          const [fmtType, format, fmtRef] = getFormat(formatDef);
          if (fmtType === ruleType)
            cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === false) {
              self.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema2}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema2)}` : void 0;
            const fmt = gen.scopeValue("formats", { key: schema2, ref: fmtDef, code });
            if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
              return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
            }
            return ["string", fmtDef, fmt];
          }
          function validCondition() {
            if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
              if (!schemaEnv.$async)
                throw new Error("async format in sync schema");
              return (0, codegen_1._)`await ${fmtRef}(${data})`;
            }
            return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
          }
        }
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/format/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var format_1 = require_format();
    var format = [format_1.default];
    exports2.default = format;
  }
});

// ../../node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/metadata.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.contentVocabulary = exports2.metadataVocabulary = void 0;
    exports2.metadataVocabulary = [
      "title",
      "description",
      "default",
      "deprecated",
      "readOnly",
      "writeOnly",
      "examples"
    ];
    exports2.contentVocabulary = [
      "contentMediaType",
      "contentEncoding",
      "contentSchema"
    ];
  }
});

// ../../node_modules/ajv/dist/vocabularies/draft7.js
var require_draft7 = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/draft7.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft7Vocabularies = [
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary
    ];
    exports2.default = draft7Vocabularies;
  }
});

// ../../node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/discriminator/types.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2["Tag"] = "tag";
      DiscrError2["Mapping"] = "mapping";
    })(DiscrError || (exports2.DiscrError = DiscrError = {}));
  }
});

// ../../node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "../../node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var types_1 = require_types();
    var compile_1 = require_compile();
    var ref_error_1 = require_ref_error();
    var util_1 = require_util();
    var error = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    };
    var def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error,
      code(cxt) {
        const { gen, data, schema: schema2, parentSchema, it } = cxt;
        const { oneOf } = parentSchema;
        if (!it.opts.discriminator) {
          throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema2.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema2.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
          const mapping = getMapping();
          gen.if(false);
          for (const tagValue in mapping) {
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
            gen.assign(valid, applyTagSchema(mapping[tagValue]));
          }
          gen.else();
          cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
          gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          const _valid = gen.name("valid");
          const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          cxt.mergeEvaluated(schCxt, codegen_1.Name);
          return _valid;
        }
        function getMapping() {
          var _a;
          const oneOfMapping = {};
          const topRequired = hasRequired(parentSchema);
          let tagRequired = true;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
              const ref = sch.$ref;
              sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
              if (sch instanceof compile_1.SchemaEnv)
                sch = sch.schema;
              if (sch === void 0)
                throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
            }
            const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object") {
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            }
            tagRequired = tagRequired && (topRequired || hasRequired(sch));
            addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required }) {
            return Array.isArray(required) && required.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const) {
              addMapping(sch.const, i);
            } else if (sch.enum) {
              for (const tagValue of sch.enum) {
                addMapping(tagValue, i);
              }
            } else {
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
            }
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping) {
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
            }
            oneOfMapping[tagValue] = i;
          }
        }
      }
    };
    exports2.default = def;
  }
});

// ../../node_modules/ajv/dist/refs/json-schema-draft-07.json
var require_json_schema_draft_07 = __commonJS({
  "../../node_modules/ajv/dist/refs/json-schema-draft-07.json"(exports2, module2) {
    module2.exports = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "http://json-schema.org/draft-07/schema#",
      title: "Core schema meta-schema",
      definitions: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $ref: "#" }
        },
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          allOf: [{ $ref: "#/definitions/nonNegativeInteger" }, { default: 0 }]
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      },
      type: ["object", "boolean"],
      properties: {
        $id: {
          type: "string",
          format: "uri-reference"
        },
        $schema: {
          type: "string",
          format: "uri"
        },
        $ref: {
          type: "string",
          format: "uri-reference"
        },
        $comment: {
          type: "string"
        },
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        readOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/definitions/nonNegativeInteger" },
        minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        additionalItems: { $ref: "#" },
        items: {
          anyOf: [{ $ref: "#" }, { $ref: "#/definitions/schemaArray" }],
          default: true
        },
        maxItems: { $ref: "#/definitions/nonNegativeInteger" },
        minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        contains: { $ref: "#" },
        maxProperties: { $ref: "#/definitions/nonNegativeInteger" },
        minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        required: { $ref: "#/definitions/stringArray" },
        additionalProperties: { $ref: "#" },
        definitions: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        properties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependencies: {
          type: "object",
          additionalProperties: {
            anyOf: [{ $ref: "#" }, { $ref: "#/definitions/stringArray" }]
          }
        },
        propertyNames: { $ref: "#" },
        const: true,
        enum: {
          type: "array",
          items: true,
          minItems: 1,
          uniqueItems: true
        },
        type: {
          anyOf: [
            { $ref: "#/definitions/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/definitions/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        format: { type: "string" },
        contentMediaType: { type: "string" },
        contentEncoding: { type: "string" },
        if: { $ref: "#" },
        then: { $ref: "#" },
        else: { $ref: "#" },
        allOf: { $ref: "#/definitions/schemaArray" },
        anyOf: { $ref: "#/definitions/schemaArray" },
        oneOf: { $ref: "#/definitions/schemaArray" },
        not: { $ref: "#" }
      },
      default: true
    };
  }
});

// ../../node_modules/ajv/dist/ajv.js
var require_ajv = __commonJS({
  "../../node_modules/ajv/dist/ajv.js"(exports2, module2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.MissingRefError = exports2.ValidationError = exports2.CodeGen = exports2.Name = exports2.nil = exports2.stringify = exports2.str = exports2._ = exports2.KeywordCxt = exports2.Ajv = void 0;
    var core_1 = require_core();
    var draft7_1 = require_draft7();
    var discriminator_1 = require_discriminator();
    var draft7MetaSchema = require_json_schema_draft_07();
    var META_SUPPORT_DATA = ["/properties"];
    var META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";
    var Ajv5 = class extends core_1.default {
      _addVocabularies() {
        super._addVocabularies();
        draft7_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        if (!this.opts.meta)
          return;
        const metaSchema = this.opts.$data ? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA) : draft7MetaSchema;
        this.addMetaSchema(metaSchema, META_SCHEMA_ID, false);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports2.Ajv = Ajv5;
    module2.exports = exports2 = Ajv5;
    module2.exports.Ajv = Ajv5;
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = Ajv5;
    var validate_1 = require_validate();
    Object.defineProperty(exports2, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports2, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports2, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports2, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports2, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports2, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports2, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports2, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports2, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// ../../_bmad/runtime/hooks/deferred-gap-governance.cjs
var require_deferred_gap_governance = __commonJS({
  "../../_bmad/runtime/hooks/deferred-gap-governance.cjs"(exports2, module2) {
    "use strict";
    var fs11 = require("node:fs");
    var path12 = require("node:path");
    var READINESS_REPORT_PATTERN = /^implementation-readiness-report-\d{4}-\d{2}-\d{2}\.md$/i;
    var DATE_PATTERN = /\b(\d{4}-\d{2}-\d{2})\b/;
    var REGISTER_FILE_NAME = "deferred-gap-register.yaml";
    var JOURNEY_LEDGER_FILES = ["journey-ledger.yaml", "journey-ledger.yml", "journey-ledger.md"];
    var INVARIANT_LEDGER_FILES = ["invariant-ledger.yaml", "invariant-ledger.yml", "invariant-ledger.md"];
    var TRACE_MAP_FILES = ["trace-map.json"];
    var CLOSURE_NOTES_DIR = "closure-notes";
    var RESOLUTION_KEYWORDS = [
      "resolved",
      "resolution evidence",
      "closed",
      "verified",
      "\u5DF2\u89E3\u51B3",
      "\u5DF2\u5173\u95ED",
      "\u9A8C\u8BC1\u901A\u8FC7",
      "\u89E3\u51B3\u8BC1\u660E"
    ];
    var COLUMN_ALIASES = {
      gap_id: ["gap id", "gap_id", "id", "gap"],
      description: ["\u63CF\u8FF0", "description", "desc"],
      reason: ["\u539F\u56E0", "reason"],
      resolution_target: ["\u89E3\u51B3\u65F6\u673A", "\u89E3\u51B3\u76EE\u6807", "resolution target", "resolution_target", "target sprint", "\u76EE\u6807 sprint"],
      owner: ["owner", "\u8D1F\u8D23\u4EBA", "\u8D23\u4EFB\u4EBA"],
      status_checkpoint: ["\u72B6\u6001\u68C0\u67E5\u70B9", "status checkpoint", "status_checkpoint", "checkpoint"],
      status: ["\u72B6\u6001", "status"],
      current_risk: ["\u5F53\u524D\u98CE\u9669", "current risk", "current_risk", "risk"],
      planned_work_items: ["planned work items", "planned_work_items", "planned stories", "planned_story_keys"],
      explicit_reason: ["explicit reason", "explicit_reason", "rationale", "defer reason", "\u5EF6\u671F\u539F\u56E0"]
    };
    function normalizeText3(value) {
      return String(value || "").replace(/`/g, "").replace(/<[^>]+>/g, "").replace(/\*\*/g, "").trim();
    }
    function normalizeKey(value) {
      return normalizeText3(value).toLowerCase().replace(/\s+/g, " ");
    }
    function normalizeSlashes(value) {
      return typeof value === "string" ? value.replace(/\\/g, "/") : value;
    }
    function resolveProjectPath(projectRoot, candidate) {
      if (!candidate || typeof candidate !== "string") return null;
      return path12.isAbsolute(candidate) ? candidate : path12.join(projectRoot, candidate);
    }
    function collectSections(markdown) {
      const lines = String(markdown || "").split(/\r?\n/);
      const sections = /* @__PURE__ */ new Map();
      let current = null;
      let buffer = [];
      for (const line of lines) {
        const match = /^(#{2,4})\s+(.*)$/.exec(line);
        if (match) {
          if (current) {
            sections.set(current, buffer.join("\n").trim());
          }
          current = match[2].trim();
          buffer = [];
          continue;
        }
        if (current) {
          buffer.push(line);
        }
      }
      if (current) {
        sections.set(current, buffer.join("\n").trim());
      }
      return sections;
    }
    function mapColumn(header) {
      const normalized = normalizeKey(header);
      for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (aliases.includes(normalized)) {
          return key;
        }
      }
      return null;
    }
    function splitMarkdownRow(line) {
      return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => normalizeText3(cell));
    }
    function parseMarkdownTable(sectionContent) {
      const lines = String(sectionContent || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      for (let index = 0; index < lines.length - 1; index += 1) {
        const header = lines[index];
        const separator = lines[index + 1];
        if (!header.includes("|") || !separator.includes("|")) {
          continue;
        }
        if (!/^\|?[\s:-|]+\|?$/u.test(separator)) {
          continue;
        }
        const headers = splitMarkdownRow(header);
        const mapped = headers.map(mapColumn);
        const rows = [];
        for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
          const row = lines[rowIndex];
          if (!row.includes("|")) {
            break;
          }
          if (/^(#{2,4})\s+/.test(row)) {
            break;
          }
          const cells = splitMarkdownRow(row);
          if (cells.length === 0) {
            continue;
          }
          const item = {};
          mapped.forEach((key, cellIndex) => {
            if (!key) return;
            const value = normalizeText3(cells[cellIndex] || "");
            if (value) {
              item[key] = value;
            }
          });
          if (item.gap_id) {
            rows.push(item);
          }
        }
        if (rows.length > 0) {
          return rows;
        }
      }
      return [];
    }
    function parseIndentedKeyValueLine(line) {
      const match = /^\s*[-*]?\s*([A-Za-z0-9 _-]+)\s*:\s*(.+?)\s*$/.exec(line);
      if (!match) return null;
      return {
        key: normalizeKey(match[1]),
        value: normalizeText3(match[2])
      };
    }
    function parseDeferredGapBullets(sectionContent) {
      const lines = String(sectionContent || "").split(/\r?\n/);
      const items = [];
      let current = null;
      for (const line of lines) {
        const indent = (line.match(/^\s*/) || [""])[0].length;
        const topLevelMatch = /^\s*[-*]\s+`?([A-Za-z0-9._-]+)`?\s*(?:[:|-]\s*(.+))?$/.exec(line);
        if (topLevelMatch && indent <= 1) {
          if (current && current.gap_id) {
            items.push(current);
          }
          current = {
            gap_id: normalizeText3(topLevelMatch[1])
          };
          const remainder = normalizeText3(topLevelMatch[2] || "");
          if (remainder) {
            current.description = remainder;
          }
          continue;
        }
        if (!current) {
          continue;
        }
        const kv = parseIndentedKeyValueLine(line);
        if (!kv) {
          continue;
        }
        if (COLUMN_ALIASES.reason.includes(kv.key)) current.reason = kv.value;
        if (COLUMN_ALIASES.owner.includes(kv.key)) current.owner = kv.value;
        if (COLUMN_ALIASES.status.includes(kv.key)) current.status = kv.value;
        if (COLUMN_ALIASES.current_risk.includes(kv.key)) current.current_risk = kv.value;
        if (COLUMN_ALIASES.resolution_target.includes(kv.key)) current.resolution_target = kv.value;
        if (COLUMN_ALIASES.status_checkpoint.includes(kv.key)) current.status_checkpoint = kv.value;
        if (COLUMN_ALIASES.description.includes(kv.key) && !current.description) current.description = kv.value;
      }
      if (current && current.gap_id) {
        items.push(current);
      }
      return items;
    }
    function mergeGapRecords(trackingRows, deferredRows, sourcePath) {
      const merged = /* @__PURE__ */ new Map();
      for (const row of [...deferredRows, ...trackingRows]) {
        if (!row || !row.gap_id) continue;
        const key = normalizeText3(row.gap_id);
        const existing = merged.get(key) || {
          gap_id: key,
          status: "deferred",
          source_path: sourcePath || null
        };
        merged.set(key, {
          ...existing,
          ...Object.fromEntries(
            Object.entries(row).filter(([, value]) => normalizeText3(value)).map(([field, value]) => [field, normalizeText3(value)])
          ),
          gap_id: key,
          source_path: sourcePath || null
        });
      }
      return [...merged.values()].sort((left, right) => left.gap_id.localeCompare(right.gap_id));
    }
    function extractDeferredGapsFromMarkdown(markdown, sourcePath) {
      const sections = collectSections(markdown);
      const trackingRows = parseMarkdownTable(sections.get("Deferred Gaps Tracking") || "");
      const deferredRows = [
        ...parseMarkdownTable(sections.get("Deferred Gaps") || ""),
        ...parseDeferredGapBullets(sections.get("Deferred Gaps") || "")
      ];
      const gaps = mergeGapRecords(trackingRows, deferredRows, sourcePath);
      const deferredSectionRaw = normalizeText3(sections.get("Deferred Gaps") || "");
      const explicit = sections.has("Deferred Gaps") && deferredSectionRaw !== "" && deferredSectionRaw !== "{{placeholder}}";
      return {
        gaps,
        explicit,
        sections
      };
    }
    function readDeferredGapsFromReport2(reportPath) {
      const markdown = fs11.readFileSync(reportPath, "utf8");
      const extracted = extractDeferredGapsFromMarkdown(markdown, reportPath);
      return {
        report_path: reportPath,
        markdown,
        gaps: extracted.gaps,
        explicit: extracted.explicit,
        sections: extracted.sections
      };
    }
    function extractDateToken(value) {
      const match = DATE_PATTERN.exec(String(value || ""));
      return match ? match[1] : null;
    }
    function reportSortValue(reportPath) {
      const dateToken = extractDateToken(path12.basename(reportPath));
      if (dateToken) {
        const time = Date.parse(`${dateToken}T00:00:00Z`);
        if (!Number.isNaN(time)) {
          return time;
        }
      }
      try {
        return fs11.statSync(reportPath).mtimeMs;
      } catch {
        return 0;
      }
    }
    function listReadinessReports(projectRoot) {
      const planningRoot = path12.join(projectRoot, "_bmad-output", "planning-artifacts");
      const found = [];
      function walk(dir) {
        if (!fs11.existsSync(dir)) return;
        const entries = fs11.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path12.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
            continue;
          }
          if (READINESS_REPORT_PATTERN.test(entry.name)) {
            found.push(fullPath);
          }
        }
      }
      walk(planningRoot);
      return found.sort((left, right) => reportSortValue(right) - reportSortValue(left));
    }
    function findPreviousReadinessReport(currentReportPath) {
      const directory = path12.dirname(currentReportPath);
      if (!fs11.existsSync(directory)) return null;
      const candidates = fs11.readdirSync(directory).filter((entry) => READINESS_REPORT_PATTERN.test(entry)).map((entry) => path12.join(directory, entry)).filter((fullPath) => path12.resolve(fullPath) !== path12.resolve(currentReportPath)).sort((left, right) => reportSortValue(right) - reportSortValue(left));
      return candidates[0] || null;
    }
    function hasResolutionEvidence(markdown, gapId) {
      const text = String(markdown || "");
      const evidencePattern = new RegExp(
        `${gapId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]{0,80}(?:${RESOLUTION_KEYWORDS.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
        "i"
      );
      const reversePattern = new RegExp(
        `(?:${RESOLUTION_KEYWORDS.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})[\\s\\S]{0,80}${gapId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i"
      );
      return evidencePattern.test(text) || reversePattern.test(text);
    }
    function compareDeferredGapReports(currentReportPath, previousReportPath) {
      if (!previousReportPath) {
        const current2 = readDeferredGapsFromReport2(currentReportPath);
        return {
          current: current2,
          previous: null,
          new_gaps: current2.gaps,
          retained_gaps: [],
          removed_without_evidence: [],
          updated_resolution_targets: [],
          missing_owner: current2.gaps.filter((gap) => !normalizeText3(gap.owner))
        };
      }
      const current = readDeferredGapsFromReport2(currentReportPath);
      const previous = readDeferredGapsFromReport2(previousReportPath);
      const currentById = new Map(current.gaps.map((gap) => [gap.gap_id, gap]));
      const previousById = new Map(previous.gaps.map((gap) => [gap.gap_id, gap]));
      const removedWithoutEvidence = [];
      const retained = [];
      const updatedTargets = [];
      for (const [gapId, previousGap] of previousById.entries()) {
        const currentGap = currentById.get(gapId);
        if (!currentGap) {
          if (!hasResolutionEvidence(current.markdown, gapId)) {
            removedWithoutEvidence.push({
              gap_id: gapId,
              previous: previousGap
            });
          }
          continue;
        }
        retained.push(currentGap);
        if (normalizeText3(previousGap.resolution_target) && normalizeText3(currentGap.resolution_target) && normalizeText3(previousGap.resolution_target) !== normalizeText3(currentGap.resolution_target)) {
          updatedTargets.push({
            gap_id: gapId,
            previous_target: normalizeText3(previousGap.resolution_target),
            current_target: normalizeText3(currentGap.resolution_target)
          });
        }
      }
      const newGaps = current.gaps.filter((gap) => !previousById.has(gap.gap_id));
      return {
        current,
        previous,
        new_gaps: newGaps,
        retained_gaps: retained,
        removed_without_evidence: removedWithoutEvidence,
        updated_resolution_targets: updatedTargets,
        missing_owner: current.gaps.filter((gap) => !normalizeText3(gap.owner))
      };
    }
    function deriveReadinessRemediationArtifactPath(reportPath) {
      return reportPath.replace(/implementation-readiness-report-/i, "implementation-readiness-remediation-");
    }
    function parseYamlModule() {
      const candidates = [
        "js-yaml",
        path12.join(process.cwd(), "node_modules", "js-yaml"),
        path12.join(process.cwd(), "..", "BMAD-Speckit-SDD-Flow", "node_modules", "js-yaml"),
        path12.join(__dirname, "..", "..", "..", "node_modules", "js-yaml"),
        path12.join(__dirname, "..", "..", "..", "..", "node_modules", "js-yaml")
      ];
      for (const candidate of candidates) {
        try {
          return require(candidate);
        } catch {
        }
      }
      throw new Error("Cannot resolve js-yaml for deferred gap governance");
    }
    function normalizeArray(value) {
      if (!Array.isArray(value)) return [];
      return value.map((item) => normalizeText3(item)).filter(Boolean);
    }
    function normalizeGapLifecycleStatus(value) {
      const normalized = normalizeText3(value).toLowerCase();
      if (["open", "deferred", "in_progress", "resolved", "expired", "carried_forward"].includes(normalized)) {
        return normalized;
      }
      return normalized || "open";
    }
    function normalizeGapRegisterRecord(gap) {
      const specIntake = gap && typeof gap.spec_intake === "object" ? gap.spec_intake : {};
      const planMapping = gap && typeof gap.plan_mapping === "object" ? gap.plan_mapping : {};
      const gapAnalysis = gap && typeof gap.gap_analysis === "object" ? gap.gap_analysis : {};
      const taskBinding = gap && typeof gap.task_binding === "object" ? gap.task_binding : {};
      const implementation = gap && typeof gap.implementation === "object" ? gap.implementation : {};
      const audit = gap && typeof gap.audit === "object" ? gap.audit : {};
      return {
        gap_id: normalizeText3(gap?.gap_id || gap?.id),
        title: normalizeText3(gap?.title || gap?.description),
        description: normalizeText3(gap?.description || gap?.title),
        source_type: normalizeText3(gap?.source_type || "inherited").toLowerCase() || "inherited",
        source_stage: normalizeText3(gap?.source_stage || ""),
        lifecycle_status: normalizeGapLifecycleStatus(gap?.lifecycle_status || gap?.status),
        owner: normalizeText3(gap?.owner),
        resolution_target: normalizeText3(gap?.resolution_target),
        current_risk: normalizeText3(gap?.current_risk),
        inherited_from: normalizeText3(gap?.inherited_from),
        journey_refs: normalizeArray(gap?.journey_refs),
        prod_path_refs: normalizeArray(gap?.prod_path_refs),
        smoke_test_refs: normalizeArray(gap?.smoke_test_refs),
        full_e2e_refs: normalizeArray(gap?.full_e2e_refs),
        closure_note_refs: normalizeArray(gap?.closure_note_refs),
        spec_intake: {
          status: normalizeText3(specIntake.status).toLowerCase(),
          section_refs: normalizeArray(specIntake.section_refs),
          notes: normalizeText3(specIntake.notes)
        },
        plan_mapping: {
          status: normalizeText3(planMapping.status).toLowerCase(),
          architecture_refs: normalizeArray(planMapping.architecture_refs),
          work_item_refs: normalizeArray(planMapping.work_item_refs),
          journey_refs: normalizeArray(planMapping.journey_refs),
          prod_path_refs: normalizeArray(planMapping.prod_path_refs)
        },
        gap_analysis: {
          classification: normalizeText3(gapAnalysis.classification).toLowerCase(),
          notes: normalizeText3(gapAnalysis.notes)
        },
        task_binding: {
          status: normalizeText3(taskBinding.status).toLowerCase(),
          task_ids: normalizeArray(taskBinding.task_ids),
          smoke_task_ids: normalizeArray(taskBinding.smoke_task_ids),
          closure_task_id: normalizeText3(taskBinding.closure_task_id),
          explicit_defer_reason: normalizeText3(taskBinding.explicit_defer_reason || taskBinding.rationale)
        },
        implementation: {
          status: normalizeGapLifecycleStatus(implementation.status || gap?.implementation_status || gap?.lifecycle_status),
          closure_evidence: normalizeArray(implementation.closure_evidence),
          carry_forward_evidence: normalizeArray(implementation.carry_forward_evidence),
          production_path_evidence: normalizeArray(implementation.production_path_evidence),
          smoke_e2e_evidence: normalizeArray(implementation.smoke_e2e_evidence),
          full_e2e_evidence: normalizeArray(implementation.full_e2e_evidence),
          full_e2e_defer_reason: normalizeText3(implementation.full_e2e_defer_reason),
          acceptance_evidence: normalizeArray(implementation.acceptance_evidence)
        },
        audit: {
          last_verified_stage: normalizeText3(audit.last_verified_stage),
          last_verified_at: normalizeText3(audit.last_verified_at),
          notes: normalizeText3(audit.notes)
        }
      };
    }
    function resolveFeatureArtifactRoot(projectRoot, options = {}) {
      const candidates = [];
      const explicitRoot = resolveProjectPath(projectRoot, options.artifactRoot);
      const explicitArtifact = resolveProjectPath(projectRoot, options.artifactPath);
      const explicitRegister = resolveProjectPath(projectRoot, options.registerPath);
      if (explicitRoot) candidates.push(explicitRoot);
      if (explicitArtifact) candidates.push(path12.dirname(explicitArtifact));
      if (explicitRegister) candidates.push(path12.dirname(explicitRegister));
      const unique5 = [];
      for (const candidate of candidates) {
        if (!candidate) continue;
        const resolved = path12.resolve(candidate);
        if (!unique5.includes(resolved)) unique5.push(resolved);
      }
      return unique5[0] || projectRoot;
    }
    function resolveDeferredGapRegisterLocation(projectRoot, options = {}) {
      const featureRoot = resolveFeatureArtifactRoot(projectRoot, options);
      return {
        feature_root: featureRoot,
        register_path: path12.join(featureRoot, REGISTER_FILE_NAME)
      };
    }
    function loadDeferredGapRegister(projectRoot, options = {}) {
      const yaml = parseYamlModule();
      const resolved = resolveDeferredGapRegisterLocation(projectRoot, options);
      if (!fs11.existsSync(resolved.register_path)) {
        return {
          ...resolved,
          exists: false,
          document: null,
          gaps: []
        };
      }
      const document = yaml.load(fs11.readFileSync(resolved.register_path, "utf8")) || {};
      const gaps = Array.isArray(document.gaps) ? document.gaps.map((gap) => normalizeGapRegisterRecord(gap)).filter((gap) => gap.gap_id) : [];
      return {
        ...resolved,
        exists: true,
        document,
        gaps
      };
    }
    function isActiveGap(gap) {
      const status = normalizeGapLifecycleStatus(gap?.lifecycle_status || gap?.implementation?.status || gap?.status);
      return status !== "resolved" && status !== "closed";
    }
    function findFirstExistingFile(baseDir, candidates) {
      for (const fileName of candidates) {
        const fullPath = path12.join(baseDir, fileName);
        if (fs11.existsSync(fullPath)) return fullPath;
      }
      return null;
    }
    function findTasksArtifact(baseDir, explicitArtifactPath) {
      if (explicitArtifactPath && /^tasks/i.test(path12.basename(explicitArtifactPath))) {
        return explicitArtifactPath;
      }
      if (!fs11.existsSync(baseDir)) return null;
      const matches = fs11.readdirSync(baseDir).filter((entry) => /^tasks.*\.md$/i.test(entry)).map((entry) => path12.join(baseDir, entry)).sort((left, right) => left.localeCompare(right));
      return matches[0] || null;
    }
    function parseSharedPathReferences(markdown) {
      const lines = String(markdown || "").split(/\r?\n/);
      const refs = {
        journey_ledger: "",
        invariant_ledger: "",
        trace_map: ""
      };
      for (const line of lines) {
        const journeyMatch = /Shared Journey Ledger Path\s*[:：]\s*(.+)\s*$/i.exec(line);
        if (journeyMatch) refs.journey_ledger = normalizeText3(journeyMatch[1]);
        const invariantMatch = /Shared Invariant Ledger Path\s*[:：]\s*(.+)\s*$/i.exec(line);
        if (invariantMatch) refs.invariant_ledger = normalizeText3(invariantMatch[1]);
        const traceMatch = /Shared Trace Map Path\s*[:：]\s*(.+)\s*$/i.exec(line);
        if (traceMatch) refs.trace_map = normalizeText3(traceMatch[1]);
      }
      return refs;
    }
    function collectJourneyArtifacts(projectRoot, options = {}) {
      const resolved = resolveDeferredGapRegisterLocation(projectRoot, options);
      const featureRoot = resolved.feature_root;
      const explicitArtifactPath = resolveProjectPath(projectRoot, options.artifactPath);
      const tasksPath = findTasksArtifact(featureRoot, explicitArtifactPath);
      const tasksMarkdown = tasksPath && fs11.existsSync(tasksPath) ? fs11.readFileSync(tasksPath, "utf8") : "";
      const tasksSections = collectSections(tasksMarkdown);
      const standalone = {
        journey_ledger: findFirstExistingFile(featureRoot, JOURNEY_LEDGER_FILES),
        invariant_ledger: findFirstExistingFile(featureRoot, INVARIANT_LEDGER_FILES),
        trace_map: findFirstExistingFile(featureRoot, TRACE_MAP_FILES),
        closure_notes_dir: fs11.existsSync(path12.join(featureRoot, CLOSURE_NOTES_DIR)) ? path12.join(featureRoot, CLOSURE_NOTES_DIR) : null
      };
      const closureNoteFiles = standalone.closure_notes_dir ? fs11.readdirSync(standalone.closure_notes_dir).filter((entry) => /\.md$/i.test(entry)).map((entry) => path12.join(standalone.closure_notes_dir, entry)) : [];
      return {
        feature_root: featureRoot,
        tasks_path: tasksPath,
        tasks_markdown: tasksMarkdown,
        tasks_sections: tasksSections,
        standalone,
        closure_note_files: closureNoteFiles,
        embedded: {
          journey_ledger: tasksSections.has("P0 Journey Ledger"),
          invariant_ledger: tasksSections.has("Invariant Ledger"),
          journey_trace_closure: tasksSections.has("Journey -> Task -> Test -> Closure") || tasksSections.has("Journey -> Task -> Test -> Closure \u6620\u5C04"),
          closure_notes: tasksSections.has("Closure Notes")
        },
        shared_path_refs: parseSharedPathReferences(tasksMarkdown)
      };
    }
    function validateJourneyArtifactPrecedence(artifacts) {
      const failures = [];
      const hasStandalone = Object.values(artifacts.standalone).some((value) => Boolean(value));
      if (!hasStandalone) {
        return failures;
      }
      if (artifacts.standalone.journey_ledger && artifacts.embedded.journey_ledger && !normalizeText3(artifacts.shared_path_refs.journey_ledger)) {
        failures.push("journey_artifact_precedence: standalone journey-ledger exists but tasks.md does not declare Shared Journey Ledger Path");
      }
      if (artifacts.standalone.invariant_ledger && artifacts.embedded.invariant_ledger && !normalizeText3(artifacts.shared_path_refs.invariant_ledger)) {
        failures.push("journey_artifact_precedence: standalone invariant-ledger exists but tasks.md does not declare Shared Invariant Ledger Path");
      }
      if (artifacts.standalone.trace_map && artifacts.embedded.journey_trace_closure && !normalizeText3(artifacts.shared_path_refs.trace_map)) {
        failures.push("journey_artifact_precedence: standalone trace-map exists but tasks.md does not declare Shared Trace Map Path");
      }
      const compareRef = (declaredPath, actualPath, label) => {
        if (!declaredPath || !actualPath) return;
        const declaredBase = path12.basename(normalizeSlashes(declaredPath)).toLowerCase();
        const actualBase = path12.basename(normalizeSlashes(actualPath)).toLowerCase();
        if (declaredBase !== actualBase) {
          failures.push(`journey_artifact_precedence: ${label} mismatch between tasks.md and standalone artifact`);
        }
      };
      compareRef(artifacts.shared_path_refs.journey_ledger, artifacts.standalone.journey_ledger, "Shared Journey Ledger Path");
      compareRef(artifacts.shared_path_refs.invariant_ledger, artifacts.standalone.invariant_ledger, "Shared Invariant Ledger Path");
      compareRef(artifacts.shared_path_refs.trace_map, artifacts.standalone.trace_map, "Shared Trace Map Path");
      return failures;
    }
    function resolveInheritedDeferredGapInputs(projectRoot) {
      const sprintPlan = readSprintDeferredGapPlan(projectRoot);
      if (sprintPlan.items.size > 0) {
        return {
          source: "sprint-status",
          gaps: [...sprintPlan.items.values()]
        };
      }
      const latestReadinessReport = listReadinessReports(projectRoot)[0];
      if (latestReadinessReport) {
        return {
          source: "readiness",
          gaps: readDeferredGapsFromReport2(latestReadinessReport).gaps
        };
      }
      return {
        source: "none",
        gaps: []
      };
    }
    function validateDeferredGapStageContract(projectRoot, input) {
      const failures = [];
      const register = loadDeferredGapRegister(projectRoot, input);
      const stage = normalizeText3(input.stage || "").toLowerCase();
      const sections = input.sections || /* @__PURE__ */ new Map();
      const activeGaps = register.gaps.filter((gap) => isActiveGap(gap));
      const inheritedSource = resolveInheritedDeferredGapInputs(projectRoot);
      if (!register.exists) {
        failures.push(`deferred_gap_register_missing: missing ${REGISTER_FILE_NAME}`);
        return { failures, register, journeyArtifacts: null };
      }
      for (const sourceGap of inheritedSource.gaps) {
        const sourceGapId = normalizeText3(sourceGap.gap_id || sourceGap.id);
        if (!sourceGapId) continue;
        if (!register.gaps.find((gap) => gap.gap_id === sourceGapId)) {
          failures.push(`deferred_gap_register_consistency: inherited gap ${sourceGapId} is missing from ${REGISTER_FILE_NAME}`);
        }
      }
      const requireSection = (sectionName, code) => {
        if (!sections.has(sectionName)) {
          failures.push(`${code}: missing section content: ${sectionName}`);
        }
      };
      if (stage === "specify") {
        requireSection("Inherited Deferred Gaps", "deferred_gap_intake");
        requireSection("Deferred Gap Intake Mapping", "deferred_gap_intake");
        for (const gap of activeGaps.filter((gap2) => gap2.source_type !== "new")) {
          if (gap.spec_intake.status !== "acknowledged") {
            failures.push(`deferred_gap_intake: gap ${gap.gap_id} is not acknowledged in spec_intake`);
          }
        }
        return { failures, register, journeyArtifacts: null };
      }
      if (stage === "plan") {
        requireSection("Deferred Gap Architecture Mapping", "deferred_gap_plan_mapping");
        for (const gap of activeGaps) {
          const mapped = gap.plan_mapping.status === "mapped";
          const hasRefs = gap.plan_mapping.architecture_refs.length > 0 || gap.plan_mapping.work_item_refs.length > 0;
          if (!mapped || !hasRefs) {
            failures.push(`deferred_gap_plan_mapping: gap ${gap.gap_id} is not fully mapped`);
          }
          if (gap.journey_refs.length === 0 && gap.plan_mapping.journey_refs.length === 0) {
            failures.push(`deferred_gap_plan_mapping: gap ${gap.gap_id} is missing journey_refs`);
          }
          if (gap.prod_path_refs.length === 0 && gap.plan_mapping.prod_path_refs.length === 0) {
            failures.push(`deferred_gap_plan_mapping: gap ${gap.gap_id} is missing prod_path_refs`);
          }
        }
        return { failures, register, journeyArtifacts: null };
      }
      if (stage === "gaps") {
        requireSection("Deferred Gap Lifecycle Classification", "deferred_gap_lifecycle");
        for (const gap of register.gaps) {
          const classification = normalizeText3(gap.gap_analysis.classification).toLowerCase();
          if (!classification) {
            failures.push(`deferred_gap_lifecycle: gap ${gap.gap_id} is missing lifecycle classification`);
            continue;
          }
          if (gap.source_type === "new" && classification !== "new_gap") {
            failures.push(`deferred_gap_lifecycle: gap ${gap.gap_id} must classify as new_gap`);
          }
          if (gap.source_type !== "new" && !["inherited_open", "inherited_resolved_candidate", "inherited_redeferred"].includes(classification)) {
            failures.push(`deferred_gap_lifecycle: gap ${gap.gap_id} has invalid inherited classification ${classification}`);
          }
        }
        return { failures, register, journeyArtifacts: null };
      }
      const journeyArtifacts = collectJourneyArtifacts(projectRoot, input);
      failures.push(...validateJourneyArtifactPrecedence(journeyArtifacts));
      const hasJourneyLedger = Boolean(journeyArtifacts.standalone.journey_ledger) || journeyArtifacts.embedded.journey_ledger;
      const hasTraceMap = Boolean(journeyArtifacts.standalone.trace_map) || journeyArtifacts.embedded.journey_trace_closure;
      const hasClosureNotes = journeyArtifacts.closure_note_files.length > 0 || journeyArtifacts.embedded.closure_notes;
      if (stage === "tasks") {
        requireSection("Deferred Gap Task Binding", "deferred_gap_task_binding");
        requireSection("P0 Journey Ledger", "journey_runnable_task_chain");
        if (!journeyArtifacts.embedded.journey_trace_closure) {
          failures.push("journey_runnable_task_chain: missing section content: Journey -> Task -> Test -> Closure");
        }
        if (!journeyArtifacts.tasks_markdown.includes("Smoke Task Chain")) {
          failures.push("journey_runnable_task_chain: missing keyword: Smoke Task Chain");
        }
        if (!journeyArtifacts.tasks_markdown.includes("Closure Task ID")) {
          failures.push("journey_runnable_task_chain: missing keyword: Closure Task ID");
        }
        if (!hasJourneyLedger) {
          failures.push("journey_runnable_task_chain: missing journey-ledger source");
        }
        if (!hasTraceMap) {
          failures.push("journey_runnable_task_chain: missing trace-map source");
        }
        for (const gap of activeGaps) {
          const hasTaskIds = gap.task_binding.task_ids.length > 0;
          const hasExplicitDefer = normalizeText3(gap.task_binding.explicit_defer_reason) !== "";
          if (!hasTaskIds && !hasExplicitDefer) {
            failures.push(`deferred_gap_task_binding: gap ${gap.gap_id} has neither task_ids nor explicit_defer_reason`);
          }
          if (hasTaskIds && gap.journey_refs.length > 0) {
            if (gap.task_binding.smoke_task_ids.length === 0) {
              failures.push(`journey_runnable_task_chain: gap ${gap.gap_id} is missing smoke_task_ids`);
            }
            if (!normalizeText3(gap.task_binding.closure_task_id)) {
              failures.push(`journey_runnable_task_chain: gap ${gap.gap_id} is missing closure_task_id`);
            }
          }
        }
        return { failures, register, journeyArtifacts };
      }
      if (stage === "implement") {
        if (!hasJourneyLedger) {
          failures.push("journey_runnable_proof_gate: missing journey-ledger source");
        }
        if (!hasTraceMap) {
          failures.push("journey_runnable_proof_gate: missing trace-map source");
        }
        if (!hasClosureNotes) {
          failures.push("journey_runnable_proof_gate: missing closure-note source");
        }
        for (const gap of register.gaps) {
          const implementation = gap.implementation || {};
          const implementationStatus = normalizeGapLifecycleStatus(implementation.status || gap.lifecycle_status);
          if (implementationStatus === "resolved") {
            if (implementation.closure_evidence.length === 0) {
              failures.push(`deferred_gap_resolution_or_carry_forward: gap ${gap.gap_id} is resolved without closure evidence`);
            }
            if (implementation.production_path_evidence.length === 0 && gap.prod_path_refs.length === 0) {
              failures.push(`production_path_integration_gate: gap ${gap.gap_id} is resolved without production path evidence`);
            }
            if (implementation.smoke_e2e_evidence.length === 0 && gap.smoke_test_refs.length === 0) {
              failures.push(`journey_runnable_proof_gate: gap ${gap.gap_id} is resolved without smoke proof`);
            }
            if (implementation.full_e2e_evidence.length === 0 && normalizeText3(implementation.full_e2e_defer_reason) === "" && gap.full_e2e_refs.length === 0) {
              failures.push(`journey_runnable_proof_gate: gap ${gap.gap_id} is resolved without full E2E proof or defer reason`);
            }
            if (implementation.acceptance_evidence.length === 0) {
              failures.push(`journey_runnable_proof_gate: gap ${gap.gap_id} is resolved without acceptance evidence`);
            }
            if (gap.journey_refs.length === 0) {
              failures.push(`journey_runnable_proof_gate: gap ${gap.gap_id} is resolved without journey_refs`);
            }
          } else if (isActiveGap(gap)) {
            if (implementation.carry_forward_evidence.length === 0) {
              failures.push(`deferred_gap_resolution_or_carry_forward: gap ${gap.gap_id} remains active without carry-forward evidence`);
            }
          }
        }
        return { failures, register, journeyArtifacts };
      }
      return { failures, register, journeyArtifacts };
    }
    function readSprintDeferredGapPlan(projectRoot) {
      const sprintPath = path12.join(projectRoot, "_bmad-output", "implementation-artifacts", "sprint-status.yaml");
      if (!fs11.existsSync(sprintPath)) {
        return {
          sprint_path: sprintPath,
          items: /* @__PURE__ */ new Map()
        };
      }
      const yaml = parseYamlModule();
      const doc = yaml.load(fs11.readFileSync(sprintPath, "utf8")) || {};
      const rawPlan = doc.deferred_gap_plan || {};
      const items = /* @__PURE__ */ new Map();
      const rawItems = rawPlan.items || {};
      if (Array.isArray(rawItems)) {
        for (const item of rawItems) {
          const gapId = normalizeText3(item?.gap_id || item?.id);
          if (!gapId) continue;
          items.set(gapId, {
            gap_id: gapId,
            status: normalizeText3(item.status),
            resolution_target: normalizeText3(item.resolution_target),
            owner: normalizeText3(item.owner),
            explicit_reason: normalizeText3(item.explicit_reason || item.rationale),
            planned_work_items: Array.isArray(item.planned_work_items) ? item.planned_work_items.map((value) => normalizeText3(value)).filter(Boolean) : []
          });
        }
      } else if (rawItems && typeof rawItems === "object") {
        for (const [gapId, item] of Object.entries(rawItems)) {
          const normalizedGapId = normalizeText3(gapId);
          if (!normalizedGapId) continue;
          items.set(normalizedGapId, {
            gap_id: normalizedGapId,
            status: normalizeText3(item?.status),
            resolution_target: normalizeText3(item?.resolution_target),
            owner: normalizeText3(item?.owner),
            explicit_reason: normalizeText3(item?.explicit_reason || item?.rationale),
            planned_work_items: Array.isArray(item?.planned_work_items) ? item.planned_work_items.map((value) => normalizeText3(value)).filter(Boolean) : Array.isArray(item?.planned_story_keys) ? item.planned_story_keys.map((value) => normalizeText3(value)).filter(Boolean) : []
          });
        }
      }
      return {
        sprint_path: sprintPath,
        items
      };
    }
    function resolveGapLifecycleStatus(gap, planItem) {
      const explicitStatus = normalizeText3(planItem?.status || gap.status).toLowerCase();
      if (["open", "deferred", "in_progress", "resolved", "expired"].includes(explicitStatus)) {
        return explicitStatus;
      }
      if (planItem?.planned_work_items?.length) {
        return "in_progress";
      }
      return "deferred";
    }
    function isExpiredByDate(resolutionTarget) {
      const dateToken = extractDateToken(resolutionTarget);
      if (!dateToken) return false;
      const target = Date.parse(`${dateToken}T23:59:59Z`);
      if (Number.isNaN(target)) return false;
      return Date.now() > target;
    }
    function buildDeferredGapStatusItems(projectRoot) {
      const reports = listReadinessReports(projectRoot);
      const grouped = /* @__PURE__ */ new Map();
      for (const reportPath of reports) {
        const key = path12.dirname(reportPath);
        const list = grouped.get(key) || [];
        list.push(reportPath);
        grouped.set(key, list);
      }
      const sprintPlan = readSprintDeferredGapPlan(projectRoot);
      const statusItems = [];
      const removedWithoutEvidence = [];
      const alerts = [];
      for (const reportGroup of grouped.values()) {
        const ordered = [...reportGroup].sort((left, right) => reportSortValue(left) - reportSortValue(right));
        for (let index = 1; index < ordered.length; index += 1) {
          const comparison = compareDeferredGapReports(ordered[index], ordered[index - 1]);
          for (const removed of comparison.removed_without_evidence) {
            removedWithoutEvidence.push({
              gap_id: removed.gap_id,
              previous_report: ordered[index - 1],
              current_report: ordered[index]
            });
            alerts.push(`Gap ${removed.gap_id} was removed without resolution evidence between ${path12.basename(ordered[index - 1])} and ${path12.basename(ordered[index])}`);
          }
        }
        const latestReportPath = ordered[ordered.length - 1];
        const latest = readDeferredGapsFromReport2(latestReportPath);
        for (const gap of latest.gaps) {
          const planItem = sprintPlan.items.get(gap.gap_id) || null;
          let status = resolveGapLifecycleStatus(gap, planItem);
          if (status !== "resolved" && isExpiredByDate(planItem?.resolution_target || gap.resolution_target)) {
            status = "expired";
          }
          const owner = normalizeText3(planItem?.owner || gap.owner);
          const resolutionTarget = normalizeText3(planItem?.resolution_target || gap.resolution_target);
          const plannedWorkItems = planItem?.planned_work_items || [];
          const explicitReason = normalizeText3(planItem?.explicit_reason);
          let currentRisk = gap.current_risk || "";
          if (!currentRisk) {
            if (status === "expired") {
              currentRisk = "\u9AD8\u98CE\u9669";
            } else if (!owner) {
              currentRisk = "\u9AD8\u98CE\u9669";
            } else if (status === "in_progress") {
              currentRisk = "\u4F4E\u98CE\u9669";
            } else if (!plannedWorkItems.length && !explicitReason) {
              currentRisk = "\u53EF\u80FD\u6F02\u79FB";
            } else {
              currentRisk = "\u4F4E\u98CE\u9669";
            }
          }
          if (!owner) {
            alerts.push(`Gap ${gap.gap_id} is missing an owner in the latest readiness/sprint plan state`);
          }
          if (status === "expired") {
            alerts.push(`Gap ${gap.gap_id} exceeded resolution_target ${resolutionTarget || "(missing target)"}`);
          }
          statusItems.push({
            gap_id: gap.gap_id,
            description: gap.description || "",
            reason: gap.reason || "",
            resolution_target: resolutionTarget,
            owner,
            status_checkpoint: gap.status_checkpoint || "",
            status,
            current_risk: currentRisk,
            planned_work_items: plannedWorkItems,
            explicit_reason: explicitReason,
            source_report: latestReportPath
          });
        }
      }
      statusItems.sort((left, right) => left.gap_id.localeCompare(right.gap_id));
      return {
        sprint_plan_path: sprintPlan.sprint_path,
        status_items: statusItems,
        removed_without_evidence: removedWithoutEvidence,
        alert_messages: [...new Set(alerts)],
        readiness_report_count: reports.length
      };
    }
    function buildDeferredGapAudit(projectRoot) {
      const built = buildDeferredGapStatusItems(projectRoot);
      const explicitCount = built.status_items.length;
      return {
        project_root: projectRoot,
        generated_at: (/* @__PURE__ */ new Date()).toISOString(),
        readiness_report_count: built.readiness_report_count,
        deferred_gap_count: explicitCount,
        deferred_gaps_explicit: explicitCount > 0,
        sprint_plan_path: built.sprint_plan_path,
        gaps: built.status_items,
        removed_without_evidence: built.removed_without_evidence,
        alerts: built.alert_messages,
        alert_count: built.alert_messages.length,
        status: built.alert_messages.length > 0 ? "alert" : "ok"
      };
    }
    function renderDeferredGapMarkdownTable(audit) {
      const lines = ["## Deferred Gaps Status", ""];
      if (!audit.gaps || audit.gaps.length === 0) {
        lines.push("\u6682\u65E0 Deferred Gaps\u3002");
        lines.push("");
        return lines.join("\n");
      }
      lines.push("| Gap ID | \u72B6\u6001 | \u76EE\u6807 Sprint / Resolution Target | \u5F53\u524D\u98CE\u9669 | Owner |");
      lines.push("|--------|------|-------------------------------|----------|-------|");
      for (const gap of audit.gaps) {
        lines.push(
          `| ${gap.gap_id} | ${gap.status || "deferred"} | ${gap.resolution_target || "(none)"} | ${gap.current_risk || "(none)"} | ${gap.owner || "(missing)"} |`
        );
      }
      lines.push("");
      if (audit.alert_count > 0) {
        lines.push("### Deferred Gap Alerts");
        lines.push("");
        for (const alert of audit.alerts) {
          lines.push(`- ${alert}`);
        }
        lines.push("");
      }
      return lines.join("\n");
    }
    function resolveDeferredGapRegisterPath(projectRoot, artifactPath) {
      return resolveDeferredGapRegisterLocation(projectRoot, { artifactPath }).register_path;
    }
    module2.exports = {
      collectSections,
      extractDeferredGapsFromMarkdown,
      readDeferredGapsFromReport: readDeferredGapsFromReport2,
      listReadinessReports,
      findPreviousReadinessReport,
      compareDeferredGapReports,
      deriveReadinessRemediationArtifactPath,
      readSprintDeferredGapPlan,
      buildDeferredGapAudit,
      renderDeferredGapMarkdownTable,
      resolveDeferredGapRegisterPath,
      loadDeferredGapRegister,
      collectJourneyArtifacts,
      validateJourneyArtifactPrecedence,
      validateDeferredGapStageContract,
      isActiveGap
    };
  }
});

// ../../scripts/deferred-gap-governance.cjs
var require_deferred_gap_governance2 = __commonJS({
  "../../scripts/deferred-gap-governance.cjs"(exports2, module2) {
    "use strict";
    module2.exports = require_deferred_gap_governance();
  }
});

// ../../_bmad/runtime/hooks/governance-runner-summary-format.cjs
var require_governance_runner_summary_format = __commonJS({
  "../../_bmad/runtime/hooks/governance-runner-summary-format.cjs"(exports2, module2) {
    "use strict";
    function normalizeGovernanceRunnerSummaryLines(runnerSummaryLines) {
      if (!Array.isArray(runnerSummaryLines)) {
        return [];
      }
      return runnerSummaryLines.filter((line) => typeof line === "string");
    }
    function renderGovernanceRunnerSummaryLines2(runnerSummaryLines) {
      return normalizeGovernanceRunnerSummaryLines(runnerSummaryLines).join("\n");
    }
    function buildGovernanceLatestRawEventSectionLines(runnerSummaryLines) {
      const normalized = normalizeGovernanceRunnerSummaryLines(runnerSummaryLines);
      return [
        "## Governance Latest Raw Event",
        "",
        ...normalized.length > 0 ? normalized : ["\u6682\u65E0 governance raw event \u6458\u8981"],
        ""
      ];
    }
    function appendRunnerSummaryToArtifactMarkdown2(artifactMarkdown, runnerSummaryLines) {
      const normalized = normalizeGovernanceRunnerSummaryLines(runnerSummaryLines);
      if (normalized.length === 0) {
        return artifactMarkdown;
      }
      return `${String(artifactMarkdown || "").replace(/\s*$/, "")}

${renderGovernanceRunnerSummaryLines2(
        normalized
      )}
`;
    }
    function printGovernanceRunnerSummaryLines(runnerSummaryLines, log) {
      const normalized = normalizeGovernanceRunnerSummaryLines(runnerSummaryLines);
      const sink = typeof log === "function" ? log : console.log;
      for (const line of normalized) {
        sink(line);
      }
    }
    module2.exports = {
      appendRunnerSummaryToArtifactMarkdown: appendRunnerSummaryToArtifactMarkdown2,
      buildGovernanceLatestRawEventSectionLines,
      normalizeGovernanceRunnerSummaryLines,
      printGovernanceRunnerSummaryLines,
      renderGovernanceRunnerSummaryLines: renderGovernanceRunnerSummaryLines2
    };
  }
});

// ../../scripts/governance-remediation-runner.ts
var governance_remediation_runner_exports = {};
__export(governance_remediation_runner_exports, {
  buildGovernanceRemediationRunnerSummaryLines: () => buildGovernanceRemediationRunnerSummaryLines,
  createGovernanceExecutorPacket: () => createGovernanceExecutorPacket,
  governanceAttemptLoopStatePath: () => governanceAttemptLoopStatePath,
  governanceExecutorPacketPath: () => governanceExecutorPacketPath,
  readGovernanceAttemptLoopState: () => readGovernanceAttemptLoopState,
  renderGovernanceExecutorPacket: () => renderGovernanceExecutorPacket,
  runGovernanceRemediation: () => runGovernanceRemediation,
  writeGovernanceAttemptLoopState: () => writeGovernanceAttemptLoopState,
  writeGovernanceExecutorPacket: () => writeGovernanceExecutorPacket
});
module.exports = __toCommonJS(governance_remediation_runner_exports);
var fs10 = __toESM(require("node:fs"));
var path11 = __toESM(require("node:path"));

// ../../scripts/governance-remediation-artifact.ts
var fs2 = __toESM(require("node:fs"));
var path2 = __toESM(require("node:path"));

// ../../scripts/prompt-routing-hints.ts
var fs = __toESM(require("node:fs"));
var path = __toESM(require("node:path"));

// ../../node_modules/js-yaml/dist/js-yaml.mjs
function isNothing(subject) {
  return typeof subject === "undefined" || subject === null;
}
function isObject(subject) {
  return typeof subject === "object" && subject !== null;
}
function toArray(sequence) {
  if (Array.isArray(sequence)) return sequence;
  else if (isNothing(sequence)) return [];
  return [sequence];
}
function extend(target, source) {
  var index, length, key, sourceKeys;
  if (source) {
    sourceKeys = Object.keys(source);
    for (index = 0, length = sourceKeys.length; index < length; index += 1) {
      key = sourceKeys[index];
      target[key] = source[key];
    }
  }
  return target;
}
function repeat(string, count) {
  var result = "", cycle;
  for (cycle = 0; cycle < count; cycle += 1) {
    result += string;
  }
  return result;
}
function isNegativeZero(number) {
  return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
}
var isNothing_1 = isNothing;
var isObject_1 = isObject;
var toArray_1 = toArray;
var repeat_1 = repeat;
var isNegativeZero_1 = isNegativeZero;
var extend_1 = extend;
var common = {
  isNothing: isNothing_1,
  isObject: isObject_1,
  toArray: toArray_1,
  repeat: repeat_1,
  isNegativeZero: isNegativeZero_1,
  extend: extend_1
};
function formatError(exception2, compact) {
  var where = "", message = exception2.reason || "(unknown reason)";
  if (!exception2.mark) return message;
  if (exception2.mark.name) {
    where += 'in "' + exception2.mark.name + '" ';
  }
  where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
  if (!compact && exception2.mark.snippet) {
    where += "\n\n" + exception2.mark.snippet;
  }
  return message + " " + where;
}
function YAMLException$1(reason, mark) {
  Error.call(this);
  this.name = "YAMLException";
  this.reason = reason;
  this.mark = mark;
  this.message = formatError(this, false);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  } else {
    this.stack = new Error().stack || "";
  }
}
YAMLException$1.prototype = Object.create(Error.prototype);
YAMLException$1.prototype.constructor = YAMLException$1;
YAMLException$1.prototype.toString = function toString(compact) {
  return this.name + ": " + formatError(this, compact);
};
var exception = YAMLException$1;
function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
  var head = "";
  var tail = "";
  var maxHalfLength = Math.floor(maxLineLength / 2) - 1;
  if (position - lineStart > maxHalfLength) {
    head = " ... ";
    lineStart = position - maxHalfLength + head.length;
  }
  if (lineEnd - position > maxHalfLength) {
    tail = " ...";
    lineEnd = position + maxHalfLength - tail.length;
  }
  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
    pos: position - lineStart + head.length
    // relative position
  };
}
function padStart(string, max) {
  return common.repeat(" ", max - string.length) + string;
}
function makeSnippet(mark, options) {
  options = Object.create(options || null);
  if (!mark.buffer) return null;
  if (!options.maxLength) options.maxLength = 79;
  if (typeof options.indent !== "number") options.indent = 1;
  if (typeof options.linesBefore !== "number") options.linesBefore = 3;
  if (typeof options.linesAfter !== "number") options.linesAfter = 2;
  var re = /\r?\n|\r|\0/g;
  var lineStarts = [0];
  var lineEnds = [];
  var match;
  var foundLineNo = -1;
  while (match = re.exec(mark.buffer)) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);
    if (mark.position <= match.index && foundLineNo < 0) {
      foundLineNo = lineStarts.length - 2;
    }
  }
  if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
  var result = "", i, line;
  var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
  var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
  for (i = 1; i <= options.linesBefore; i++) {
    if (foundLineNo - i < 0) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo - i],
      lineEnds[foundLineNo - i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
      maxLineLength
    );
    result = common.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line.str + "\n" + result;
  }
  line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
  result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
  for (i = 1; i <= options.linesAfter; i++) {
    if (foundLineNo + i >= lineEnds.length) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo + i],
      lineEnds[foundLineNo + i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
      maxLineLength
    );
    result += common.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line.str + "\n";
  }
  return result.replace(/\n$/, "");
}
var snippet = makeSnippet;
var TYPE_CONSTRUCTOR_OPTIONS = [
  "kind",
  "multi",
  "resolve",
  "construct",
  "instanceOf",
  "predicate",
  "represent",
  "representName",
  "defaultStyle",
  "styleAliases"
];
var YAML_NODE_KINDS = [
  "scalar",
  "sequence",
  "mapping"
];
function compileStyleAliases(map2) {
  var result = {};
  if (map2 !== null) {
    Object.keys(map2).forEach(function(style) {
      map2[style].forEach(function(alias) {
        result[String(alias)] = style;
      });
    });
  }
  return result;
}
function Type$1(tag, options) {
  options = options || {};
  Object.keys(options).forEach(function(name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new exception('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    }
  });
  this.options = options;
  this.tag = tag;
  this.kind = options["kind"] || null;
  this.resolve = options["resolve"] || function() {
    return true;
  };
  this.construct = options["construct"] || function(data) {
    return data;
  };
  this.instanceOf = options["instanceOf"] || null;
  this.predicate = options["predicate"] || null;
  this.represent = options["represent"] || null;
  this.representName = options["representName"] || null;
  this.defaultStyle = options["defaultStyle"] || null;
  this.multi = options["multi"] || false;
  this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new exception('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
}
var type = Type$1;
function compileList(schema2, name) {
  var result = [];
  schema2[name].forEach(function(currentType) {
    var newIndex = result.length;
    result.forEach(function(previousType, previousIndex) {
      if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
        newIndex = previousIndex;
      }
    });
    result[newIndex] = currentType;
  });
  return result;
}
function compileMap() {
  var result = {
    scalar: {},
    sequence: {},
    mapping: {},
    fallback: {},
    multi: {
      scalar: [],
      sequence: [],
      mapping: [],
      fallback: []
    }
  }, index, length;
  function collectType(type2) {
    if (type2.multi) {
      result.multi[type2.kind].push(type2);
      result.multi["fallback"].push(type2);
    } else {
      result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
    }
  }
  for (index = 0, length = arguments.length; index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result;
}
function Schema$1(definition) {
  return this.extend(definition);
}
Schema$1.prototype.extend = function extend2(definition) {
  var implicit = [];
  var explicit = [];
  if (definition instanceof type) {
    explicit.push(definition);
  } else if (Array.isArray(definition)) {
    explicit = explicit.concat(definition);
  } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
    if (definition.implicit) implicit = implicit.concat(definition.implicit);
    if (definition.explicit) explicit = explicit.concat(definition.explicit);
  } else {
    throw new exception("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  }
  implicit.forEach(function(type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
    if (type$1.loadKind && type$1.loadKind !== "scalar") {
      throw new exception("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    }
    if (type$1.multi) {
      throw new exception("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
    }
  });
  explicit.forEach(function(type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
  });
  var result = Object.create(Schema$1.prototype);
  result.implicit = (this.implicit || []).concat(implicit);
  result.explicit = (this.explicit || []).concat(explicit);
  result.compiledImplicit = compileList(result, "implicit");
  result.compiledExplicit = compileList(result, "explicit");
  result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
  return result;
};
var schema = Schema$1;
var str = new type("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(data) {
    return data !== null ? data : "";
  }
});
var seq = new type("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(data) {
    return data !== null ? data : [];
  }
});
var map = new type("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(data) {
    return data !== null ? data : {};
  }
});
var failsafe = new schema({
  explicit: [
    str,
    seq,
    map
  ]
});
function resolveYamlNull(data) {
  if (data === null) return true;
  var max = data.length;
  return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
}
function constructYamlNull() {
  return null;
}
function isNull(object) {
  return object === null;
}
var _null = new type("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: resolveYamlNull,
  construct: constructYamlNull,
  predicate: isNull,
  represent: {
    canonical: function() {
      return "~";
    },
    lowercase: function() {
      return "null";
    },
    uppercase: function() {
      return "NULL";
    },
    camelcase: function() {
      return "Null";
    },
    empty: function() {
      return "";
    }
  },
  defaultStyle: "lowercase"
});
function resolveYamlBoolean(data) {
  if (data === null) return false;
  var max = data.length;
  return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
}
function constructYamlBoolean(data) {
  return data === "true" || data === "True" || data === "TRUE";
}
function isBoolean(object) {
  return Object.prototype.toString.call(object) === "[object Boolean]";
}
var bool = new type("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: resolveYamlBoolean,
  construct: constructYamlBoolean,
  predicate: isBoolean,
  represent: {
    lowercase: function(object) {
      return object ? "true" : "false";
    },
    uppercase: function(object) {
      return object ? "TRUE" : "FALSE";
    },
    camelcase: function(object) {
      return object ? "True" : "False";
    }
  },
  defaultStyle: "lowercase"
});
function isHexCode(c) {
  return 48 <= c && c <= 57 || 65 <= c && c <= 70 || 97 <= c && c <= 102;
}
function isOctCode(c) {
  return 48 <= c && c <= 55;
}
function isDecCode(c) {
  return 48 <= c && c <= 57;
}
function resolveYamlInteger(data) {
  if (data === null) return false;
  var max = data.length, index = 0, hasDigits = false, ch;
  if (!max) return false;
  ch = data[index];
  if (ch === "-" || ch === "+") {
    ch = data[++index];
  }
  if (ch === "0") {
    if (index + 1 === max) return true;
    ch = data[++index];
    if (ch === "b") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (ch !== "0" && ch !== "1") return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "x") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isHexCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "o") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isOctCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
  }
  if (ch === "_") return false;
  for (; index < max; index++) {
    ch = data[index];
    if (ch === "_") continue;
    if (!isDecCode(data.charCodeAt(index))) {
      return false;
    }
    hasDigits = true;
  }
  if (!hasDigits || ch === "_") return false;
  return true;
}
function constructYamlInteger(data) {
  var value = data, sign = 1, ch;
  if (value.indexOf("_") !== -1) {
    value = value.replace(/_/g, "");
  }
  ch = value[0];
  if (ch === "-" || ch === "+") {
    if (ch === "-") sign = -1;
    value = value.slice(1);
    ch = value[0];
  }
  if (value === "0") return 0;
  if (ch === "0") {
    if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
    if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
    if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
  }
  return sign * parseInt(value, 10);
}
function isInteger(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common.isNegativeZero(object));
}
var int = new type("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: resolveYamlInteger,
  construct: constructYamlInteger,
  predicate: isInteger,
  represent: {
    binary: function(obj) {
      return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
    },
    octal: function(obj) {
      return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
    },
    decimal: function(obj) {
      return obj.toString(10);
    },
    /* eslint-disable max-len */
    hexadecimal: function(obj) {
      return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
    }
  },
  defaultStyle: "decimal",
  styleAliases: {
    binary: [2, "bin"],
    octal: [8, "oct"],
    decimal: [10, "dec"],
    hexadecimal: [16, "hex"]
  }
});
var YAML_FLOAT_PATTERN = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function resolveYamlFloat(data) {
  if (data === null) return false;
  if (!YAML_FLOAT_PATTERN.test(data) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  data[data.length - 1] === "_") {
    return false;
  }
  return true;
}
function constructYamlFloat(data) {
  var value, sign;
  value = data.replace(/_/g, "").toLowerCase();
  sign = value[0] === "-" ? -1 : 1;
  if ("+-".indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }
  if (value === ".inf") {
    return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  } else if (value === ".nan") {
    return NaN;
  }
  return sign * parseFloat(value, 10);
}
var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
function representYamlFloat(object, style) {
  var res;
  if (isNaN(object)) {
    switch (style) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
  } else if (common.isNegativeZero(object)) {
    return "-0.0";
  }
  res = object.toString(10);
  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
}
function isFloat(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
}
var float = new type("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: resolveYamlFloat,
  construct: constructYamlFloat,
  predicate: isFloat,
  represent: representYamlFloat,
  defaultStyle: "lowercase"
});
var json = failsafe.extend({
  implicit: [
    _null,
    bool,
    int,
    float
  ]
});
var core = json;
var YAML_DATE_REGEXP = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
);
var YAML_TIMESTAMP_REGEXP = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function resolveYamlTimestamp(data) {
  if (data === null) return false;
  if (YAML_DATE_REGEXP.exec(data) !== null) return true;
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
  return false;
}
function constructYamlTimestamp(data) {
  var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
  match = YAML_DATE_REGEXP.exec(data);
  if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
  if (match === null) throw new Error("Date resolve error");
  year = +match[1];
  month = +match[2] - 1;
  day = +match[3];
  if (!match[4]) {
    return new Date(Date.UTC(year, month, day));
  }
  hour = +match[4];
  minute = +match[5];
  second = +match[6];
  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) {
      fraction += "0";
    }
    fraction = +fraction;
  }
  if (match[9]) {
    tz_hour = +match[10];
    tz_minute = +(match[11] || 0);
    delta = (tz_hour * 60 + tz_minute) * 6e4;
    if (match[9] === "-") delta = -delta;
  }
  date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
  if (delta) date.setTime(date.getTime() - delta);
  return date;
}
function representYamlTimestamp(object) {
  return object.toISOString();
}
var timestamp = new type("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: resolveYamlTimestamp,
  construct: constructYamlTimestamp,
  instanceOf: Date,
  represent: representYamlTimestamp
});
function resolveYamlMerge(data) {
  return data === "<<" || data === null;
}
var merge = new type("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: resolveYamlMerge
});
var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
function resolveYamlBinary(data) {
  if (data === null) return false;
  var code, idx, bitlen = 0, max = data.length, map2 = BASE64_MAP;
  for (idx = 0; idx < max; idx++) {
    code = map2.indexOf(data.charAt(idx));
    if (code > 64) continue;
    if (code < 0) return false;
    bitlen += 6;
  }
  return bitlen % 8 === 0;
}
function constructYamlBinary(data) {
  var idx, tailbits, input = data.replace(/[\r\n=]/g, ""), max = input.length, map2 = BASE64_MAP, bits = 0, result = [];
  for (idx = 0; idx < max; idx++) {
    if (idx % 4 === 0 && idx) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    }
    bits = bits << 6 | map2.indexOf(input.charAt(idx));
  }
  tailbits = max % 4 * 6;
  if (tailbits === 0) {
    result.push(bits >> 16 & 255);
    result.push(bits >> 8 & 255);
    result.push(bits & 255);
  } else if (tailbits === 18) {
    result.push(bits >> 10 & 255);
    result.push(bits >> 2 & 255);
  } else if (tailbits === 12) {
    result.push(bits >> 4 & 255);
  }
  return new Uint8Array(result);
}
function representYamlBinary(object) {
  var result = "", bits = 0, idx, tail, max = object.length, map2 = BASE64_MAP;
  for (idx = 0; idx < max; idx++) {
    if (idx % 3 === 0 && idx) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    }
    bits = (bits << 8) + object[idx];
  }
  tail = max % 3;
  if (tail === 0) {
    result += map2[bits >> 18 & 63];
    result += map2[bits >> 12 & 63];
    result += map2[bits >> 6 & 63];
    result += map2[bits & 63];
  } else if (tail === 2) {
    result += map2[bits >> 10 & 63];
    result += map2[bits >> 4 & 63];
    result += map2[bits << 2 & 63];
    result += map2[64];
  } else if (tail === 1) {
    result += map2[bits >> 2 & 63];
    result += map2[bits << 4 & 63];
    result += map2[64];
    result += map2[64];
  }
  return result;
}
function isBinary(obj) {
  return Object.prototype.toString.call(obj) === "[object Uint8Array]";
}
var binary = new type("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: resolveYamlBinary,
  construct: constructYamlBinary,
  predicate: isBinary,
  represent: representYamlBinary
});
var _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
var _toString$2 = Object.prototype.toString;
function resolveYamlOmap(data) {
  if (data === null) return true;
  var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    pairHasKey = false;
    if (_toString$2.call(pair) !== "[object Object]") return false;
    for (pairKey in pair) {
      if (_hasOwnProperty$3.call(pair, pairKey)) {
        if (!pairHasKey) pairHasKey = true;
        else return false;
      }
    }
    if (!pairHasKey) return false;
    if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
    else return false;
  }
  return true;
}
function constructYamlOmap(data) {
  return data !== null ? data : [];
}
var omap = new type("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: resolveYamlOmap,
  construct: constructYamlOmap
});
var _toString$1 = Object.prototype.toString;
function resolveYamlPairs(data) {
  if (data === null) return true;
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    if (_toString$1.call(pair) !== "[object Object]") return false;
    keys = Object.keys(pair);
    if (keys.length !== 1) return false;
    result[index] = [keys[0], pair[keys[0]]];
  }
  return true;
}
function constructYamlPairs(data) {
  if (data === null) return [];
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    keys = Object.keys(pair);
    result[index] = [keys[0], pair[keys[0]]];
  }
  return result;
}
var pairs = new type("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: resolveYamlPairs,
  construct: constructYamlPairs
});
var _hasOwnProperty$2 = Object.prototype.hasOwnProperty;
function resolveYamlSet(data) {
  if (data === null) return true;
  var key, object = data;
  for (key in object) {
    if (_hasOwnProperty$2.call(object, key)) {
      if (object[key] !== null) return false;
    }
  }
  return true;
}
function constructYamlSet(data) {
  return data !== null ? data : {};
}
var set = new type("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: resolveYamlSet,
  construct: constructYamlSet
});
var _default = core.extend({
  implicit: [
    timestamp,
    merge
  ],
  explicit: [
    binary,
    omap,
    pairs,
    set
  ]
});
var _hasOwnProperty$1 = Object.prototype.hasOwnProperty;
var CONTEXT_FLOW_IN = 1;
var CONTEXT_FLOW_OUT = 2;
var CONTEXT_BLOCK_IN = 3;
var CONTEXT_BLOCK_OUT = 4;
var CHOMPING_CLIP = 1;
var CHOMPING_STRIP = 2;
var CHOMPING_KEEP = 3;
var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
var PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function _class(obj) {
  return Object.prototype.toString.call(obj);
}
function is_EOL(c) {
  return c === 10 || c === 13;
}
function is_WHITE_SPACE(c) {
  return c === 9 || c === 32;
}
function is_WS_OR_EOL(c) {
  return c === 9 || c === 32 || c === 10 || c === 13;
}
function is_FLOW_INDICATOR(c) {
  return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
}
function fromHexCode(c) {
  var lc;
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  lc = c | 32;
  if (97 <= lc && lc <= 102) {
    return lc - 97 + 10;
  }
  return -1;
}
function escapedHexLen(c) {
  if (c === 120) {
    return 2;
  }
  if (c === 117) {
    return 4;
  }
  if (c === 85) {
    return 8;
  }
  return 0;
}
function fromDecimalCode(c) {
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  return -1;
}
function simpleEscapeSequence(c) {
  return c === 48 ? "\0" : c === 97 ? "\x07" : c === 98 ? "\b" : c === 116 ? "	" : c === 9 ? "	" : c === 110 ? "\n" : c === 118 ? "\v" : c === 102 ? "\f" : c === 114 ? "\r" : c === 101 ? "\x1B" : c === 32 ? " " : c === 34 ? '"' : c === 47 ? "/" : c === 92 ? "\\" : c === 78 ? "\x85" : c === 95 ? "\xA0" : c === 76 ? "\u2028" : c === 80 ? "\u2029" : "";
}
function charFromCodepoint(c) {
  if (c <= 65535) {
    return String.fromCharCode(c);
  }
  return String.fromCharCode(
    (c - 65536 >> 10) + 55296,
    (c - 65536 & 1023) + 56320
  );
}
function setProperty(object, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value
    });
  } else {
    object[key] = value;
  }
}
var simpleEscapeCheck = new Array(256);
var simpleEscapeMap = new Array(256);
for (i = 0; i < 256; i++) {
  simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
  simpleEscapeMap[i] = simpleEscapeSequence(i);
}
var i;
function State$1(input, options) {
  this.input = input;
  this.filename = options["filename"] || null;
  this.schema = options["schema"] || _default;
  this.onWarning = options["onWarning"] || null;
  this.legacy = options["legacy"] || false;
  this.json = options["json"] || false;
  this.listener = options["listener"] || null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap = this.schema.compiledTypeMap;
  this.length = input.length;
  this.position = 0;
  this.line = 0;
  this.lineStart = 0;
  this.lineIndent = 0;
  this.firstTabInLine = -1;
  this.documents = [];
}
function generateError(state, message) {
  var mark = {
    name: state.filename,
    buffer: state.input.slice(0, -1),
    // omit trailing \0
    position: state.position,
    line: state.line,
    column: state.position - state.lineStart
  };
  mark.snippet = snippet(mark);
  return new exception(message, mark);
}
function throwError(state, message) {
  throw generateError(state, message);
}
function throwWarning(state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}
var directiveHandlers = {
  YAML: function handleYamlDirective(state, name, args) {
    var match, major, minor;
    if (state.version !== null) {
      throwError(state, "duplication of %YAML directive");
    }
    if (args.length !== 1) {
      throwError(state, "YAML directive accepts exactly one argument");
    }
    match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
    if (match === null) {
      throwError(state, "ill-formed argument of the YAML directive");
    }
    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);
    if (major !== 1) {
      throwError(state, "unacceptable YAML version of the document");
    }
    state.version = args[0];
    state.checkLineBreaks = minor < 2;
    if (minor !== 1 && minor !== 2) {
      throwWarning(state, "unsupported YAML version of the document");
    }
  },
  TAG: function handleTagDirective(state, name, args) {
    var handle, prefix;
    if (args.length !== 2) {
      throwError(state, "TAG directive accepts exactly two arguments");
    }
    handle = args[0];
    prefix = args[1];
    if (!PATTERN_TAG_HANDLE.test(handle)) {
      throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
    }
    if (_hasOwnProperty$1.call(state.tagMap, handle)) {
      throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
    }
    if (!PATTERN_TAG_URI.test(prefix)) {
      throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
    }
    try {
      prefix = decodeURIComponent(prefix);
    } catch (err) {
      throwError(state, "tag prefix is malformed: " + prefix);
    }
    state.tagMap[handle] = prefix;
  }
};
function captureSegment(state, start, end, checkJson) {
  var _position, _length, _character, _result;
  if (start < end) {
    _result = state.input.slice(start, end);
    if (checkJson) {
      for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
        _character = _result.charCodeAt(_position);
        if (!(_character === 9 || 32 <= _character && _character <= 1114111)) {
          throwError(state, "expected valid JSON character");
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, "the stream contains non-printable characters");
    }
    state.result += _result;
  }
}
function mergeMappings(state, destination, source, overridableKeys) {
  var sourceKeys, key, index, quantity;
  if (!common.isObject(source)) {
    throwError(state, "cannot merge mappings; the provided source object is unacceptable");
  }
  sourceKeys = Object.keys(source);
  for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
    key = sourceKeys[index];
    if (!_hasOwnProperty$1.call(destination, key)) {
      setProperty(destination, key, source[key]);
      overridableKeys[key] = true;
    }
  }
}
function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
  var index, quantity;
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);
    for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
      if (Array.isArray(keyNode[index])) {
        throwError(state, "nested arrays are not supported inside keys");
      }
      if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
        keyNode[index] = "[object Object]";
      }
    }
  }
  if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
    keyNode = "[object Object]";
  }
  keyNode = String(keyNode);
  if (_result === null) {
    _result = {};
  }
  if (keyTag === "tag:yaml.org,2002:merge") {
    if (Array.isArray(valueNode)) {
      for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json && !_hasOwnProperty$1.call(overridableKeys, keyNode) && _hasOwnProperty$1.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.lineStart = startLineStart || state.lineStart;
      state.position = startPos || state.position;
      throwError(state, "duplicated mapping key");
    }
    setProperty(_result, keyNode, valueNode);
    delete overridableKeys[keyNode];
  }
  return _result;
}
function readLineBreak(state) {
  var ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 10) {
    state.position++;
  } else if (ch === 13) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 10) {
      state.position++;
    }
  } else {
    throwError(state, "a line break is expected");
  }
  state.line += 1;
  state.lineStart = state.position;
  state.firstTabInLine = -1;
}
function skipSeparationSpace(state, allowComments, checkIndent) {
  var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    while (is_WHITE_SPACE(ch)) {
      if (ch === 9 && state.firstTabInLine === -1) {
        state.firstTabInLine = state.position;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    if (allowComments && ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 10 && ch !== 13 && ch !== 0);
    }
    if (is_EOL(ch)) {
      readLineBreak(state);
      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;
      while (ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }
  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, "deficient indentation");
  }
  return lineBreaks;
}
function testDocumentSeparator(state) {
  var _position = state.position, ch;
  ch = state.input.charCodeAt(_position);
  if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
    _position += 3;
    ch = state.input.charCodeAt(_position);
    if (ch === 0 || is_WS_OR_EOL(ch)) {
      return true;
    }
  }
  return false;
}
function writeFoldedLines(state, count) {
  if (count === 1) {
    state.result += " ";
  } else if (count > 1) {
    state.result += common.repeat("\n", count - 1);
  }
}
function readPlainScalar(state, nodeIndent, withinFlowCollection) {
  var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
  ch = state.input.charCodeAt(state.position);
  if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
    return false;
  }
  if (ch === 63 || ch === 45) {
    following = state.input.charCodeAt(state.position + 1);
    if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
      return false;
    }
  }
  state.kind = "scalar";
  state.result = "";
  captureStart = captureEnd = state.position;
  hasPendingContent = false;
  while (ch !== 0) {
    if (ch === 58) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
        break;
      }
    } else if (ch === 35) {
      preceding = state.input.charCodeAt(state.position - 1);
      if (is_WS_OR_EOL(preceding)) {
        break;
      }
    } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) {
      break;
    } else if (is_EOL(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);
      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break;
      }
    }
    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }
    if (!is_WHITE_SPACE(ch)) {
      captureEnd = state.position + 1;
    }
    ch = state.input.charCodeAt(++state.position);
  }
  captureSegment(state, captureStart, captureEnd, false);
  if (state.result) {
    return true;
  }
  state.kind = _kind;
  state.result = _result;
  return false;
}
function readSingleQuotedScalar(state, nodeIndent) {
  var ch, captureStart, captureEnd;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 39) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 39) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (ch === 39) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a single quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a single quoted scalar");
}
function readDoubleQuotedScalar(state, nodeIndent) {
  var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 34) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 34) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;
    } else if (ch === 92) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (is_EOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;
      } else if ((tmp = escapedHexLen(ch)) > 0) {
        hexLength = tmp;
        hexResult = 0;
        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);
          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;
          } else {
            throwError(state, "expected hexadecimal character");
          }
        }
        state.result += charFromCodepoint(hexResult);
        state.position++;
      } else {
        throwError(state, "unknown escape sequence");
      }
      captureStart = captureEnd = state.position;
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a double quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a double quoted scalar");
}
function readFlowCollection(state, nodeIndent) {
  var readNext = true, _line, _lineStart, _pos, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = /* @__PURE__ */ Object.create(null), keyNode, keyTag, valueNode, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 91) {
    terminator = 93;
    isMapping = false;
    _result = [];
  } else if (ch === 123) {
    terminator = 125;
    isMapping = true;
    _result = {};
  } else {
    return false;
  }
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(++state.position);
  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? "mapping" : "sequence";
      state.result = _result;
      return true;
    } else if (!readNext) {
      throwError(state, "missed comma between flow collection entries");
    } else if (ch === 44) {
      throwError(state, "expected the node content, but found ','");
    }
    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;
    if (ch === 63) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }
    _line = state.line;
    _lineStart = state.lineStart;
    _pos = state.position;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if ((isExplicitPair || state.line === _line) && ch === 58) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }
    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
    } else {
      _result.push(keyNode);
    }
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === 44) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }
  throwError(state, "unexpected end of the stream within a flow collection");
}
function readBlockScalar(state, nodeIndent) {
  var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 124) {
    folding = false;
  } else if (ch === 62) {
    folding = true;
  } else {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);
    if (ch === 43 || ch === 45) {
      if (CHOMPING_CLIP === chomping) {
        chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, "repeat of a chomping mode identifier");
      }
    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, "repeat of an indentation width identifier");
      }
    } else {
      break;
    }
  }
  if (is_WHITE_SPACE(ch)) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (is_WHITE_SPACE(ch));
    if (ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (!is_EOL(ch) && ch !== 0);
    }
  }
  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;
    ch = state.input.charCodeAt(state.position);
    while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }
    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }
    if (is_EOL(ch)) {
      emptyLines++;
      continue;
    }
    if (state.lineIndent < textIndent) {
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) {
          state.result += "\n";
        }
      }
      break;
    }
    if (folding) {
      if (is_WHITE_SPACE(ch)) {
        atMoreIndented = true;
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat("\n", emptyLines + 1);
      } else if (emptyLines === 0) {
        if (didReadContent) {
          state.result += " ";
        }
      } else {
        state.result += common.repeat("\n", emptyLines);
      }
    } else {
      state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
    }
    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    captureStart = state.position;
    while (!is_EOL(ch) && ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, state.position, false);
  }
  return true;
}
function readBlockSequence(state, nodeIndent) {
  var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
  if (state.firstTabInLine !== -1) return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    if (ch !== 45) {
      break;
    }
    following = state.input.charCodeAt(state.position + 1);
    if (!is_WS_OR_EOL(following)) {
      break;
    }
    detected = true;
    state.position++;
    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }
    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a sequence entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "sequence";
    state.result = _result;
    return true;
  }
  return false;
}
function readBlockMapping(state, nodeIndent, flowIndent) {
  var following, allowCompact, _line, _keyLine, _keyLineStart, _keyPos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = /* @__PURE__ */ Object.create(null), keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
  if (state.firstTabInLine !== -1) return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    following = state.input.charCodeAt(state.position + 1);
    _line = state.line;
    if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
      if (ch === 63) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        detected = true;
        atExplicitKey = true;
        allowCompact = true;
      } else if (atExplicitKey) {
        atExplicitKey = false;
        allowCompact = true;
      } else {
        throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
      }
      state.position += 1;
      ch = following;
    } else {
      _keyLine = state.line;
      _keyLineStart = state.lineStart;
      _keyPos = state.position;
      if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        break;
      }
      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 58) {
          ch = state.input.charCodeAt(++state.position);
          if (!is_WS_OR_EOL(ch)) {
            throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
          }
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;
        } else if (detected) {
          throwError(state, "can not read an implicit mapping pair; a colon is missed");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      } else if (detected) {
        throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true;
      }
    }
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (atExplicitKey) {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
      }
      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }
      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
        keyTag = keyNode = valueNode = null;
      }
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a mapping entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "mapping";
    state.result = _result;
  }
  return detected;
}
function readTagProperty(state) {
  var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 33) return false;
  if (state.tag !== null) {
    throwError(state, "duplication of a tag property");
  }
  ch = state.input.charCodeAt(++state.position);
  if (ch === 60) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);
  } else if (ch === 33) {
    isNamed = true;
    tagHandle = "!!";
    ch = state.input.charCodeAt(++state.position);
  } else {
    tagHandle = "!";
  }
  _position = state.position;
  if (isVerbatim) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (ch !== 0 && ch !== 62);
    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, "unexpected end of the stream within a verbatim tag");
    }
  } else {
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      if (ch === 33) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);
          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, "named tag handle cannot contain such characters");
          }
          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, "tag suffix cannot contain exclamation marks");
        }
      }
      ch = state.input.charCodeAt(++state.position);
    }
    tagName = state.input.slice(_position, state.position);
    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, "tag suffix cannot contain flow indicator characters");
    }
  }
  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, "tag name cannot contain such characters: " + tagName);
  }
  try {
    tagName = decodeURIComponent(tagName);
  } catch (err) {
    throwError(state, "tag name is malformed: " + tagName);
  }
  if (isVerbatim) {
    state.tag = tagName;
  } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;
  } else if (tagHandle === "!") {
    state.tag = "!" + tagName;
  } else if (tagHandle === "!!") {
    state.tag = "tag:yaml.org,2002:" + tagName;
  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }
  return true;
}
function readAnchorProperty(state) {
  var _position, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 38) return false;
  if (state.anchor !== null) {
    throwError(state, "duplication of an anchor property");
  }
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an anchor node must contain at least one character");
  }
  state.anchor = state.input.slice(_position, state.position);
  return true;
}
function readAlias(state) {
  var _position, alias, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 42) return false;
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an alias node must contain at least one character");
  }
  alias = state.input.slice(_position, state.position);
  if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }
  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}
function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, typeList, type2, flowIndent, blockIndent;
  if (state.listener !== null) {
    state.listener("open", state);
  }
  state.tag = null;
  state.anchor = null;
  state.kind = null;
  state.result = null;
  allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;
      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }
  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }
  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }
  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }
    blockIndent = state.position - state.lineStart;
    if (indentStatus === 1) {
      if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;
        } else if (readAlias(state)) {
          hasContent = true;
          if (state.tag !== null || state.anchor !== null) {
            throwError(state, "alias node should not have any properties");
          }
        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;
          if (state.tag === null) {
            state.tag = "?";
          }
        }
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }
  if (state.tag === null) {
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = state.result;
    }
  } else if (state.tag === "?") {
    if (state.result !== null && state.kind !== "scalar") {
      throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
    }
    for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
      type2 = state.implicitTypes[typeIndex];
      if (type2.resolve(state.result)) {
        state.result = type2.construct(state.result);
        state.tag = type2.tag;
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
        break;
      }
    }
  } else if (state.tag !== "!") {
    if (_hasOwnProperty$1.call(state.typeMap[state.kind || "fallback"], state.tag)) {
      type2 = state.typeMap[state.kind || "fallback"][state.tag];
    } else {
      type2 = null;
      typeList = state.typeMap.multi[state.kind || "fallback"];
      for (typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
        if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type2 = typeList[typeIndex];
          break;
        }
      }
    }
    if (!type2) {
      throwError(state, "unknown tag !<" + state.tag + ">");
    }
    if (state.result !== null && type2.kind !== state.kind) {
      throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
    }
    if (!type2.resolve(state.result, state.tag)) {
      throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
    } else {
      state.result = type2.construct(state.result, state.tag);
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    }
  }
  if (state.listener !== null) {
    state.listener("close", state);
  }
  return state.tag !== null || state.anchor !== null || hasContent;
}
function readDocument(state) {
  var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = /* @__PURE__ */ Object.create(null);
  state.anchorMap = /* @__PURE__ */ Object.create(null);
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if (state.lineIndent > 0 || ch !== 37) {
      break;
    }
    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    directiveName = state.input.slice(_position, state.position);
    directiveArgs = [];
    if (directiveName.length < 1) {
      throwError(state, "directive name must not be less than one character in length");
    }
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && !is_EOL(ch));
        break;
      }
      if (is_EOL(ch)) break;
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveArgs.push(state.input.slice(_position, state.position));
    }
    if (ch !== 0) readLineBreak(state);
    if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }
  skipSeparationSpace(state, true, -1);
  if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);
  } else if (hasDirectives) {
    throwError(state, "directives end mark is expected");
  }
  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);
  if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, "non-ASCII line breaks are interpreted as content");
  }
  state.documents.push(state.result);
  if (state.position === state.lineStart && testDocumentSeparator(state)) {
    if (state.input.charCodeAt(state.position) === 46) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }
  if (state.position < state.length - 1) {
    throwError(state, "end of the stream or a document separator is expected");
  } else {
    return;
  }
}
function loadDocuments(input, options) {
  input = String(input);
  options = options || {};
  if (input.length !== 0) {
    if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
      input += "\n";
    }
    if (input.charCodeAt(0) === 65279) {
      input = input.slice(1);
    }
  }
  var state = new State$1(input, options);
  var nullpos = input.indexOf("\0");
  if (nullpos !== -1) {
    state.position = nullpos;
    throwError(state, "null byte is not allowed in input");
  }
  state.input += "\0";
  while (state.input.charCodeAt(state.position) === 32) {
    state.lineIndent += 1;
    state.position += 1;
  }
  while (state.position < state.length - 1) {
    readDocument(state);
  }
  return state.documents;
}
function loadAll$1(input, iterator, options) {
  if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
    options = iterator;
    iterator = null;
  }
  var documents = loadDocuments(input, options);
  if (typeof iterator !== "function") {
    return documents;
  }
  for (var index = 0, length = documents.length; index < length; index += 1) {
    iterator(documents[index]);
  }
}
function load$1(input, options) {
  var documents = loadDocuments(input, options);
  if (documents.length === 0) {
    return void 0;
  } else if (documents.length === 1) {
    return documents[0];
  }
  throw new exception("expected a single document in the stream, but found more");
}
var loadAll_1 = loadAll$1;
var load_1 = load$1;
var loader = {
  loadAll: loadAll_1,
  load: load_1
};
var _toString = Object.prototype.toString;
var _hasOwnProperty = Object.prototype.hasOwnProperty;
var CHAR_BOM = 65279;
var CHAR_TAB = 9;
var CHAR_LINE_FEED = 10;
var CHAR_CARRIAGE_RETURN = 13;
var CHAR_SPACE = 32;
var CHAR_EXCLAMATION = 33;
var CHAR_DOUBLE_QUOTE = 34;
var CHAR_SHARP = 35;
var CHAR_PERCENT = 37;
var CHAR_AMPERSAND = 38;
var CHAR_SINGLE_QUOTE = 39;
var CHAR_ASTERISK = 42;
var CHAR_COMMA = 44;
var CHAR_MINUS = 45;
var CHAR_COLON = 58;
var CHAR_EQUALS = 61;
var CHAR_GREATER_THAN = 62;
var CHAR_QUESTION = 63;
var CHAR_COMMERCIAL_AT = 64;
var CHAR_LEFT_SQUARE_BRACKET = 91;
var CHAR_RIGHT_SQUARE_BRACKET = 93;
var CHAR_GRAVE_ACCENT = 96;
var CHAR_LEFT_CURLY_BRACKET = 123;
var CHAR_VERTICAL_LINE = 124;
var CHAR_RIGHT_CURLY_BRACKET = 125;
var ESCAPE_SEQUENCES = {};
ESCAPE_SEQUENCES[0] = "\\0";
ESCAPE_SEQUENCES[7] = "\\a";
ESCAPE_SEQUENCES[8] = "\\b";
ESCAPE_SEQUENCES[9] = "\\t";
ESCAPE_SEQUENCES[10] = "\\n";
ESCAPE_SEQUENCES[11] = "\\v";
ESCAPE_SEQUENCES[12] = "\\f";
ESCAPE_SEQUENCES[13] = "\\r";
ESCAPE_SEQUENCES[27] = "\\e";
ESCAPE_SEQUENCES[34] = '\\"';
ESCAPE_SEQUENCES[92] = "\\\\";
ESCAPE_SEQUENCES[133] = "\\N";
ESCAPE_SEQUENCES[160] = "\\_";
ESCAPE_SEQUENCES[8232] = "\\L";
ESCAPE_SEQUENCES[8233] = "\\P";
var DEPRECATED_BOOLEANS_SYNTAX = [
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "on",
  "On",
  "ON",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "off",
  "Off",
  "OFF"
];
var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
function compileStyleMap(schema2, map2) {
  var result, keys, index, length, tag, style, type2;
  if (map2 === null) return {};
  result = {};
  keys = Object.keys(map2);
  for (index = 0, length = keys.length; index < length; index += 1) {
    tag = keys[index];
    style = String(map2[tag]);
    if (tag.slice(0, 2) === "!!") {
      tag = "tag:yaml.org,2002:" + tag.slice(2);
    }
    type2 = schema2.compiledTypeMap["fallback"][tag];
    if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
      style = type2.styleAliases[style];
    }
    result[tag] = style;
  }
  return result;
}
function encodeHex(character) {
  var string, handle, length;
  string = character.toString(16).toUpperCase();
  if (character <= 255) {
    handle = "x";
    length = 2;
  } else if (character <= 65535) {
    handle = "u";
    length = 4;
  } else if (character <= 4294967295) {
    handle = "U";
    length = 8;
  } else {
    throw new exception("code point within a string may not be greater than 0xFFFFFFFF");
  }
  return "\\" + handle + common.repeat("0", length - string.length) + string;
}
var QUOTING_TYPE_SINGLE = 1;
var QUOTING_TYPE_DOUBLE = 2;
function State(options) {
  this.schema = options["schema"] || _default;
  this.indent = Math.max(1, options["indent"] || 2);
  this.noArrayIndent = options["noArrayIndent"] || false;
  this.skipInvalid = options["skipInvalid"] || false;
  this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
  this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
  this.sortKeys = options["sortKeys"] || false;
  this.lineWidth = options["lineWidth"] || 80;
  this.noRefs = options["noRefs"] || false;
  this.noCompatMode = options["noCompatMode"] || false;
  this.condenseFlow = options["condenseFlow"] || false;
  this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
  this.forceQuotes = options["forceQuotes"] || false;
  this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;
  this.tag = null;
  this.result = "";
  this.duplicates = [];
  this.usedDuplicates = null;
}
function indentString(string, spaces) {
  var ind = common.repeat(" ", spaces), position = 0, next = -1, result = "", line, length = string.length;
  while (position < length) {
    next = string.indexOf("\n", position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }
    if (line.length && line !== "\n") result += ind;
    result += line;
  }
  return result;
}
function generateNextLine(state, level) {
  return "\n" + common.repeat(" ", state.indent * level);
}
function testImplicitResolving(state, str2) {
  var index, length, type2;
  for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
    type2 = state.implicitTypes[index];
    if (type2.resolve(str2)) {
      return true;
    }
  }
  return false;
}
function isWhitespace(c) {
  return c === CHAR_SPACE || c === CHAR_TAB;
}
function isPrintable(c) {
  return 32 <= c && c <= 126 || 161 <= c && c <= 55295 && c !== 8232 && c !== 8233 || 57344 <= c && c <= 65533 && c !== CHAR_BOM || 65536 <= c && c <= 1114111;
}
function isNsCharOrWhitespace(c) {
  return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
}
function isPlainSafe(c, prev, inblock) {
  var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
  var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
  return (
    // ns-plain-safe
    (inblock ? (
      // c = flow-in
      cIsNsCharOrWhitespace
    ) : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar
  );
}
function isPlainSafeFirst(c) {
  return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
}
function isPlainSafeLast(c) {
  return !isWhitespace(c) && c !== CHAR_COLON;
}
function codePointAt(string, pos) {
  var first = string.charCodeAt(pos), second;
  if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
    second = string.charCodeAt(pos + 1);
    if (second >= 56320 && second <= 57343) {
      return (first - 55296) * 1024 + second - 56320 + 65536;
    }
  }
  return first;
}
function needIndentIndicator(string) {
  var leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string);
}
var STYLE_PLAIN = 1;
var STYLE_SINGLE = 2;
var STYLE_LITERAL = 3;
var STYLE_FOLDED = 4;
var STYLE_DOUBLE = 5;
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
  var i;
  var char = 0;
  var prevChar = null;
  var hasLineBreak = false;
  var hasFoldableLine = false;
  var shouldTrackWidth = lineWidth !== -1;
  var previousLineBreak = -1;
  var plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
  if (singleLineOnly || forceQuotes) {
    for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
  } else {
    for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
          i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
          previousLineBreak = i;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
  }
  if (!hasLineBreak && !hasFoldableLine) {
    if (plain && !forceQuotes && !testAmbiguousType(string)) {
      return STYLE_PLAIN;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE;
  }
  if (!forceQuotes) {
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
}
function writeScalar(state, string, level, iskey, inblock) {
  state.dump = (function() {
    if (string.length === 0) {
      return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
    }
    if (!state.noCompatMode) {
      if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
      }
    }
    var indent = state.indent * Math.max(1, level);
    var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
    var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
    function testAmbiguity(string2) {
      return testImplicitResolving(state, string2);
    }
    switch (chooseScalarStyle(
      string,
      singleLineOnly,
      state.indent,
      lineWidth,
      testAmbiguity,
      state.quotingType,
      state.forceQuotes && !iskey,
      inblock
    )) {
      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'";
      case STYLE_LITERAL:
        return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
      case STYLE_FOLDED:
        return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
      case STYLE_DOUBLE:
        return '"' + escapeString(string) + '"';
      default:
        throw new exception("impossible error: invalid scalar style");
    }
  })();
}
function blockHeader(string, indentPerLevel) {
  var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
  var clip = string[string.length - 1] === "\n";
  var keep = clip && (string[string.length - 2] === "\n" || string === "\n");
  var chomp = keep ? "+" : clip ? "" : "-";
  return indentIndicator + chomp + "\n";
}
function dropEndingNewline(string) {
  return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
}
function foldString(string, width) {
  var lineRe = /(\n+)([^\n]*)/g;
  var result = (function() {
    var nextLF = string.indexOf("\n");
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  })();
  var prevMoreIndented = string[0] === "\n" || string[0] === " ";
  var moreIndented;
  var match;
  while (match = lineRe.exec(string)) {
    var prefix = match[1], line = match[2];
    moreIndented = line[0] === " ";
    result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }
  return result;
}
function foldLine(line, width) {
  if (line === "" || line[0] === " ") return line;
  var breakRe = / [^ ]/g;
  var match;
  var start = 0, end, curr = 0, next = 0;
  var result = "";
  while (match = breakRe.exec(line)) {
    next = match.index;
    if (next - start > width) {
      end = curr > start ? curr : next;
      result += "\n" + line.slice(start, end);
      start = end + 1;
    }
    curr = next;
  }
  result += "\n";
  if (line.length - start > width && curr > start) {
    result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
  } else {
    result += line.slice(start);
  }
  return result.slice(1);
}
function escapeString(string) {
  var result = "";
  var char = 0;
  var escapeSeq;
  for (var i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
    char = codePointAt(string, i);
    escapeSeq = ESCAPE_SEQUENCES[char];
    if (!escapeSeq && isPrintable(char)) {
      result += string[i];
      if (char >= 65536) result += string[i + 1];
    } else {
      result += escapeSeq || encodeHex(char);
    }
  }
  return result;
}
function writeFlowSequence(state, level, object) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
      if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = "[" + _result + "]";
}
function writeBlockSequence(state, level, object, compact) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
      if (!compact || _result !== "") {
        _result += generateNextLine(state, level);
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += "-";
      } else {
        _result += "- ";
      }
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = _result || "[]";
}
function writeFlowMapping(state, level, object) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = "";
    if (_result !== "") pairBuffer += ", ";
    if (state.condenseFlow) pairBuffer += '"';
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level, objectKey, false, false)) {
      continue;
    }
    if (state.dump.length > 1024) pairBuffer += "? ";
    pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
    if (!writeNode(state, level, objectValue, false, false)) {
      continue;
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = "{" + _result + "}";
}
function writeBlockMapping(state, level, object, compact) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
  if (state.sortKeys === true) {
    objectKeyList.sort();
  } else if (typeof state.sortKeys === "function") {
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    throw new exception("sortKeys must be a boolean or a function");
  }
  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = "";
    if (!compact || _result !== "") {
      pairBuffer += generateNextLine(state, level);
    }
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue;
    }
    explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += "?";
      } else {
        pairBuffer += "? ";
      }
    }
    pairBuffer += state.dump;
    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }
    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue;
    }
    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ":";
    } else {
      pairBuffer += ": ";
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = _result || "{}";
}
function detectType(state, object, explicit) {
  var _result, typeList, index, length, type2, style;
  typeList = explicit ? state.explicitTypes : state.implicitTypes;
  for (index = 0, length = typeList.length; index < length; index += 1) {
    type2 = typeList[index];
    if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
      if (explicit) {
        if (type2.multi && type2.representName) {
          state.tag = type2.representName(object);
        } else {
          state.tag = type2.tag;
        }
      } else {
        state.tag = "?";
      }
      if (type2.represent) {
        style = state.styleMap[type2.tag] || type2.defaultStyle;
        if (_toString.call(type2.represent) === "[object Function]") {
          _result = type2.represent(object, style);
        } else if (_hasOwnProperty.call(type2.represent, style)) {
          _result = type2.represent[style](object, style);
        } else {
          throw new exception("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
        }
        state.dump = _result;
      }
      return true;
    }
  }
  return false;
}
function writeNode(state, level, object, block, compact, iskey, isblockseq) {
  state.tag = null;
  state.dump = object;
  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }
  var type2 = _toString.call(state.dump);
  var inblock = block;
  var tagStr;
  if (block) {
    block = state.flowLevel < 0 || state.flowLevel > level;
  }
  var objectOrArray = type2 === "[object Object]" || type2 === "[object Array]", duplicateIndex, duplicate;
  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }
  if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
    compact = false;
  }
  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = "*ref_" + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type2 === "[object Object]") {
      if (block && Object.keys(state.dump).length !== 0) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object Array]") {
      if (block && state.dump.length !== 0) {
        if (state.noArrayIndent && !isblockseq && level > 0) {
          writeBlockSequence(state, level - 1, state.dump, compact);
        } else {
          writeBlockSequence(state, level, state.dump, compact);
        }
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object String]") {
      if (state.tag !== "?") {
        writeScalar(state, state.dump, level, iskey, inblock);
      }
    } else if (type2 === "[object Undefined]") {
      return false;
    } else {
      if (state.skipInvalid) return false;
      throw new exception("unacceptable kind of an object to dump " + type2);
    }
    if (state.tag !== null && state.tag !== "?") {
      tagStr = encodeURI(
        state.tag[0] === "!" ? state.tag.slice(1) : state.tag
      ).replace(/!/g, "%21");
      if (state.tag[0] === "!") {
        tagStr = "!" + tagStr;
      } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
        tagStr = "!!" + tagStr.slice(18);
      } else {
        tagStr = "!<" + tagStr + ">";
      }
      state.dump = tagStr + " " + state.dump;
    }
  }
  return true;
}
function getDuplicateReferences(object, state) {
  var objects = [], duplicatesIndexes = [], index, length;
  inspectNode(object, objects, duplicatesIndexes);
  for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}
function inspectNode(object, objects, duplicatesIndexes) {
  var objectKeyList, index, length;
  if (object !== null && typeof object === "object") {
    index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);
      if (Array.isArray(object)) {
        for (index = 0, length = object.length; index < length; index += 1) {
          inspectNode(object[index], objects, duplicatesIndexes);
        }
      } else {
        objectKeyList = Object.keys(object);
        for (index = 0, length = objectKeyList.length; index < length; index += 1) {
          inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
        }
      }
    }
  }
}
function dump$1(input, options) {
  options = options || {};
  var state = new State(options);
  if (!state.noRefs) getDuplicateReferences(input, state);
  var value = input;
  if (state.replacer) {
    value = state.replacer.call({ "": value }, "", value);
  }
  if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
  return "";
}
var dump_1 = dump$1;
var dumper = {
  dump: dump_1
};
function renamed(from, to) {
  return function() {
    throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
  };
}
var load = loader.load;
var loadAll = loader.loadAll;
var dump = dumper.dump;
var safeLoad = renamed("safeLoad", "load");
var safeLoadAll = renamed("safeLoadAll", "loadAll");
var safeDump = renamed("safeDump", "dump");

// ../../scripts/prompt-routing-hints-schema.ts
var import_ajv = __toESM(require_ajv());
var ajv = new import_ajv.default({ allErrors: true, strict: true, allowUnionTypes: true });
var aliasMapSchema = {
  type: "object",
  minProperties: 1,
  additionalProperties: {
    type: "array",
    minItems: 1,
    items: { type: "string", minLength: 1 }
  }
};
var promptRoutingRuleSetSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "defaults",
    "stageAliases",
    "actionAliases",
    "artifactAliases",
    "roleAliases",
    "researchPolicyAliases",
    "delegationAliases",
    "constraintAliases"
  ],
  properties: {
    version: { type: "number" },
    defaults: {
      type: "object",
      additionalProperties: false,
      required: ["confidenceThresholds", "researchPolicy", "delegationPreference"],
      properties: {
        confidenceThresholds: {
          type: "object",
          additionalProperties: false,
          required: ["medium", "high"],
          properties: {
            medium: { type: "number", minimum: 0 },
            high: { type: "number", minimum: 0 }
          }
        },
        researchPolicy: { type: "string", enum: ["allowed", "forbidden", "preferred"] },
        delegationPreference: { type: "string", enum: ["decide-for-me", "ask-me-first"] }
      }
    },
    stageAliases: aliasMapSchema,
    actionAliases: aliasMapSchema,
    artifactAliases: aliasMapSchema,
    roleAliases: aliasMapSchema,
    researchPolicyAliases: {
      type: "object",
      additionalProperties: false,
      required: ["forbidden", "preferred"],
      properties: {
        forbidden: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
        preferred: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } }
      }
    },
    delegationAliases: {
      type: "object",
      additionalProperties: false,
      required: ["decide-for-me", "ask-me-first"],
      properties: {
        "decide-for-me": {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 }
        },
        "ask-me-first": {
          type: "array",
          minItems: 1,
          items: { type: "string", minLength: 1 }
        }
      }
    },
    constraintAliases: aliasMapSchema
  }
};
var promptRoutingHintsSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "source",
    "confidence",
    "explicitRolePreference",
    "researchPolicy",
    "delegationPreference",
    "constraints",
    "overrideAllowed",
    "debug"
  ],
  properties: {
    source: { type: "string", const: "user-input" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    requestedAction: { type: "string" },
    inferredStage: { type: "string" },
    inferredArtifactTarget: { type: "string" },
    explicitRolePreference: {
      type: "array",
      items: { type: "string" }
    },
    recommendedSkillChain: {
      type: "array",
      items: { type: "string" }
    },
    recommendedSubagentRoles: {
      type: "array",
      items: { type: "string" }
    },
    researchPolicy: { type: "string", enum: ["allowed", "forbidden", "preferred"] },
    delegationPreference: { type: "string", enum: ["decide-for-me", "ask-me-first"] },
    constraints: {
      type: "array",
      items: { type: "string" }
    },
    overrideAllowed: { type: "boolean", const: false },
    debug: {
      type: "object",
      additionalProperties: false,
      required: [
        "score",
        "normalizedInput",
        "matchedStageAliases",
        "matchedActionAliases",
        "matchedArtifactAliases",
        "matchedRoleAliases",
        "matchedResearchPolicyAliases",
        "matchedDelegationAliases",
        "matchedConstraintAliases"
      ],
      properties: {
        score: { type: "number", minimum: 0 },
        normalizedInput: { type: "string" },
        matchedStageAliases: { type: "array", items: { type: "string" } },
        matchedActionAliases: { type: "array", items: { type: "string" } },
        matchedArtifactAliases: { type: "array", items: { type: "string" } },
        matchedRoleAliases: { type: "array", items: { type: "string" } },
        matchedResearchPolicyAliases: { type: "array", items: { type: "string" } },
        matchedDelegationAliases: { type: "array", items: { type: "string" } },
        matchedConstraintAliases: { type: "array", items: { type: "string" } }
      }
    }
  }
};
var validatePromptRoutingRuleSet = ajv.compile(promptRoutingRuleSetSchema);
var validatePromptRoutingHints = ajv.compile(promptRoutingHintsSchema);
function assertValidPromptRoutingRuleSet(ruleSet) {
  if (!validatePromptRoutingRuleSet(ruleSet)) {
    throw new Error(
      `Invalid prompt routing rule set: ${ajv.errorsText(validatePromptRoutingRuleSet.errors, {
        separator: "; "
      })}`
    );
  }
}
function assertValidPromptRoutingHints(hints) {
  if (!validatePromptRoutingHints(hints)) {
    throw new Error(
      `Invalid prompt routing hints: ${ajv.errorsText(validatePromptRoutingHints.errors, {
        separator: "; "
      })}`
    );
  }
}

// ../../scripts/prompt-routing-hints.ts
var DEFAULT_PROMPT_ROUTING_RULES_PATH = path.join(
  "_bmad",
  "bmm",
  "data",
  "prompt-routing-rules.yaml"
);
function normalizeText(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
function resolveRulesPath(projectRoot, rulesPath = DEFAULT_PROMPT_ROUTING_RULES_PATH) {
  return path.isAbsolute(rulesPath) ? rulesPath : path.join(projectRoot, rulesPath);
}
function collectAliasHits(aliasMap, normalizedInput) {
  const hits = {};
  for (const [key, aliases] of Object.entries(aliasMap)) {
    const matched = aliases.filter((alias) => normalizedInput.includes(normalizeText(alias)));
    if (matched.length > 0) {
      hits[key] = matched;
    }
  }
  return hits;
}
function pickBestKey(hits) {
  let bestKey;
  let bestCount = 0;
  for (const [key, aliases] of Object.entries(hits)) {
    if (aliases.length > bestCount) {
      bestKey = key;
      bestCount = aliases.length;
    }
  }
  return bestKey;
}
function flattenAliases(hits) {
  return Object.values(hits).flat();
}
function resolveConfidence(signalCount, thresholds) {
  if (signalCount >= thresholds.high) {
    return "high";
  }
  if (signalCount >= thresholds.medium) {
    return "medium";
  }
  return "low";
}
function deriveResearchPolicy(rules, normalizedInput) {
  const hits = collectAliasHits(rules.researchPolicyAliases, normalizedInput);
  if (hits.forbidden) {
    return { value: "forbidden", aliases: hits.forbidden };
  }
  if (hits.preferred) {
    return { value: "preferred", aliases: hits.preferred };
  }
  return { value: rules.defaults.researchPolicy, aliases: [] };
}
function deriveDelegationPreference(rules, normalizedInput) {
  const hits = collectAliasHits(rules.delegationAliases, normalizedInput);
  if (hits["decide-for-me"]) {
    return { value: "decide-for-me", aliases: hits["decide-for-me"] };
  }
  if (hits["ask-me-first"]) {
    return { value: "ask-me-first", aliases: hits["ask-me-first"] };
  }
  return { value: rules.defaults.delegationPreference, aliases: [] };
}
function loadPromptRoutingRules(projectRoot, rulesPath = DEFAULT_PROMPT_ROUTING_RULES_PATH) {
  const absolutePath = resolveRulesPath(projectRoot, rulesPath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = load(raw);
  assertValidPromptRoutingRuleSet(parsed);
  return parsed;
}
function detectPromptRoutingHints(input, rules) {
  const normalizedInput = normalizeText(input);
  const stageHits = collectAliasHits(rules.stageAliases, normalizedInput);
  const actionHits = collectAliasHits(rules.actionAliases, normalizedInput);
  const artifactHits = collectAliasHits(rules.artifactAliases, normalizedInput);
  const roleHits = collectAliasHits(rules.roleAliases, normalizedInput);
  const constraintHits = collectAliasHits(rules.constraintAliases, normalizedInput);
  const researchPolicy = deriveResearchPolicy(rules, normalizedInput);
  const delegationPreference = deriveDelegationPreference(rules, normalizedInput);
  const signalCount = (pickBestKey(stageHits) ? 1 : 0) + (pickBestKey(actionHits) ? 1 : 0) + (pickBestKey(artifactHits) ? 1 : 0) + Object.keys(roleHits).length + Object.keys(constraintHits).length + (researchPolicy.aliases.length > 0 ? 1 : 0) + (delegationPreference.aliases.length > 0 ? 1 : 0);
  const hints = {
    source: "user-input",
    confidence: resolveConfidence(signalCount, rules.defaults.confidenceThresholds),
    ...pickBestKey(actionHits) ? { requestedAction: pickBestKey(actionHits) } : {},
    ...pickBestKey(stageHits) ? { inferredStage: pickBestKey(stageHits) } : {},
    ...pickBestKey(artifactHits) ? { inferredArtifactTarget: pickBestKey(artifactHits) } : {},
    explicitRolePreference: Object.keys(roleHits),
    researchPolicy: researchPolicy.value,
    delegationPreference: delegationPreference.value,
    constraints: Object.keys(constraintHits),
    overrideAllowed: false,
    debug: {
      score: signalCount,
      normalizedInput,
      matchedStageAliases: flattenAliases(stageHits),
      matchedActionAliases: flattenAliases(actionHits),
      matchedArtifactAliases: flattenAliases(artifactHits),
      matchedRoleAliases: flattenAliases(roleHits),
      matchedResearchPolicyAliases: researchPolicy.aliases,
      matchedDelegationAliases: delegationPreference.aliases,
      matchedConstraintAliases: flattenAliases(constraintHits)
    }
  };
  assertValidPromptRoutingHints(hints);
  return hints;
}
function resolvePromptRoutingHintsFromText(projectRoot, input, rulesPath = DEFAULT_PROMPT_ROUTING_RULES_PATH) {
  const rules = loadPromptRoutingRules(projectRoot, rulesPath);
  return detectPromptRoutingHints(input, rules);
}

// ../../scripts/execution-intent-schema.ts
var import_ajv2 = __toESM(require_ajv());
var ajv2 = new import_ajv2.default({ allErrors: true, strict: true, allowUnionTypes: true });
var stringArraySchema = {
  type: "array",
  items: { type: "string" }
};
var structuredRecommendationItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value", "source", "reason", "confidence", "consumed", "filteredBecause"],
  properties: {
    value: { type: "string", minLength: 1 },
    source: { type: "string", const: "model-provider" },
    reason: { type: "string", minLength: 1 },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    consumed: { type: "boolean" },
    matchedSkillId: { type: "string" },
    matchedBy: { type: "string", enum: ["exact-id", "substring", "token-overlap", "unmatched"] },
    matchScore: { type: "number" },
    filteredBecause: stringArraySchema
  }
};
var executionIntentBaseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "source",
    "skillChain",
    "subagentRoles",
    "providerRecommendedSkillChain",
    "providerRecommendedSubagentRoles",
    "providerRecommendationItems",
    "availableSkills",
    "skillPaths",
    "matchedAvailableSkills",
    "missingSkills",
    "skillMatchReasons",
    "semanticSkillFeatures",
    "semanticFeatureTopN",
    "skillAvailabilityMode",
    "interactionMode",
    "researchPolicy",
    "delegationPreference",
    "rationale"
  ],
  properties: {
    source: {
      type: "string",
      enum: ["default", "prompt-hints", "model-hints", "merged"]
    },
    stage: { type: "string" },
    action: { type: "string" },
    skillChain: stringArraySchema,
    subagentRoles: stringArraySchema,
    providerRecommendedSkillChain: stringArraySchema,
    providerRecommendedSubagentRoles: stringArraySchema,
    providerRecommendationItems: {
      type: "object",
      additionalProperties: false,
      required: ["skills", "subagentRoles"],
      properties: {
        skills: {
          type: "array",
          items: structuredRecommendationItemSchema
        },
        subagentRoles: {
          type: "array",
          items: structuredRecommendationItemSchema
        }
      }
    },
    availableSkills: stringArraySchema,
    skillPaths: stringArraySchema,
    matchedAvailableSkills: stringArraySchema,
    missingSkills: stringArraySchema,
    skillMatchReasons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "requestedSkill",
          "matchedSkillId",
          "score",
          "exactIdMatch",
          "substringMatch",
          "overlapTokens"
        ],
        properties: {
          requestedSkill: { type: "string", minLength: 1 },
          matchedSkillId: { type: "string", minLength: 1 },
          matchedPath: { type: "string" },
          score: { type: "number" },
          exactIdMatch: { type: "boolean" },
          substringMatch: { type: "boolean" },
          overlapTokens: stringArraySchema,
          title: { type: "string" },
          description: { type: "string" },
          summary: { type: "string" }
        }
      }
    },
    semanticSkillFeatures: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "skillId",
          "stageHints",
          "actionHints",
          "interactionHints",
          "researchPolicyHints",
          "delegationHints",
          "constraintHints"
        ],
        properties: {
          skillId: { type: "string", minLength: 1 },
          path: { type: "string" },
          title: { type: "string" },
          stageHints: stringArraySchema,
          stageHintScores: {
            type: "object",
            additionalProperties: { type: "number" }
          },
          actionHints: stringArraySchema,
          actionHintScores: {
            type: "object",
            additionalProperties: { type: "number" }
          },
          interactionHints: stringArraySchema,
          interactionHintScores: {
            type: "object",
            additionalProperties: { type: "number" }
          },
          researchPolicyHints: {
            type: "array",
            items: { type: "string", enum: ["allowed", "forbidden", "preferred"] }
          },
          researchPolicyHintScores: {
            type: "object",
            additionalProperties: { type: "number" }
          },
          delegationHints: {
            type: "array",
            items: { type: "string", enum: ["decide-for-me", "ask-me-first"] }
          },
          delegationHintScores: {
            type: "object",
            additionalProperties: { type: "number" }
          },
          constraintHints: stringArraySchema,
          constraintHintScores: {
            type: "object",
            additionalProperties: { type: "number" }
          }
        }
      }
    },
    semanticFeatureTopN: {
      type: "object",
      additionalProperties: false,
      required: [
        "stageHints",
        "actionHints",
        "interactionHints",
        "researchPolicyHints",
        "delegationHints",
        "constraintHints"
      ],
      properties: {
        stageHints: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["value", "score", "provenanceSkillIds"],
            properties: {
              value: { type: "string", minLength: 1 },
              score: { type: "number" },
              provenanceSkillIds: stringArraySchema
            }
          }
        },
        actionHints: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["value", "score", "provenanceSkillIds"],
            properties: {
              value: { type: "string", minLength: 1 },
              score: { type: "number" },
              provenanceSkillIds: stringArraySchema
            }
          }
        },
        interactionHints: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["value", "score", "provenanceSkillIds"],
            properties: {
              value: { type: "string", minLength: 1 },
              score: { type: "number" },
              provenanceSkillIds: stringArraySchema
            }
          }
        },
        researchPolicyHints: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["value", "score", "provenanceSkillIds"],
            properties: {
              value: { type: "string", minLength: 1 },
              score: { type: "number" },
              provenanceSkillIds: stringArraySchema
            }
          }
        },
        delegationHints: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["value", "score", "provenanceSkillIds"],
            properties: {
              value: { type: "string", minLength: 1 },
              score: { type: "number" },
              provenanceSkillIds: stringArraySchema
            }
          }
        },
        constraintHints: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["value", "score", "provenanceSkillIds"],
            properties: {
              value: { type: "string", minLength: 1 },
              score: { type: "number" },
              provenanceSkillIds: stringArraySchema
            }
          }
        }
      }
    },
    skillAvailabilityMode: {
      type: "string",
      enum: ["advisory-only", "execution-filtered", "not-provided"]
    },
    interactionMode: {
      type: "string",
      enum: ["single-agent", "party-mode", "review-first", "implement-first"]
    },
    researchPolicy: { type: "string", enum: ["allowed", "forbidden", "preferred"] },
    delegationPreference: { type: "string", enum: ["decide-for-me", "ask-me-first"] },
    constraints: stringArraySchema,
    rationale: { type: "string", minLength: 1 },
    governanceConstraints: stringArraySchema,
    blockedByGovernance: stringArraySchema,
    advisoryOnly: { type: "boolean" }
  }
};
var executionIntentCandidateSchema = {
  ...executionIntentBaseSchema,
  required: [...executionIntentBaseSchema.required, "constraints", "advisoryOnly"],
  properties: {
    ...executionIntentBaseSchema.properties,
    advisoryOnly: { type: "boolean", const: true }
  }
};
var executionPlanDecisionSchema = {
  ...executionIntentBaseSchema,
  required: [
    ...executionIntentBaseSchema.required,
    "governanceConstraints",
    "blockedByGovernance",
    "advisoryOnly"
  ],
  properties: {
    ...executionIntentBaseSchema.properties,
    advisoryOnly: { type: "boolean", const: false }
  }
};
var validateExecutionIntentCandidate = ajv2.compile(executionIntentCandidateSchema);
var validateExecutionPlanDecision = ajv2.compile(executionPlanDecisionSchema);
function assertValidExecutionIntentCandidate(value) {
  if (!validateExecutionIntentCandidate(value)) {
    throw new Error(
      `Invalid execution intent candidate: ${ajv2.errorsText(validateExecutionIntentCandidate.errors, {
        separator: "; "
      })}`
    );
  }
}
function assertValidExecutionPlanDecision(value) {
  if (!validateExecutionPlanDecision(value)) {
    throw new Error(
      `Invalid execution plan decision: ${ajv2.errorsText(validateExecutionPlanDecision.errors, {
        separator: "; "
      })}`
    );
  }
}

// ../../scripts/model-governance-hints-schema.ts
var import_ajv3 = __toESM(require_ajv());
var ajv3 = new import_ajv3.default({ allErrors: true, strict: true, allowUnionTypes: true });
var stringArraySchema2 = {
  type: "array",
  items: { type: "string" }
};
var recommendationItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value", "reason", "confidence"],
  properties: {
    value: { type: "string", minLength: 1 },
    reason: { type: "string", minLength: 1 },
    confidence: { type: "string", enum: ["low", "medium", "high"] }
  }
};
var structuredRecommendationItemSchema2 = {
  type: "object",
  additionalProperties: false,
  required: ["value", "source", "reason", "confidence", "consumed", "filteredBecause"],
  properties: {
    value: { type: "string", minLength: 1 },
    source: { type: "string", const: "model-provider" },
    reason: { type: "string", minLength: 1 },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    consumed: { type: "boolean" },
    matchedSkillId: { type: "string" },
    matchedBy: { type: "string", enum: ["exact-id", "substring", "token-overlap", "unmatched"] },
    matchScore: { type: "number" },
    filteredBecause: stringArraySchema2
  }
};
var modelGovernanceHintCandidateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "source",
    "providerId",
    "providerMode",
    "confidence",
    "explicitRolePreference",
    "recommendedSkillChain",
    "recommendedSubagentRoles",
    "researchPolicy",
    "delegationPreference",
    "constraints",
    "rationale",
    "overrideAllowed"
  ],
  properties: {
    source: { type: "string", const: "model-provider" },
    providerId: { type: "string", minLength: 1 },
    providerMode: {
      type: "string",
      enum: [
        "stub",
        "openai-compatible",
        "anthropic-http",
        "http-json",
        "mcp",
        "cli",
        "cursor-native",
        "claude-native",
        "codex-native"
      ]
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    suggestedStage: { type: "string" },
    suggestedAction: { type: "string" },
    suggestedArtifactTarget: { type: "string" },
    explicitRolePreference: stringArraySchema2,
    recommendedSkillChain: stringArraySchema2,
    recommendedSubagentRoles: stringArraySchema2,
    recommendedSkillItems: {
      type: "array",
      items: recommendationItemSchema
    },
    recommendedSubagentRoleItems: {
      type: "array",
      items: recommendationItemSchema
    },
    researchPolicy: { type: "string", enum: ["allowed", "forbidden", "preferred"] },
    delegationPreference: { type: "string", enum: ["decide-for-me", "ask-me-first"] },
    constraints: stringArraySchema2,
    rationale: { type: "string", minLength: 1 },
    overrideAllowed: { type: "boolean", const: false },
    forbiddenOverrides: {
      type: "object",
      additionalProperties: false,
      properties: {
        blockerOwnership: { type: "string" },
        failedCheckSeverity: { type: "string" },
        artifactRootTarget: { type: "string" },
        downstreamContinuation: { type: "boolean" }
      }
    }
  }
};
var filteredModelGovernanceHintsSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "source",
    "providerId",
    "providerMode",
    "confidence",
    "explicitRolePreference",
    "recommendedSkillChain",
    "recommendedSubagentRoles",
    "researchPolicy",
    "delegationPreference",
    "constraints",
    "rationale",
    "overrideAllowed",
    "debug"
  ],
  properties: {
    source: { type: "string", const: "model-provider" },
    providerId: { type: "string", minLength: 1 },
    providerMode: {
      type: "string",
      enum: [
        "stub",
        "openai-compatible",
        "anthropic-http",
        "http-json",
        "mcp",
        "cli",
        "cursor-native",
        "claude-native",
        "codex-native"
      ]
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    suggestedStage: { type: "string" },
    suggestedAction: { type: "string" },
    suggestedArtifactTarget: { type: "string" },
    explicitRolePreference: stringArraySchema2,
    recommendedSkillChain: stringArraySchema2,
    recommendedSubagentRoles: stringArraySchema2,
    recommendedSkillItems: {
      type: "array",
      items: structuredRecommendationItemSchema2
    },
    recommendedSubagentRoleItems: {
      type: "array",
      items: structuredRecommendationItemSchema2
    },
    researchPolicy: { type: "string", enum: ["allowed", "forbidden", "preferred"] },
    delegationPreference: { type: "string", enum: ["decide-for-me", "ask-me-first"] },
    constraints: stringArraySchema2,
    rationale: { type: "string", minLength: 1 },
    overrideAllowed: { type: "boolean", const: false },
    debug: {
      type: "object",
      additionalProperties: false,
      required: ["strippedForbiddenOverrides", "ignoredBecause"],
      properties: {
        strippedForbiddenOverrides: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "blockerOwnership",
              "failedCheckSeverity",
              "artifactRootTarget",
              "downstreamContinuation"
            ]
          }
        },
        ignoredBecause: stringArraySchema2
      }
    }
  }
};
var validateModelGovernanceHintCandidate = ajv3.compile(modelGovernanceHintCandidateSchema);
var validateFilteredModelGovernanceHints = ajv3.compile(filteredModelGovernanceHintsSchema);
function assertValidModelGovernanceHintCandidate(hint) {
  if (!validateModelGovernanceHintCandidate(hint)) {
    throw new Error(
      `Invalid model governance hint candidate: ${ajv3.errorsText(
        validateModelGovernanceHintCandidate.errors,
        { separator: "; " }
      )}`
    );
  }
}
function assertValidFilteredModelGovernanceHints(hints) {
  if (!validateFilteredModelGovernanceHints(hints)) {
    throw new Error(
      `Invalid filtered model governance hints: ${ajv3.errorsText(
        validateFilteredModelGovernanceHints.errors,
        { separator: "; " }
      )}`
    );
  }
}

// ../../scripts/model-governance-policy-filter.ts
function unique(values) {
  return [...new Set(values)];
}
function buildStructuredRecommendationItems(input) {
  const itemMap = new Map(
    (input.items ?? []).map((item) => [item.value, item])
  );
  return unique(input.values).filter(Boolean).map((value) => {
    const matched = itemMap.get(value);
    return {
      value,
      source: "model-provider",
      reason: matched?.reason ?? "Provider recommended this item.",
      confidence: matched?.confidence ?? "medium",
      consumed: true,
      filteredBecause: []
    };
  });
}
function filterModelGovernanceHintCandidate(candidate, context) {
  const strippedForbiddenOverrides = [];
  const ignoredBecause = [];
  if (!candidate) {
    return {
      modelHintPresent: false,
      filteredHints: null,
      strippedForbiddenOverrides,
      ignoredBecause,
      blockerOwnershipAffected: false
    };
  }
  const forbidden = candidate.forbiddenOverrides ?? {};
  if (forbidden.blockerOwnership !== void 0) {
    strippedForbiddenOverrides.push("blockerOwnership");
    ignoredBecause.push(
      context.gateFailure.blockerOwnershipLocked ? "blocker ownership locked" : "blocker ownership is governance-owned"
    );
  }
  if (forbidden.failedCheckSeverity !== void 0) {
    strippedForbiddenOverrides.push("failedCheckSeverity");
    ignoredBecause.push("failed-check severity is governance-owned");
  }
  if (forbidden.artifactRootTarget !== void 0) {
    strippedForbiddenOverrides.push("artifactRootTarget");
    ignoredBecause.push(
      context.artifactState.rootTargetLocked ? "artifact root target locked" : "artifact-derived root target is governance-owned"
    );
  }
  if (forbidden.downstreamContinuation !== void 0) {
    strippedForbiddenOverrides.push("downstreamContinuation");
    ignoredBecause.push("downstream continuation is governance-owned");
  }
  const filteredHints = {
    source: "model-provider",
    providerId: candidate.providerId,
    providerMode: candidate.providerMode,
    confidence: candidate.confidence,
    ...candidate.suggestedStage ? { suggestedStage: candidate.suggestedStage } : {},
    ...candidate.suggestedAction ? { suggestedAction: candidate.suggestedAction } : {},
    ...candidate.suggestedArtifactTarget && !context.artifactState.rootTargetLocked && strippedForbiddenOverrides.length === 0 ? { suggestedArtifactTarget: candidate.suggestedArtifactTarget } : {},
    explicitRolePreference: candidate.explicitRolePreference,
    recommendedSkillChain: candidate.recommendedSkillChain,
    recommendedSubagentRoles: candidate.recommendedSubagentRoles,
    recommendedSkillItems: buildStructuredRecommendationItems({
      values: candidate.recommendedSkillChain,
      items: candidate.recommendedSkillItems
    }),
    recommendedSubagentRoleItems: buildStructuredRecommendationItems({
      values: candidate.recommendedSubagentRoles,
      items: candidate.recommendedSubagentRoleItems
    }),
    researchPolicy: candidate.researchPolicy,
    delegationPreference: candidate.delegationPreference,
    constraints: candidate.constraints,
    rationale: candidate.rationale,
    overrideAllowed: false,
    debug: {
      strippedForbiddenOverrides: unique(strippedForbiddenOverrides),
      ignoredBecause: unique(ignoredBecause)
    }
  };
  assertValidFilteredModelGovernanceHints(filteredHints);
  return {
    modelHintPresent: true,
    filteredHints,
    strippedForbiddenOverrides: filteredHints.debug.strippedForbiddenOverrides,
    ignoredBecause: filteredHints.debug.ignoredBecause,
    blockerOwnershipAffected: false
  };
}
function toPromptRoutingHintsCompat(filteredHints) {
  return {
    source: "user-input",
    confidence: filteredHints.confidence,
    ...filteredHints.suggestedAction ? { requestedAction: filteredHints.suggestedAction } : {},
    ...filteredHints.suggestedStage ? { inferredStage: filteredHints.suggestedStage } : {},
    ...filteredHints.suggestedArtifactTarget ? { inferredArtifactTarget: filteredHints.suggestedArtifactTarget } : {},
    explicitRolePreference: filteredHints.explicitRolePreference,
    recommendedSkillChain: filteredHints.recommendedSkillChain,
    recommendedSubagentRoles: filteredHints.recommendedSubagentRoles,
    researchPolicy: filteredHints.researchPolicy,
    delegationPreference: filteredHints.delegationPreference,
    constraints: filteredHints.constraints,
    overrideAllowed: false,
    debug: {
      score: filteredHints.debug.strippedForbiddenOverrides.length > 0 ? 2 : 3,
      normalizedInput: `[model-provider:${filteredHints.providerId}]`,
      matchedStageAliases: filteredHints.suggestedStage ? [filteredHints.suggestedStage] : [],
      matchedActionAliases: filteredHints.suggestedAction ? [filteredHints.suggestedAction] : [],
      matchedArtifactAliases: filteredHints.suggestedArtifactTarget ? [filteredHints.suggestedArtifactTarget] : [],
      matchedRoleAliases: filteredHints.explicitRolePreference,
      matchedResearchPolicyAliases: filteredHints.researchPolicy === "allowed" ? [] : [filteredHints.researchPolicy],
      matchedDelegationAliases: filteredHints.delegationPreference === "ask-me-first" ? [] : [filteredHints.delegationPreference],
      matchedConstraintAliases: filteredHints.constraints
    }
  };
}

// ../../scripts/skill-semantic-features-config.ts
var SKILL_SEMANTIC_FEATURES_CONFIG = {
  stageHints: [
    { value: "architecture", priority: 100, weight: 4, rule: { tokensAny: ["architecture"] } },
    { value: "readiness", priority: 95, weight: 4, rule: { tokensAny: ["readiness"] } },
    { value: "plan", priority: 90, weight: 3, rule: { tokensAny: ["plan"] } },
    { value: "tasks", priority: 85, weight: 3, rule: { tokensAny: ["tasks"] } },
    { value: "post_audit", priority: 80, weight: 2, rule: { tokensAny: ["audit", "review"] } }
  ],
  actionHints: [
    { value: "patch", priority: 100, weight: 4, rule: { tokensAny: ["patch"] } },
    { value: "review", priority: 95, weight: 3, rule: { tokensAny: ["review"] } },
    { value: "plan", priority: 90, weight: 3, rule: { tokensAny: ["plan"] } },
    { value: "implement", priority: 85, weight: 3, rule: { tokensAny: ["implement"] } },
    { value: "fix", priority: 80, weight: 3, rule: { tokensAny: ["fix"] } }
  ],
  interactionHints: [
    { value: "party-mode", priority: 100, weight: 6, rule: { phrasesAny: ["party mode"] } },
    {
      value: "review-first",
      priority: 90,
      weight: 4,
      rule: { phrasesAny: ["critical auditor", "code reviewer"], tokensAny: ["review"] }
    },
    {
      value: "implement-first",
      priority: 80,
      weight: 3,
      rule: { tokensAny: ["implement", "patch", "fix"] }
    }
  ],
  researchPolicyHints: [
    {
      value: "forbidden",
      priority: 100,
      weight: 5,
      rule: { phrasesAny: ["do not browse", "no external browse"], tokensAny: ["forbidden"] }
    },
    {
      value: "preferred",
      priority: 80,
      weight: 2,
      rule: { phrasesAny: ["research preferred"], tokensAny: ["preferred"] }
    }
  ],
  delegationHints: [
    {
      value: "ask-me-first",
      priority: 100,
      weight: 4,
      rule: { phrasesAny: ["ask me first"] }
    },
    {
      value: "decide-for-me",
      priority: 90,
      weight: 3,
      rule: { phrasesAny: ["decide for me"] }
    }
  ],
  constraintHints: [
    {
      value: "minimal-patch",
      priority: 100,
      weight: 5,
      rule: { phrasesAny: ["minimal patch"] }
    },
    {
      value: "docs-only",
      priority: 90,
      weight: 4,
      rule: { phrasesAny: ["docs only"] }
    },
    {
      value: "no-external-browse",
      priority: 95,
      weight: 5,
      rule: { phrasesAny: ["no external browse"] }
    }
  ]
};

// ../../scripts/prompt-routing-governance.ts
function unique2(values) {
  return [...new Set(values)];
}
function normalizeSkillId(value) {
  return value.trim().toLowerCase();
}
function tokenizeSkillLabel(value) {
  return unique2(
    value.toLowerCase().split(/[^a-z0-9]+/u).map((token) => token.trim()).filter((token) => token.length >= 3)
  );
}
function uniqueEnum(values) {
  return [...new Set(values.filter(Boolean))];
}
function normalizeSkillPath(value) {
  return value.replace(/\\/g, "/").trim();
}
function skillIdFromPath(value) {
  const normalized = normalizeSkillPath(value);
  if (normalized === "") {
    return null;
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  const lastSegment = segments[segments.length - 1];
  if (lastSegment?.toLowerCase() === "skill.md") {
    const parentSegment = segments.length >= 2 ? segments[segments.length - 2] : null;
    return parentSegment ? normalizeSkillId(parentSegment) : null;
  }
  const leaf = lastSegment;
  return normalizeSkillId(leaf.replace(/\.[^.]+$/u, ""));
}
function normalizeSkillAvailability(input) {
  const availableSkills = unique2([
    ...(input.availableSkills ?? []).map((skill) => normalizeSkillId(skill)).filter(Boolean),
    ...(input.skillInventory ?? []).map((entry) => normalizeSkillId(entry.skillId)).filter(Boolean),
    ...(input.skillPaths ?? []).map((skillPath) => skillIdFromPath(skillPath)).filter((skillId) => Boolean(skillId)),
    ...(input.skillInventory ?? []).map((entry) => entry.path ? skillIdFromPath(entry.path) : null).filter((skillId) => Boolean(skillId))
  ]);
  const skillPaths = unique2([
    ...(input.skillPaths ?? []).map((skillPath) => normalizeSkillPath(skillPath)).filter(Boolean),
    ...(input.skillInventory ?? []).map((entry) => entry.path ? normalizeSkillPath(entry.path) : "").filter(Boolean)
  ]);
  return { availableSkills, skillPaths };
}
function deriveSemanticSkillFeatures(entry) {
  const text = [entry.skillId, entry.title, entry.description, entry.summary].filter((value) => Boolean(value && value.trim())).join(" ").toLowerCase();
  const tokens = tokenizeSkillLabel(text);
  const matchesRule = (rule) => {
    const tokenMatch = (rule.tokensAny ?? []).some((token) => tokens.includes(token));
    const phraseMatch = (rule.phrasesAny ?? []).some((phrase) => text.includes(phrase));
    return tokenMatch || phraseMatch;
  };
  const collectScoredValues = (entries) => {
    const scored = entries.filter((entryRule) => matchesRule(entryRule.rule)).map((entryRule) => ({
      value: entryRule.value,
      score: entryRule.priority * 100 + entryRule.weight
    })).sort((left, right) => right.score - left.score);
    return {
      values: uniqueEnum(scored.map((entryRule) => entryRule.value)),
      scores: Object.fromEntries(scored.map((entryRule) => [entryRule.value, entryRule.score]))
    };
  };
  const stageHints = collectScoredValues(SKILL_SEMANTIC_FEATURES_CONFIG.stageHints);
  const actionHints = collectScoredValues(SKILL_SEMANTIC_FEATURES_CONFIG.actionHints);
  const interactionHints = collectScoredValues(SKILL_SEMANTIC_FEATURES_CONFIG.interactionHints);
  const researchPolicyHints = collectScoredValues(
    SKILL_SEMANTIC_FEATURES_CONFIG.researchPolicyHints
  );
  const delegationHints = collectScoredValues(SKILL_SEMANTIC_FEATURES_CONFIG.delegationHints);
  const constraintHints = collectScoredValues(SKILL_SEMANTIC_FEATURES_CONFIG.constraintHints);
  return {
    skillId: entry.skillId,
    ...entry.path ? { path: entry.path } : {},
    ...entry.title ? { title: entry.title } : {},
    stageHints: stageHints.values,
    stageHintScores: stageHints.scores,
    actionHints: actionHints.values,
    actionHintScores: actionHints.scores,
    interactionHints: interactionHints.values,
    interactionHintScores: interactionHints.scores,
    researchPolicyHints: researchPolicyHints.values,
    researchPolicyHintScores: researchPolicyHints.scores,
    delegationHints: delegationHints.values,
    delegationHintScores: delegationHints.scores,
    constraintHints: constraintHints.values,
    constraintHintScores: constraintHints.scores
  };
}
function resolveSkillAvailability(input) {
  const normalizedAvailability = normalizeSkillAvailability(input);
  const orderedInventory = (input.skillInventory ?? []).map((entry) => ({
    skillId: normalizeSkillId(entry.skillId),
    path: entry.path ? normalizeSkillPath(entry.path) : void 0,
    title: entry.title?.trim(),
    description: entry.description?.trim(),
    summary: entry.summary?.trim()
  })).filter((entry) => entry.skillId !== "");
  if (normalizedAvailability.availableSkills.length === 0 && normalizedAvailability.skillPaths.length === 0) {
    return {
      ...normalizedAvailability,
      matchedAvailableSkills: [],
      missingSkills: [],
      skillMatchReasons: [],
      semanticSkillFeatures: [],
      semanticFeatureTopN: {
        stageHints: [],
        actionHints: [],
        interactionHints: [],
        researchPolicyHints: [],
        delegationHints: [],
        constraintHints: []
      },
      filteredSkillChain: input.requestedSkillChain,
      skillAvailabilityMode: "not-provided"
    };
  }
  const matchedAvailableSkills = [];
  const missingSkills = [];
  const skillMatchReasons = [];
  const semanticSkillFeatures = [];
  const filteredSkillChain = [];
  for (const requestedSkill of input.requestedSkillChain) {
    const requestedId = normalizeSkillId(requestedSkill);
    const requestedTokens = tokenizeSkillLabel(requestedId);
    const scoreSkillMatch = (candidate) => {
      const normalizedCandidate = normalizeSkillId(candidate.skillId);
      const exactIdMatch = normalizedCandidate === requestedId;
      if (exactIdMatch) {
        return {
          score: 1e4,
          exactIdMatch: true,
          substringMatch: false,
          overlapTokens: []
        };
      }
      const substringMatch = normalizedCandidate.includes(requestedId) || requestedId.includes(normalizedCandidate);
      let score = 0;
      if (substringMatch) {
        score += 2e3;
      }
      const candidateTokens = tokenizeSkillLabel(
        [
          normalizedCandidate,
          candidate.path ?? "",
          candidate.title ?? "",
          candidate.description ?? "",
          candidate.summary ?? ""
        ].join(" ")
      );
      const overlapTokens = requestedTokens.filter(
        (token) => candidateTokens.includes(token)
      );
      score += overlapTokens.length * 250;
      if (requestedTokens.length > 0 && overlapTokens.length === requestedTokens.length) {
        score += 500;
      }
      return {
        score,
        exactIdMatch: false,
        substringMatch,
        overlapTokens
      };
    };
    const inventoryMatch = orderedInventory.map((entry, index) => ({
      entry,
      index,
      match: scoreSkillMatch(entry)
    })).filter((candidate) => candidate.match.score > 0).sort((left, right) => {
      if (right.match.score !== left.match.score) {
        return right.match.score - left.match.score;
      }
      return left.index - right.index;
    })[0];
    const fallbackMatch = normalizedAvailability.availableSkills.map((skillId, index) => ({
      skillId,
      index,
      match: scoreSkillMatch({ skillId })
    })).filter((candidate) => candidate.match.score > 0).sort((left, right) => {
      if (right.match.score !== left.match.score) {
        return right.match.score - left.match.score;
      }
      return left.index - right.index;
    })[0];
    const resolvedSkill = inventoryMatch?.entry.skillId ?? fallbackMatch?.skillId ?? null;
    if (!resolvedSkill) {
      missingSkills.push(normalizeSkillId(requestedSkill));
      continue;
    }
    matchedAvailableSkills.push(resolvedSkill);
    filteredSkillChain.push(resolvedSkill);
    if (inventoryMatch) {
      semanticSkillFeatures.push(deriveSemanticSkillFeatures(inventoryMatch.entry));
      skillMatchReasons.push({
        requestedSkill: requestedId,
        matchedSkillId: inventoryMatch.entry.skillId,
        ...inventoryMatch.entry.path ? { matchedPath: inventoryMatch.entry.path } : {},
        score: inventoryMatch.match.score,
        exactIdMatch: inventoryMatch.match.exactIdMatch,
        substringMatch: inventoryMatch.match.substringMatch,
        overlapTokens: inventoryMatch.match.overlapTokens,
        ...inventoryMatch.entry.title ? { title: inventoryMatch.entry.title } : {},
        ...inventoryMatch.entry.description ? { description: inventoryMatch.entry.description } : {},
        ...inventoryMatch.entry.summary ? { summary: inventoryMatch.entry.summary } : {}
      });
    } else if (fallbackMatch) {
      semanticSkillFeatures.push(
        deriveSemanticSkillFeatures({
          skillId: fallbackMatch.skillId
        })
      );
      skillMatchReasons.push({
        requestedSkill: requestedId,
        matchedSkillId: fallbackMatch.skillId,
        score: fallbackMatch.match.score,
        exactIdMatch: fallbackMatch.match.exactIdMatch,
        substringMatch: fallbackMatch.match.substringMatch,
        overlapTokens: fallbackMatch.match.overlapTokens
      });
    }
  }
  const buildTopN = (pickValues, pickScores) => {
    const aggregated = /* @__PURE__ */ new Map();
    for (const feature of semanticSkillFeatures) {
      for (const value of pickValues(feature)) {
        const score = pickScores(feature)?.[value] ?? 0;
        const current = aggregated.get(value);
        if (!current) {
          aggregated.set(value, {
            score,
            provenanceSkillIds: [feature.skillId]
          });
          continue;
        }
        current.score = Math.max(current.score, score);
        current.provenanceSkillIds = unique2([...current.provenanceSkillIds, feature.skillId]);
      }
    }
    return [...aggregated.entries()].map(([value, payload]) => ({
      value,
      score: payload.score,
      provenanceSkillIds: payload.provenanceSkillIds
    })).sort((left, right) => right.score - left.score).slice(0, 3);
  };
  const semanticFeatureTopN = {
    stageHints: buildTopN(
      (feature) => feature.stageHints,
      (feature) => feature.stageHintScores
    ),
    actionHints: buildTopN(
      (feature) => feature.actionHints,
      (feature) => feature.actionHintScores
    ),
    interactionHints: buildTopN(
      (feature) => feature.interactionHints,
      (feature) => feature.interactionHintScores
    ),
    researchPolicyHints: buildTopN(
      (feature) => feature.researchPolicyHints,
      (feature) => feature.researchPolicyHintScores
    ),
    delegationHints: buildTopN(
      (feature) => feature.delegationHints,
      (feature) => feature.delegationHintScores
    ),
    constraintHints: buildTopN(
      (feature) => feature.constraintHints,
      (feature) => feature.constraintHintScores
    )
  };
  return {
    ...normalizedAvailability,
    matchedAvailableSkills: unique2(matchedAvailableSkills),
    missingSkills: unique2(missingSkills),
    skillMatchReasons,
    semanticSkillFeatures,
    semanticFeatureTopN,
    filteredSkillChain: unique2(filteredSkillChain),
    skillAvailabilityMode: "execution-filtered"
  };
}
function findBestSkillMatch(requestedSkill, input) {
  const normalizedAvailability = normalizeSkillAvailability(input);
  const requestedId = normalizeSkillId(requestedSkill);
  const requestedTokens = tokenizeSkillLabel(requestedId);
  const orderedInventory = (input.skillInventory ?? []).map((entry) => ({
    skillId: normalizeSkillId(entry.skillId),
    path: entry.path ? normalizeSkillPath(entry.path) : void 0,
    title: entry.title?.trim(),
    description: entry.description?.trim(),
    summary: entry.summary?.trim()
  })).filter((entry) => entry.skillId !== "");
  const scoreSkillMatch = (candidate) => {
    const normalizedCandidate = normalizeSkillId(candidate.skillId);
    const exactIdMatch = normalizedCandidate === requestedId;
    if (exactIdMatch) {
      return {
        score: 1e4,
        matchedBy: "exact-id"
      };
    }
    const substringMatch = normalizedCandidate.includes(requestedId) || requestedId.includes(normalizedCandidate);
    let score = 0;
    if (substringMatch) {
      score += 2e3;
    }
    const candidateTokens = tokenizeSkillLabel(
      [
        normalizedCandidate,
        candidate.path ?? "",
        candidate.title ?? "",
        candidate.description ?? "",
        candidate.summary ?? ""
      ].join(" ")
    );
    const overlapTokens = requestedTokens.filter((token) => candidateTokens.includes(token));
    score += overlapTokens.length * 250;
    if (requestedTokens.length > 0 && overlapTokens.length === requestedTokens.length) {
      score += 500;
    }
    return {
      score,
      matchedBy: substringMatch ? "substring" : overlapTokens.length > 0 ? "token-overlap" : "unmatched"
    };
  };
  const inventoryMatch = orderedInventory.map((entry, index) => ({
    entry,
    index,
    match: scoreSkillMatch(entry)
  })).filter((candidate) => candidate.match.score > 0).sort((left, right) => {
    if (right.match.score !== left.match.score) {
      return right.match.score - left.match.score;
    }
    return left.index - right.index;
  })[0];
  const fallbackMatch = normalizedAvailability.availableSkills.map((skillId, index) => ({
    skillId,
    index,
    match: scoreSkillMatch({ skillId })
  })).filter((candidate) => candidate.match.score > 0).sort((left, right) => {
    if (right.match.score !== left.match.score) {
      return right.match.score - left.match.score;
    }
    return left.index - right.index;
  })[0];
  if (inventoryMatch) {
    return {
      matchedSkillId: inventoryMatch.entry.skillId,
      matchedBy: inventoryMatch.match.matchedBy,
      matchScore: inventoryMatch.match.score
    };
  }
  if (fallbackMatch) {
    return {
      matchedSkillId: fallbackMatch.skillId,
      matchedBy: fallbackMatch.match.matchedBy,
      matchScore: fallbackMatch.match.score
    };
  }
  return {
    matchedBy: "unmatched"
  };
}
function resolveExecutionIntentSource(input) {
  if (input.promptHints && input.modelHints) {
    return "merged";
  }
  if (input.promptHints) {
    return "prompt-hints";
  }
  if (input.modelHints) {
    return "model-hints";
  }
  return "default";
}
function selectResearchPolicy(promptHints, modelHints) {
  const values = [promptHints?.researchPolicy, modelHints?.researchPolicy].filter(
    (value) => Boolean(value)
  );
  if (values.includes("forbidden")) {
    return "forbidden";
  }
  if (values.includes("preferred")) {
    return "preferred";
  }
  return "allowed";
}
function selectDelegationPreference(promptHints, modelHints) {
  const values = [promptHints?.delegationPreference, modelHints?.delegationPreference].filter(
    (value) => Boolean(value)
  );
  if (values.includes("ask-me-first")) {
    return "ask-me-first";
  }
  return "decide-for-me";
}
function selectInteractionMode(input) {
  const roles = new Set(input.rolePreferences);
  if (roles.has("party-mode")) {
    return "party-mode";
  }
  if (input.action === "review" || roles.has("critical-auditor") || roles.has("code-reviewer")) {
    return "review-first";
  }
  if (input.action === "patch" || input.action === "implement" || input.action === "fix") {
    return "implement-first";
  }
  return "single-agent";
}
function buildSkillChain(input) {
  const skillChain = [];
  skillChain.push(...input.recommendedSkillChain ?? []);
  if (input.stage || input.action) {
    skillChain.push("speckit-workflow");
  }
  if (input.interactionMode === "party-mode") {
    skillChain.push("party-mode");
  }
  if (input.action === "review" || input.rolePreferences.includes("critical-auditor") || input.rolePreferences.includes("code-reviewer")) {
    skillChain.push("code-reviewer");
  }
  return unique2(skillChain);
}
function buildExecutionIntentCandidate(input) {
  const source = resolveExecutionIntentSource(input);
  if (source === "default") {
    return null;
  }
  const stage = input.promptHints?.inferredStage ?? input.modelHints?.inferredStage;
  const action = input.promptHints?.requestedAction ?? input.modelHints?.requestedAction;
  const rolePreferences = unique2([
    ...input.promptHints?.explicitRolePreference ?? [],
    ...input.modelHints?.explicitRolePreference ?? []
  ]);
  const recommendedSubagentRoles = unique2([
    ...input.promptHints?.recommendedSubagentRoles ?? [],
    ...input.modelHints?.recommendedSubagentRoles ?? []
  ]);
  const recommendedSkillChain = unique2([
    ...input.promptHints?.recommendedSkillChain ?? [],
    ...input.modelHints?.recommendedSkillChain ?? []
  ]);
  const requestedSkillChainPreview = buildSkillChain({
    stage,
    action,
    interactionMode: selectInteractionMode({ action, rolePreferences }),
    rolePreferences,
    recommendedSkillChain
  });
  const skillAvailabilityPreview = resolveSkillAvailability({
    requestedSkillChain: requestedSkillChainPreview,
    availableSkills: input.availableSkills,
    skillPaths: input.skillPaths,
    skillInventory: input.skillInventory
  });
  const providerRecommendationItems = {
    skills: (input.filteredModelHints?.recommendedSkillItems ?? []).map((item) => {
      const match = findBestSkillMatch(item.value, {
        availableSkills: input.availableSkills,
        skillPaths: input.skillPaths,
        skillInventory: input.skillInventory
      });
      const consumed = skillAvailabilityPreview.filteredSkillChain.includes(item.value);
      const filteredBecause = !match.matchedSkillId ? ["not-available-in-inventory"] : !consumed ? ["replaced-by-better-match"] : [];
      return {
        ...item,
        consumed,
        ...match.matchedSkillId ? { matchedSkillId: match.matchedSkillId } : {},
        matchedBy: match.matchedBy,
        ...match.matchScore !== void 0 ? { matchScore: match.matchScore } : {},
        filteredBecause
      };
    }),
    subagentRoles: (input.filteredModelHints?.recommendedSubagentRoleItems ?? []).map((item) => ({
      ...item,
      consumed: recommendedSubagentRoles.includes(item.value),
      filteredBecause: recommendedSubagentRoles.includes(item.value) ? [] : ["blocked-by-governance-filter"]
    }))
  };
  const interactionMode = selectInteractionMode({ action, rolePreferences });
  const subagentRoles = unique2([
    ...recommendedSubagentRoles,
    ...rolePreferences.filter((role) => role !== "party-mode")
  ]);
  const requestedSkillChain = buildSkillChain({
    stage,
    action,
    interactionMode,
    rolePreferences,
    recommendedSkillChain
  });
  const skillAvailability = resolveSkillAvailability({
    requestedSkillChain,
    availableSkills: input.availableSkills,
    skillPaths: input.skillPaths,
    skillInventory: input.skillInventory
  });
  const semanticFeatures = skillAvailability.semanticSkillFeatures;
  const semanticTopN = skillAvailability.semanticFeatureTopN;
  const semanticStage = semanticTopN.stageHints[0]?.value;
  const semanticAction = semanticTopN.actionHints[0]?.value;
  const semanticInteractionMode = semanticTopN.interactionHints[0]?.value;
  const semanticResearchPolicy = semanticTopN.researchPolicyHints[0]?.value;
  const semanticDelegationPreference = semanticTopN.delegationHints[0]?.value;
  const semanticConstraints = semanticFeatures.flatMap((feature) => feature.constraintHints);
  const candidate = {
    source,
    ...stage ?? semanticStage ? { stage: stage ?? semanticStage } : {},
    ...action ?? semanticAction ? { action: action ?? semanticAction } : {},
    skillChain: requestedSkillChain,
    subagentRoles,
    providerRecommendedSkillChain: recommendedSkillChain,
    providerRecommendedSubagentRoles: recommendedSubagentRoles,
    providerRecommendationItems,
    availableSkills: skillAvailability.availableSkills,
    skillPaths: skillAvailability.skillPaths,
    matchedAvailableSkills: skillAvailability.matchedAvailableSkills,
    missingSkills: skillAvailability.missingSkills,
    skillMatchReasons: skillAvailability.skillMatchReasons,
    semanticSkillFeatures: semanticFeatures,
    semanticFeatureTopN: semanticTopN,
    skillAvailabilityMode: skillAvailability.skillAvailabilityMode === "not-provided" ? "not-provided" : "advisory-only",
    interactionMode: semanticInteractionMode ?? interactionMode,
    researchPolicy: selectResearchPolicy(input.promptHints, input.modelHints) === "allowed" && semanticResearchPolicy ? semanticResearchPolicy : selectResearchPolicy(input.promptHints, input.modelHints),
    delegationPreference: selectDelegationPreference(input.promptHints, input.modelHints) === "decide-for-me" && semanticDelegationPreference ? semanticDelegationPreference : selectDelegationPreference(input.promptHints, input.modelHints),
    constraints: unique2([
      ...input.promptHints?.constraints ?? [],
      ...input.modelHints?.constraints ?? [],
      ...semanticConstraints
    ]),
    rationale: source === "merged" ? "Merged user prompt hints with governance provider hints." : source === "prompt-hints" ? semanticFeatures.length > 0 ? "Derived from user prompt hints and matched skill semantic features." : "Derived from user prompt hints." : semanticFeatures.length > 0 ? "Derived from governance provider hints and matched skill semantic features." : "Derived from governance provider hints.",
    advisoryOnly: true
  };
  assertValidExecutionIntentCandidate(candidate);
  return candidate;
}
function buildExecutionPlanDecision(input, candidate) {
  if (!candidate) {
    return null;
  }
  const governanceConstraints = unique2([
    ...input.gateFailure.blockerOwnershipLocked ? ["blocker ownership locked"] : [],
    ...input.artifactState.rootTargetLocked ? ["artifact target locked"] : []
  ]);
  const blockedByGovernance = unique2([
    ...input.gateFailure.exists && (candidate.stage || candidate.action) ? ["entry-routing"] : [],
    ...input.gateFailure.blockerOwnershipLocked ? ["blocker-ownership"] : [],
    ...input.artifactState.rootTargetLocked ? ["artifact-target"] : []
  ]);
  const skillAvailability = resolveSkillAvailability({
    requestedSkillChain: candidate.skillChain,
    availableSkills: input.availableSkills,
    skillPaths: input.skillPaths,
    skillInventory: input.skillInventory
  });
  const decision = {
    source: candidate.source,
    ...candidate.stage ? { stage: candidate.stage } : {},
    ...candidate.action ? { action: candidate.action } : {},
    skillChain: skillAvailability.skillAvailabilityMode === "execution-filtered" ? skillAvailability.filteredSkillChain : candidate.skillChain,
    subagentRoles: candidate.subagentRoles,
    providerRecommendedSkillChain: candidate.providerRecommendedSkillChain,
    providerRecommendedSubagentRoles: candidate.providerRecommendedSubagentRoles,
    providerRecommendationItems: candidate.providerRecommendationItems,
    availableSkills: skillAvailability.availableSkills,
    skillPaths: skillAvailability.skillPaths,
    matchedAvailableSkills: skillAvailability.matchedAvailableSkills,
    missingSkills: skillAvailability.missingSkills,
    skillMatchReasons: skillAvailability.skillMatchReasons,
    semanticSkillFeatures: candidate.semanticSkillFeatures,
    semanticFeatureTopN: candidate.semanticFeatureTopN,
    skillAvailabilityMode: skillAvailability.skillAvailabilityMode,
    interactionMode: candidate.interactionMode,
    researchPolicy: candidate.researchPolicy,
    delegationPreference: candidate.delegationPreference,
    governanceConstraints,
    blockedByGovernance,
    rationale: [
      governanceConstraints.length > 0 ? `${candidate.rationale} Governance constraints preserved during execution planning.` : `${candidate.rationale} No governance constraints altered the execution plan.`,
      skillAvailability.skillAvailabilityMode === "execution-filtered" ? "Available skill inventory filtered the local execution chain without creating new governance blockers." : skillAvailability.skillAvailabilityMode === "not-provided" ? "No skill inventory was provided, so local execution chain filtering was skipped." : null
    ].filter((line) => Boolean(line)).join(" "),
    advisoryOnly: false
  };
  assertValidExecutionPlanDecision(decision);
  return decision;
}
function hasExplicitConstraint(hints) {
  return hints.researchPolicy !== "allowed" || hints.delegationPreference !== "ask-me-first" || hints.constraints.length > 0;
}
function evaluateHints(hints, input) {
  const appliedTo = [];
  const ignoredBecause = [];
  if (hints.delegationPreference !== "ask-me-first") {
    appliedTo.push("interaction-style");
  }
  if (hints.researchPolicy !== "allowed") {
    appliedTo.push("research-policy");
  }
  const lowConfidence = hints.confidence === "low";
  if (lowConfidence && !hasExplicitConstraint(hints)) {
    ignoredBecause.push("low confidence");
    return {
      appliedTo,
      ignoredBecause
    };
  }
  const entryRoutingEligible = !input.gateFailure.exists;
  if (entryRoutingEligible) {
    if (hints.inferredStage || hints.requestedAction || hints.inferredArtifactTarget) {
      appliedTo.push("entry-routing");
    }
  } else if (hints.inferredStage || hints.requestedAction || hints.inferredArtifactTarget) {
    ignoredBecause.push("no failed-gate-free entry routing window");
  }
  const adapterSelectionEligible = input.artifactState.equivalentAdapterCount > 1;
  const adapterPreferenceRequested = hints.explicitRolePreference.length > 0 || hints.researchPolicy !== "allowed" || hints.constraints.length > 0;
  if (adapterSelectionEligible && adapterPreferenceRequested) {
    appliedTo.push("adapter-selection");
  } else if (adapterPreferenceRequested) {
    ignoredBecause.push("no equivalent adapter choice");
  }
  if (input.gateFailure.blockerOwnershipLocked) {
    ignoredBecause.push("blocker ownership locked");
  }
  if (input.artifactState.rootTargetLocked) {
    ignoredBecause.push("artifact target locked");
  }
  return {
    appliedTo: [...new Set(appliedTo)],
    ignoredBecause: [...new Set(ignoredBecause)]
  };
}
function resolvePromptHintUsage(input) {
  const filteredModel = input.modelHintsCandidate ? filterModelGovernanceHintCandidate(input.modelHintsCandidate, {
    gateFailure: input.gateFailure,
    artifactState: input.artifactState
  }) : null;
  const compatModelHints = filteredModel?.filteredHints ? toPromptRoutingHintsCompat(filteredModel.filteredHints) : null;
  const record = {
    promptHintPresent: Boolean(input.promptHints),
    hintConfidence: input.promptHints?.confidence ?? "n/a",
    modelHintPresent: Boolean(input.modelHintsCandidate),
    modelHintConfidence: input.modelHintsCandidate?.confidence ?? "n/a",
    consumedAfter: "stage context -> gate failure -> artifact state -> PromptRoutingHints",
    hintAppliedTo: [],
    hintIgnoredBecause: [],
    modelHintAppliedTo: [],
    modelHintIgnoredBecause: [],
    modelHintDebug: null,
    filteredModelHints: filteredModel?.filteredHints ?? null,
    executionIntentCandidate: null,
    executionPlanDecision: null,
    blockerOwnershipAffected: false
  };
  const hints = input.promptHints;
  if (hints) {
    const promptUsage = evaluateHints(hints, input);
    record.hintAppliedTo.push(...promptUsage.appliedTo);
    record.hintIgnoredBecause.push(...promptUsage.ignoredBecause);
  }
  if (filteredModel) {
    record.modelHintDebug = filteredModel.filteredHints?.debug ?? {
      strippedForbiddenOverrides: filteredModel.strippedForbiddenOverrides,
      ignoredBecause: filteredModel.ignoredBecause
    };
    record.modelHintIgnoredBecause.push(...filteredModel.ignoredBecause);
    if (compatModelHints) {
      const modelUsage = evaluateHints(compatModelHints, input);
      record.modelHintAppliedTo.push(...modelUsage.appliedTo);
      record.modelHintIgnoredBecause.push(...modelUsage.ignoredBecause);
      record.hintAppliedTo.push(...modelUsage.appliedTo);
      record.hintIgnoredBecause.push(...filteredModel.ignoredBecause, ...modelUsage.ignoredBecause);
    }
  }
  record.executionIntentCandidate = buildExecutionIntentCandidate({
    promptHints: input.promptHints,
    modelHints: compatModelHints,
    filteredModelHints: filteredModel?.filteredHints ?? null,
    availableSkills: input.availableSkills,
    skillPaths: input.skillPaths,
    skillInventory: input.skillInventory
  });
  record.executionPlanDecision = buildExecutionPlanDecision(
    input,
    record.executionIntentCandidate
  );
  record.hintIgnoredBecause = [...new Set(record.hintIgnoredBecause)];
  record.hintAppliedTo = [...new Set(record.hintAppliedTo)];
  record.modelHintIgnoredBecause = [...new Set(record.modelHintIgnoredBecause)];
  record.modelHintAppliedTo = [...new Set(record.modelHintAppliedTo)];
  return record;
}
function resolvePromptHintUsageFromText(input) {
  const promptHints = input.promptText ? resolvePromptRoutingHintsFromText(input.projectRoot, input.promptText) : null;
  return resolvePromptHintUsage({
    stageContextKnown: input.stageContextKnown,
    gateFailure: input.gateFailure,
    artifactState: input.artifactState,
    promptHints,
    modelHintsCandidate: input.modelHintsCandidate,
    availableSkills: input.availableSkills,
    skillPaths: input.skillPaths,
    skillInventory: input.skillInventory
  });
}

// ../../scripts/governance-remediation-artifact.ts
var deferredGapGovernance = __toESM(require_deferred_gap_governance2());
var {
  readDeferredGapsFromReport
} = deferredGapGovernance;
function yesNo(value) {
  return value ? "yes" : "no";
}
function normalizeText2(value) {
  return String(value ?? "").trim();
}
function bulletList(items) {
  if (items.length === 0) {
    return "- (none)";
  }
  return items.map((item) => `- ${item}`).join("\n");
}
function buildPromptHintUsageLines(usage) {
  return [
    "- Prompt hint present: " + (usage.promptHintPresent ? "yes" : "no"),
    `- Hint confidence: ${usage.hintConfidence}`,
    `- Consumed after: \`${usage.consumedAfter}\``,
    "- Hint applied to:",
    ...usage.hintAppliedTo.length > 0 ? usage.hintAppliedTo.map((item) => `  - ${item}`) : ["  - (none)"],
    "- Hint ignored because:",
    ...usage.hintIgnoredBecause.length > 0 ? usage.hintIgnoredBecause.map((item) => `  - ${item}`) : ["  - (none)"],
    "- Blocker ownership affected: no"
  ];
}
function buildModelHintUsageLines(usage) {
  return [
    "- Model hint present: " + (usage.modelHintPresent ? "yes" : "no"),
    `- Model hint confidence: ${usage.modelHintConfidence}`,
    "- Model hint applied to:",
    ...usage.modelHintAppliedTo.length > 0 ? usage.modelHintAppliedTo.map((item) => `  - ${item}`) : ["  - (none)"],
    "- Model hint ignored because:",
    ...usage.modelHintIgnoredBecause.length > 0 ? usage.modelHintIgnoredBecause.map((item) => `  - ${item}`) : ["  - (none)"],
    "- Model hint debug:",
    ...usage.modelHintDebug ? [
      `  - Stripped forbidden overrides: ${usage.modelHintDebug.strippedForbiddenOverrides.join(", ") || "(none)"}`,
      `  - Policy ignored because: ${usage.modelHintDebug.ignoredBecause.join(", ") || "(none)"}`
    ] : ["  - (none)"],
    "- Model hints remain advisory only: yes"
  ];
}
function formatSemanticSkillFeaturesCompact(semanticSkillFeatures) {
  if (semanticSkillFeatures.length === 0) {
    return "(none)";
  }
  const renderedFeatures = semanticSkillFeatures.map((feature) => {
    const details = [
      feature.stageHints.length > 0 ? `stage=${feature.stageHints.join("|")}` : null,
      feature.actionHints.length > 0 ? `action=${feature.actionHints.join("|")}` : null,
      feature.interactionHints.length > 0 ? `interaction=${feature.interactionHints.join("|")}` : null,
      feature.researchPolicyHints.length > 0 ? `research=${feature.researchPolicyHints.join("|")}` : null,
      feature.delegationHints.length > 0 ? `delegation=${feature.delegationHints.join("|")}` : null,
      feature.constraintHints.length > 0 ? `constraints=${feature.constraintHints.join("|")}` : null
    ].filter((detail) => Boolean(detail)).join("; ");
    return `${feature.skillId}${details ? ` [${details}]` : ""}`;
  });
  return [...new Set(renderedFeatures)].join(" || ");
}
function buildExecutionIntentCandidateLines(candidate) {
  if (!candidate) {
    return ["- (none)"];
  }
  const compactSkillMatchLines = candidate.skillMatchReasons.length > 0 ? candidate.skillMatchReasons.map((reason) => {
    const flags = [
      reason.exactIdMatch ? "exact" : null,
      reason.substringMatch ? "substr" : null,
      reason.overlapTokens.length > 0 ? `tokens=${reason.overlapTokens.join("|")}` : null
    ].filter((flag) => Boolean(flag)).join(", ");
    return `  - ${reason.requestedSkill} -> ${reason.matchedSkillId} [score=${reason.score}${flags ? `; ${flags}` : ""}]`;
  }) : ["  - (none)"];
  const compactTopN = [
    ["stageHints", candidate.semanticFeatureTopN.stageHints],
    ["actionHints", candidate.semanticFeatureTopN.actionHints],
    ["interactionHints", candidate.semanticFeatureTopN.interactionHints],
    ["researchPolicyHints", candidate.semanticFeatureTopN.researchPolicyHints],
    ["delegationHints", candidate.semanticFeatureTopN.delegationHints],
    ["constraintHints", candidate.semanticFeatureTopN.constraintHints]
  ].map(([label, items]) => {
    const rendered = items.map((item) => `${item.value}@${item.score}<-${item.provenanceSkillIds.join("|")}`).join(", ");
    return rendered ? `  - ${label}: ${rendered}` : null;
  }).filter((line) => Boolean(line));
  return [
    `- Source: ${candidate.source}`,
    `- Stage: ${candidate.stage ?? "(none)"}`,
    `- Action: ${candidate.action ?? "(none)"}`,
    `- Interaction Mode: ${candidate.interactionMode}`,
    `- Skill Availability Mode: ${candidate.skillAvailabilityMode}`,
    `- Available Skills: ${candidate.availableSkills.join(", ") || "(none)"}`,
    `- Skill Paths: ${candidate.skillPaths.join(", ") || "(none)"}`,
    `- Matched Available Skills: ${candidate.matchedAvailableSkills.join(", ") || "(none)"}`,
    `- Missing Skills: ${candidate.missingSkills.join(", ") || "(none)"}`,
    "- Skill Match Reasons:",
    ...compactSkillMatchLines,
    `- Semantic Skill Features: ${formatSemanticSkillFeaturesCompact(candidate.semanticSkillFeatures)}`,
    "- Semantic Feature Top-N:",
    ...compactTopN.length > 0 ? compactTopN : ["  - (none)"],
    `- Research Policy: ${candidate.researchPolicy}`,
    `- Delegation Preference: ${candidate.delegationPreference}`,
    `- Provider Recommended Skill Chain: ${candidate.providerRecommendedSkillChain.join(", ") || "(none)"}`,
    `- Provider Recommended Subagent Roles: ${candidate.providerRecommendedSubagentRoles.join(", ") || "(none)"}`,
    "- Provider Recommendation Items (Skills):",
    ...candidate.providerRecommendationItems.skills.length > 0 ? candidate.providerRecommendationItems.skills.map(
      (item) => `  - ${item.value} [source=${item.source}; confidence=${item.confidence}; consumed=${item.consumed ? "yes" : "no"}; reason=${item.reason}; filteredBecause=${item.filteredBecause.join("|") || "(none)"}]`
    ) : ["  - (none)"],
    "- Provider Recommendation Items (Subagent Roles):",
    ...candidate.providerRecommendationItems.subagentRoles.length > 0 ? candidate.providerRecommendationItems.subagentRoles.map(
      (item) => `  - ${item.value} [source=${item.source}; confidence=${item.confidence}; consumed=${item.consumed ? "yes" : "no"}; reason=${item.reason}; filteredBecause=${item.filteredBecause.join("|") || "(none)"}]`
    ) : ["  - (none)"],
    `- Skill Chain: ${candidate.skillChain.join(", ") || "(none)"}`,
    `- Subagent Roles: ${candidate.subagentRoles.join(", ") || "(none)"}`,
    `- Constraints: ${candidate.constraints.join(", ") || "(none)"}`,
    `- Advisory Only: ${candidate.advisoryOnly ? "yes" : "no"}`
  ];
}
function buildExecutionPlanDecisionLines(decision) {
  if (!decision) {
    return ["- (none)"];
  }
  const compactSkillMatchLines = decision.skillMatchReasons.length > 0 ? decision.skillMatchReasons.map((reason) => {
    const flags = [
      reason.exactIdMatch ? "exact" : null,
      reason.substringMatch ? "substr" : null,
      reason.overlapTokens.length > 0 ? `tokens=${reason.overlapTokens.join("|")}` : null
    ].filter((flag) => Boolean(flag)).join(", ");
    return `  - ${reason.requestedSkill} -> ${reason.matchedSkillId} [score=${reason.score}${flags ? `; ${flags}` : ""}]`;
  }) : ["  - (none)"];
  const compactTopN = [
    ["stageHints", decision.semanticFeatureTopN.stageHints],
    ["actionHints", decision.semanticFeatureTopN.actionHints],
    ["interactionHints", decision.semanticFeatureTopN.interactionHints],
    ["researchPolicyHints", decision.semanticFeatureTopN.researchPolicyHints],
    ["delegationHints", decision.semanticFeatureTopN.delegationHints],
    ["constraintHints", decision.semanticFeatureTopN.constraintHints]
  ].map(([label, items]) => {
    const rendered = items.map((item) => `${item.value}@${item.score}<-${item.provenanceSkillIds.join("|")}`).join(", ");
    return rendered ? `  - ${label}: ${rendered}` : null;
  }).filter((line) => Boolean(line));
  return [
    `- Source: ${decision.source}`,
    `- Stage: ${decision.stage ?? "(none)"}`,
    `- Action: ${decision.action ?? "(none)"}`,
    `- Interaction Mode: ${decision.interactionMode}`,
    `- Skill Availability Mode: ${decision.skillAvailabilityMode}`,
    `- Available Skills: ${decision.availableSkills.join(", ") || "(none)"}`,
    `- Skill Paths: ${decision.skillPaths.join(", ") || "(none)"}`,
    `- Matched Available Skills: ${decision.matchedAvailableSkills.join(", ") || "(none)"}`,
    `- Missing Skills: ${decision.missingSkills.join(", ") || "(none)"}`,
    "- Skill Match Reasons:",
    ...compactSkillMatchLines,
    `- Semantic Skill Features: ${formatSemanticSkillFeaturesCompact(decision.semanticSkillFeatures)}`,
    "- Semantic Feature Top-N:",
    ...compactTopN.length > 0 ? compactTopN : ["  - (none)"],
    `- Research Policy: ${decision.researchPolicy}`,
    `- Delegation Preference: ${decision.delegationPreference}`,
    `- Provider Recommended Skill Chain: ${decision.providerRecommendedSkillChain.join(", ") || "(none)"}`,
    `- Provider Recommended Subagent Roles: ${decision.providerRecommendedSubagentRoles.join(", ") || "(none)"}`,
    "- Provider Recommendation Items (Skills):",
    ...decision.providerRecommendationItems.skills.length > 0 ? decision.providerRecommendationItems.skills.map(
      (item) => `  - ${item.value} [source=${item.source}; confidence=${item.confidence}; consumed=${item.consumed ? "yes" : "no"}; reason=${item.reason}; filteredBecause=${item.filteredBecause.join("|") || "(none)"}]`
    ) : ["  - (none)"],
    "- Provider Recommendation Items (Subagent Roles):",
    ...decision.providerRecommendationItems.subagentRoles.length > 0 ? decision.providerRecommendationItems.subagentRoles.map(
      (item) => `  - ${item.value} [source=${item.source}; confidence=${item.confidence}; consumed=${item.consumed ? "yes" : "no"}; reason=${item.reason}; filteredBecause=${item.filteredBecause.join("|") || "(none)"}]`
    ) : ["  - (none)"],
    `- Skill Chain: ${decision.skillChain.join(", ") || "(none)"}`,
    `- Subagent Roles: ${decision.subagentRoles.join(", ") || "(none)"}`,
    `- Governance Constraints: ${decision.governanceConstraints.join(", ") || "(none)"}`,
    `- Blocked By Governance: ${decision.blockedByGovernance.join(", ") || "(none)"}`,
    `- Advisory Only: ${decision.advisoryOnly ? "yes" : "no"}`
  ];
}
function buildJourneyContractHintLines(hints) {
  if (hints.length === 0) {
    return ["- (none)"];
  }
  return hints.flatMap((hint) => [
    `- ${hint.signal}: ${hint.recommendation}`,
    `  - Count: ${hint.count}`,
    `  - Affected stages: ${hint.affected_stages.join(", ") || "(none)"}`,
    `  - Stories: ${hint.epic_stories.join(", ") || "(none)"}`
  ]);
}
function resolveDeferredGapContext(input) {
  if (Array.isArray(input.deferredGaps) && input.deferredGaps.length > 0) {
    return {
      sourceReportPath: null,
      gaps: input.deferredGaps,
      explicit: input.deferredGapsExplicit ?? true,
      count: input.deferredGapCount ?? input.deferredGaps.length
    };
  }
  const candidateReportPath = input.outputPath.replace(
    /implementation-readiness-remediation-/i,
    "implementation-readiness-report-"
  );
  if (fs2.existsSync(candidateReportPath)) {
    const report = readDeferredGapsFromReport(candidateReportPath);
    return {
      sourceReportPath: report.report_path,
      gaps: report.gaps,
      explicit: report.explicit,
      count: report.gaps.length
    };
  }
  return {
    sourceReportPath: null,
    gaps: [],
    explicit: input.deferredGapsExplicit ?? false,
    count: input.deferredGapCount ?? 0
  };
}
function buildStructuredDeferredGapLines(input) {
  const lines = [
    `- Source report: ${input.sourceReportPath ?? "(none)"}`,
    `- Previous report: ${input.previousReportPath ?? "(none)"}`,
    `- Deferred gap count: ${input.count}`,
    `- Deferred gaps explicit: ${yesNo(input.explicit)}`,
    "",
    "```yaml",
    "deferred_gaps:"
  ];
  if (input.gaps.length === 0) {
    lines.push("  []");
    lines.push("```");
    return lines;
  }
  for (const gap of input.gaps) {
    const journeyRefs = Array.isArray(gap.journey_refs) ? gap.journey_refs.map((value) => normalizeText2(value)).filter(Boolean) : [];
    const prodPathRefs = Array.isArray(gap.prod_path_refs) ? gap.prod_path_refs.map((value) => normalizeText2(value)).filter(Boolean) : [];
    const smokeTestRefs = Array.isArray(gap.smoke_test_refs) ? gap.smoke_test_refs.map((value) => normalizeText2(value)).filter(Boolean) : [];
    const fullE2ERefs = Array.isArray(gap.full_e2e_refs) ? gap.full_e2e_refs.map((value) => normalizeText2(value)).filter(Boolean) : [];
    const closureNoteRefs = Array.isArray(gap.closure_note_refs) ? gap.closure_note_refs.map((value) => normalizeText2(value)).filter(Boolean) : [];
    lines.push(`  - gap_id: ${normalizeText2(gap.gap_id) || "(missing)"}`);
    lines.push(`    status: ${normalizeText2(gap.status) || "deferred"}`);
    lines.push(`    reason: ${normalizeText2(gap.reason) || "(none)"}`);
    lines.push(`    resolution_target: ${normalizeText2(gap.resolution_target) || "(none)"}`);
    lines.push(`    owner: ${normalizeText2(gap.owner) || "(missing)"}`);
    lines.push(`    current_risk: ${normalizeText2(gap.current_risk) || "(none)"}`);
    if (journeyRefs.length > 0) lines.push(`    journey_refs: [${journeyRefs.join(", ")}]`);
    if (prodPathRefs.length > 0) lines.push(`    prod_path_refs: [${prodPathRefs.join(", ")}]`);
    if (smokeTestRefs.length > 0) lines.push(`    smoke_test_refs: [${smokeTestRefs.join(", ")}]`);
    if (fullE2ERefs.length > 0) lines.push(`    full_e2e_refs: [${fullE2ERefs.join(", ")}]`);
    if (closureNoteRefs.length > 0) lines.push(`    closure_note_refs: [${closureNoteRefs.join(", ")}]`);
  }
  lines.push("```");
  return lines;
}
function defaultExecutorRouting(hints) {
  if (hints.length > 0) {
    return {
      routingMode: "targeted",
      executorRoute: "journey-contract-remediation",
      prioritizedSignals: hints.map((hint) => hint.signal).sort(),
      packetStrategy: "journey-contract-remediation-packet",
      reason: "journey contract hints detected; use targeted remediation routing before generic blocker cleanup"
    };
  }
  return {
    routingMode: "generic",
    executorRoute: "default-gate-remediation",
    prioritizedSignals: [],
    packetStrategy: "default-remediation-packet",
    reason: "no journey contract hints detected; use the default gate remediation route"
  };
}
function buildExecutorRoutingLines(executorRouting) {
  return [
    `- Routing Mode: ${executorRouting.routingMode}`,
    `- Executor Route: ${executorRouting.executorRoute}`,
    `- Packet Strategy: ${executorRouting.packetStrategy ?? "(none)"}`,
    `- Prioritized Signals: ${executorRouting.prioritizedSignals.join(", ") || "(none)"}`,
    `- Routing Reason: ${executorRouting.reason ?? "(none)"}`
  ];
}
function buildRemediationAuditTraceSummaryLines(stopReason, journeyContractHints, executorRouting) {
  return [
    `Routing Mode: ${executorRouting.routingMode}`,
    `Executor Route: ${executorRouting.executorRoute}`,
    `Stop Reason: ${stopReason ?? "(none)"}`,
    `Journey Contract Signals: ${journeyContractHints.map((hint) => hint.signal).join(", ") || "(none)"}`
  ];
}
function buildGovernanceRemediationArtifact(input) {
  const promptHintUsage = resolvePromptHintUsageFromText({
    projectRoot: input.projectRoot,
    promptText: input.promptText,
    stageContextKnown: input.stageContextKnown,
    gateFailure: {
      exists: input.gateFailureExists,
      blockerOwnershipLocked: input.blockerOwnershipLocked
    },
    artifactState: {
      rootTargetLocked: input.rootTargetLocked,
      equivalentAdapterCount: input.equivalentAdapterCount
    },
    modelHintsCandidate: input.modelHintsCandidate,
    availableSkills: input.availableSkills,
    skillPaths: input.skillPaths,
    skillInventory: input.skillInventory
  });
  const executionIntentCandidate = promptHintUsage.executionIntentCandidate;
  const executionPlanDecision = promptHintUsage.executionPlanDecision;
  const journeyContractHints = input.journeyContractHints ?? [];
  const executorRouting = input.executorRouting ?? defaultExecutorRouting(journeyContractHints);
  const deferredGapContext = resolveDeferredGapContext(input);
  const remediationAuditTraceSummaryLines = buildRemediationAuditTraceSummaryLines(
    input.stopReason,
    journeyContractHints,
    executorRouting
  );
  const markdown = [
    "# Remediation Attempt",
    "",
    "## PM Routing Resolution",
    "",
    "- Resolution order: `stage context -> gate failure -> artifact state -> PromptRoutingHints`",
    `- Stage context known: ${yesNo(input.stageContextKnown)}`,
    `- Gate failure exists: ${yesNo(input.gateFailureExists)}`,
    `- Blocker ownership locked: ${yesNo(input.blockerOwnershipLocked)}`,
    `- Root target locked: ${yesNo(input.rootTargetLocked)}`,
    `- Equivalent adapter count: ${input.equivalentAdapterCount}`,
    `- Prompt hints confidence: ${promptHintUsage.hintConfidence}`,
    "",
    "## Core Fields",
    "",
    `- Attempt ID: ${input.attemptId}`,
    `- Source GateFailure IDs: ${input.sourceGateFailureIds.join(", ") || "(none)"}`,
    `- Capability Slot: ${input.capabilitySlot}`,
    `- Canonical Agent: ${input.canonicalAgent}`,
    `- Actual Executor: ${input.actualExecutor}`,
    `- Adapter Path: ${input.adapterPath}`,
    "- Target Artifact(s):",
    bulletList(input.targetArtifacts),
    `- Expected Delta: ${input.expectedDelta}`,
    `- Rerun Owner: ${input.rerunOwner}`,
    `- Rerun Gate: ${input.rerunGate}`,
    `- Outcome: ${input.outcome}`,
    "",
    "## Prompt Hint Usage",
    "",
    ...buildPromptHintUsageLines(promptHintUsage),
    "",
    "## Model Hint Debug",
    "",
    ...buildModelHintUsageLines(promptHintUsage),
    "",
    "## Execution Intent Candidate",
    "",
    ...buildExecutionIntentCandidateLines(executionIntentCandidate),
    "",
    "## Execution Plan Decision",
    "",
    ...buildExecutionPlanDecisionLines(executionPlanDecision),
    "",
    "## Executor Routing Trace",
    "",
    ...buildExecutorRoutingLines(executorRouting),
    "",
    "## Remediation Audit Trace Summary",
    "",
    ...remediationAuditTraceSummaryLines,
    "",
    "## Journey Contract Remediation Hints",
    "",
    ...buildJourneyContractHintLines(journeyContractHints),
    "",
    "## Structured Deferred Gaps",
    "",
    ...buildStructuredDeferredGapLines({
      sourceReportPath: deferredGapContext.sourceReportPath,
      previousReportPath: input.previousReportPath,
      gaps: deferredGapContext.gaps,
      explicit: deferredGapContext.explicit,
      count: deferredGapContext.count
    }),
    "",
    "## Evidence Delta",
    "",
    "- Shared artifacts updated:",
    bulletList(input.sharedArtifactsUpdated ?? []),
    `- Contradictions opened/closed: ${input.contradictionsDelta ?? "(none)"}`,
    `- External proof added: ${input.externalProofAdded ?? "(none)"}`,
    "",
    "## Next Action",
    "",
    `- Ready to rerun gate: ${yesNo(input.readyToRerunGate ?? false)}`,
    `- If no, stop reason: ${input.stopReason ?? "(none)"}`,
    ""
  ].join("\n");
  return {
    markdown,
    promptHintUsage,
    executionIntentCandidate,
    executionPlanDecision,
    journeyContractHints
  };
}
function writeGovernanceRemediationArtifact(input) {
  const result = buildGovernanceRemediationArtifact(input);
  const absoluteOutputPath = path2.isAbsolute(input.outputPath) ? input.outputPath : path2.join(input.projectRoot, input.outputPath);
  fs2.mkdirSync(path2.dirname(absoluteOutputPath), { recursive: true });
  fs2.writeFileSync(absoluteOutputPath, result.markdown, "utf8");
  return result;
}
function parseBooleanFlag(value, flagName) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Invalid ${flagName}: expected true|false`);
}
function parseList(value) {
  if (!value) {
    return [];
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
function argValue(args, flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : void 0;
}
function main() {
  const argvTokens = process.argv.map((value) => path2.basename(String(value)).toLowerCase());
  const isDirectArtifactCli = argvTokens.some((value) => value.includes("governance-remediation-artifact"));
  if (process.env.BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS === "1") {
    return;
  }
  if (require.main !== module || !isDirectArtifactCli) {
    return;
  }
  const args = process.argv.slice(2);
  const outputPath = argValue(args, "--outputPath");
  if (!outputPath) {
    throw new Error(
      "Usage: npx ts-node --transpile-only scripts/governance-remediation-artifact.ts --outputPath <path> --attemptId <id> --capabilitySlot <slot> --canonicalAgent <agent> --actualExecutor <executor> --adapterPath <path> --expectedDelta <text> --rerunOwner <owner> --rerunGate <gate> --outcome <text> --stageContextKnown true|false --gateFailureExists true|false --blockerOwnershipLocked true|false --rootTargetLocked true|false --equivalentAdapterCount <n> [--promptText <text>] [--sourceGateFailureIds a,b] [--targetArtifacts a,b]"
    );
  }
  const projectRoot = process.cwd();
  writeGovernanceRemediationArtifact({
    projectRoot,
    outputPath,
    promptText: argValue(args, "--promptText"),
    stageContextKnown: parseBooleanFlag(argValue(args, "--stageContextKnown"), "--stageContextKnown"),
    gateFailureExists: parseBooleanFlag(argValue(args, "--gateFailureExists"), "--gateFailureExists"),
    blockerOwnershipLocked: parseBooleanFlag(
      argValue(args, "--blockerOwnershipLocked"),
      "--blockerOwnershipLocked"
    ),
    rootTargetLocked: parseBooleanFlag(argValue(args, "--rootTargetLocked"), "--rootTargetLocked"),
    equivalentAdapterCount: Number(argValue(args, "--equivalentAdapterCount") ?? "0"),
    attemptId: argValue(args, "--attemptId") ?? "attempt-unknown",
    sourceGateFailureIds: parseList(argValue(args, "--sourceGateFailureIds")),
    capabilitySlot: argValue(args, "--capabilitySlot") ?? "unknown-slot",
    canonicalAgent: argValue(args, "--canonicalAgent") ?? "unknown-agent",
    actualExecutor: argValue(args, "--actualExecutor") ?? "unknown-executor",
    adapterPath: argValue(args, "--adapterPath") ?? "unknown-adapter",
    targetArtifacts: parseList(argValue(args, "--targetArtifacts")),
    expectedDelta: argValue(args, "--expectedDelta") ?? "n/a",
    rerunOwner: argValue(args, "--rerunOwner") ?? "PM",
    rerunGate: argValue(args, "--rerunGate") ?? "n/a",
    outcome: argValue(args, "--outcome") ?? "n/a",
    sharedArtifactsUpdated: parseList(argValue(args, "--sharedArtifactsUpdated")),
    contradictionsDelta: argValue(args, "--contradictionsDelta"),
    externalProofAdded: argValue(args, "--externalProofAdded"),
    readyToRerunGate: argValue(args, "--readyToRerunGate") ? parseBooleanFlag(argValue(args, "--readyToRerunGate"), "--readyToRerunGate") : void 0,
    stopReason: argValue(args, "--stopReason")
  });
}
main();

// ../../scripts/model-governance-hint-resolver.ts
async function resolveModelGovernanceHintCandidate(input, provider) {
  const candidate = await Promise.resolve(provider.resolve(input));
  if (!candidate) {
    return null;
  }
  assertValidModelGovernanceHintCandidate(candidate);
  if (candidate.providerId !== provider.id) {
    throw new Error(
      `Model governance provider mismatch: candidate=${candidate.providerId}, provider=${provider.id}`
    );
  }
  if (candidate.providerMode !== provider.mode) {
    throw new Error(
      `Model governance provider mode mismatch: candidate=${candidate.providerMode}, provider=${provider.mode}`
    );
  }
  return candidate;
}
function createStubModelGovernanceHintProvider(candidate, id = "stub-model-governance-provider") {
  return {
    id,
    mode: "stub",
    resolve() {
      if (!candidate) {
        return null;
      }
      return {
        ...candidate,
        providerId: id,
        providerMode: "stub"
      };
    }
  };
}

// ../../scripts/skill-inventory-provider.ts
var fs3 = __toESM(require("node:fs"));
var os = __toESM(require("node:os"));
var path3 = __toESM(require("node:path"));
function unique3(values) {
  return [...new Set(values)];
}
function normalizeSkillId2(value) {
  return value.trim().toLowerCase();
}
function normalizeSkillPath2(value) {
  return value.replace(/\\/g, "/").trim();
}
function rootExists(rootPath) {
  return rootPath.trim() !== "" && fs3.existsSync(rootPath) && fs3.statSync(rootPath).isDirectory();
}
function hostSkillDir(projectRoot, hostKind) {
  switch (hostKind) {
    case "cursor":
      return path3.join(projectRoot, ".cursor", "skills");
    case "claude":
      return path3.join(projectRoot, ".claude", "skills");
    case "codex":
      return path3.join(projectRoot, ".codex", "skills");
    case "generic":
    default:
      return null;
  }
}
function globalHostSkillDir(homeDir, hostKind) {
  switch (hostKind) {
    case "cursor":
      return path3.join(homeDir, ".cursor", "skills");
    case "claude":
      return path3.join(homeDir, ".claude", "skills");
    case "codex":
      return path3.join(homeDir, ".codex", "skills");
    case "generic":
    default:
      return null;
  }
}
function candidateRoots(input) {
  const homeDir = input.homeDir ?? os.homedir();
  const roots = [];
  const projectHostRoot = hostSkillDir(input.projectRoot, input.hostKind);
  const globalHostRoot = globalHostSkillDir(homeDir, input.hostKind);
  if (projectHostRoot) {
    roots.push({
      rootPath: projectHostRoot,
      source: "project-host",
      priority: 100
    });
  }
  roots.push({
    rootPath: path3.join(input.projectRoot, ".agents", "skills"),
    source: "project-agents",
    priority: 90
  });
  roots.push({
    rootPath: path3.join(input.projectRoot, "skills"),
    source: "project-workspace",
    priority: 80
  });
  if (globalHostRoot) {
    roots.push({
      rootPath: globalHostRoot,
      source: "global-host",
      priority: 70
    });
  }
  roots.push({
    rootPath: path3.join(homeDir, ".agents", "skills"),
    source: "global-agents",
    priority: 60
  });
  return roots.filter((root) => rootExists(root.rootPath));
}
function hasSkillMarkdown(dirPath) {
  try {
    return fs3.readdirSync(dirPath).some((entry) => /^SKILL(\.[^.]+)?\.md$/iu.test(entry));
  } catch {
    return false;
  }
}
function resolveSkillMarkdownPath(dirPath) {
  try {
    const fileName = fs3.readdirSync(dirPath).find((entry) => /^SKILL(\.[^.]+)?\.md$/iu.test(entry));
    return fileName ? path3.join(dirPath, fileName) : null;
  } catch {
    return null;
  }
}
function parseFrontmatterBlock(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match) {
    return {};
  }
  const metadata = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const parsed = line.match(/^([A-Za-z0-9_-]+):\s*(.+?)\s*$/u);
    if (!parsed) {
      continue;
    }
    const key = parsed[1].trim().toLowerCase();
    const value = parsed[2].trim().replace(/^['"]|['"]$/g, "");
    if (value !== "") {
      metadata[key] = value;
    }
  }
  return metadata;
}
function compactWhitespace(value) {
  return value.replace(/\s+/gu, " ").trim();
}
function firstMarkdownHeading(markdown) {
  const match = markdown.match(/^#\s+(.+?)\s*$/mu);
  return match ? compactWhitespace(match[1]) : void 0;
}
function firstMeaningfulParagraph(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const paragraphs = [];
  let current = [];
  let inFrontmatter = false;
  let frontmatterClosed = false;
  let inCodeFence = false;
  const flush = () => {
    const text = compactWhitespace(current.join(" "));
    if (text !== "") {
      paragraphs.push(text);
    }
    current = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!frontmatterClosed && line === "---") {
      inFrontmatter = !inFrontmatter;
      if (!inFrontmatter) {
        frontmatterClosed = true;
      }
      flush();
      continue;
    }
    if (inFrontmatter) {
      continue;
    }
    if (/^```/.test(line)) {
      inCodeFence = !inCodeFence;
      flush();
      continue;
    }
    if (inCodeFence) {
      continue;
    }
    if (line === "") {
      flush();
      continue;
    }
    if (/^#/.test(line) || /^```/.test(line) || /^[-*]\s/.test(line) || /^\d+\.\s/.test(line)) {
      flush();
      continue;
    }
    if (/^[A-Za-z0-9_-]+:\s+.+$/u.test(line) && paragraphs.length === 0 && current.length === 0) {
      continue;
    }
    current.push(line);
  }
  flush();
  return paragraphs[0];
}
function readSkillMetadata(skillMarkdownPath) {
  try {
    const markdown = fs3.readFileSync(skillMarkdownPath, "utf8");
    const frontmatter = parseFrontmatterBlock(markdown);
    const title = frontmatter.name || frontmatter.title || firstMarkdownHeading(markdown);
    const description = frontmatter.description || frontmatter.summary;
    const summary = firstMeaningfulParagraph(markdown);
    return {
      ...title ? { title } : {},
      ...description ? { description } : {},
      ...summary ? { summary } : {}
    };
  } catch {
    return {};
  }
}
function collectSkillEntries(root) {
  return fs3.readdirSync(root.rootPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => {
    const skillDir = path3.join(root.rootPath, entry.name);
    const skillMarkdownPath = resolveSkillMarkdownPath(skillDir);
    if (!skillMarkdownPath || !hasSkillMarkdown(skillDir)) {
      return null;
    }
    return {
      skillId: normalizeSkillId2(entry.name),
      path: skillMarkdownPath,
      source: root.source,
      priority: root.priority,
      ...readSkillMetadata(skillMarkdownPath)
    };
  }).filter((entry) => entry !== null);
}
function resolveGovernanceSkillInventory(input) {
  const entries = candidateRoots(input).flatMap((root) => collectSkillEntries(root)).sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }
    return left.skillId.localeCompare(right.skillId);
  });
  const dedupedBySkillId = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    if (!dedupedBySkillId.has(entry.skillId)) {
      dedupedBySkillId.set(entry.skillId, entry);
    }
  }
  const skillInventory = [...dedupedBySkillId.values()];
  return {
    availableSkills: unique3(skillInventory.map((entry) => entry.skillId)),
    skillPaths: unique3(
      skillInventory.map((entry) => entry.path ? normalizeSkillPath2(entry.path) : "").filter(Boolean)
    ),
    skillInventory: skillInventory.map((entry) => ({
      ...entry,
      path: entry.path ? normalizeSkillPath2(entry.path) : entry.path
    }))
  };
}

// ../../scripts/governance-provider-adapter.ts
function defaultHttpJsonRequestBuilder(input) {
  const resolvedSkillInventory = input.projectRoot && input.hostKind && !(input.availableSkills?.length || input.skillPaths?.length || input.skillInventory?.length) ? resolveGovernanceSkillInventory({
    projectRoot: input.projectRoot,
    hostKind: input.hostKind
  }) : null;
  const promptRoutingPreview = resolvePromptHintUsageFromText({
    projectRoot: input.projectRoot ?? process.cwd(),
    promptText: input.promptText,
    stageContextKnown: input.stageContextKnown,
    gateFailure: {
      exists: input.gateFailureExists,
      blockerOwnershipLocked: input.blockerOwnershipLocked
    },
    artifactState: {
      rootTargetLocked: input.rootTargetLocked,
      equivalentAdapterCount: input.equivalentAdapterCount
    },
    availableSkills: input.availableSkills ?? resolvedSkillInventory?.availableSkills,
    skillPaths: input.skillPaths ?? resolvedSkillInventory?.skillPaths,
    skillInventory: input.skillInventory ?? resolvedSkillInventory?.skillInventory
  });
  return {
    promptText: input.promptText,
    routingContext: {
      stageContextKnown: input.stageContextKnown,
      gateFailureExists: input.gateFailureExists,
      blockerOwnershipLocked: input.blockerOwnershipLocked,
      rootTargetLocked: input.rootTargetLocked,
      equivalentAdapterCount: input.equivalentAdapterCount,
      capabilitySlot: input.capabilitySlot,
      canonicalAgent: input.canonicalAgent,
      actualExecutor: input.actualExecutor,
      targetArtifacts: input.targetArtifacts,
      availableSkills: input.availableSkills ?? resolvedSkillInventory?.availableSkills ?? [],
      skillPaths: input.skillPaths ?? resolvedSkillInventory?.skillPaths ?? [],
      skillInventory: input.skillInventory ?? resolvedSkillInventory?.skillInventory ?? []
    },
    promptRoutingPreview: {
      executionIntentCandidate: promptRoutingPreview.executionIntentCandidate,
      executionPlanDecision: promptRoutingPreview.executionPlanDecision,
      semanticSkillFeatures: promptRoutingPreview.executionPlanDecision?.semanticSkillFeatures ?? promptRoutingPreview.executionIntentCandidate?.semanticSkillFeatures ?? [],
      semanticFeatureTopN: promptRoutingPreview.executionPlanDecision?.semanticFeatureTopN ?? promptRoutingPreview.executionIntentCandidate?.semanticFeatureTopN ?? {
        stageHints: [],
        actionHints: [],
        interactionHints: [],
        researchPolicyHints: [],
        delegationHints: [],
        constraintHints: []
      }
    }
  };
}
function normalizeOpenAICompatibleBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}
function normalizeAnthropicCompatibleBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}
function extractJsonObjectFromText(text) {
  const trimmed = text.trim();
  if (trimmed === "") {
    throw new Error("Empty provider response content");
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Provider response did not contain a valid JSON object");
  }
}
function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string" && item.trim() !== "");
}
function normalizeRecommendationItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return null;
    }
    const record = item;
    const candidateValue = typeof record.value === "string" ? record.value.trim() : typeof record.skillId === "string" ? record.skillId.trim() : typeof record.role === "string" ? record.role.trim() : "";
    const reason = typeof record.reason === "string" ? record.reason.trim() : "";
    const confidence = record.confidence === "low" || record.confidence === "medium" || record.confidence === "high" ? record.confidence : "medium";
    if (!candidateValue || !reason) {
      return null;
    }
    return {
      value: candidateValue,
      reason,
      confidence
    };
  }).filter((item) => Boolean(item));
}
function toModelGovernanceHintCandidate(payload, adapterId, protocol) {
  const candidate = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const nested = candidate.hint && typeof candidate.hint === "object" && !Array.isArray(candidate.hint) ? candidate.hint : candidate.candidate && typeof candidate.candidate === "object" && !Array.isArray(candidate.candidate) ? candidate.candidate : candidate;
  const confidence = nested.confidence;
  const researchPolicy = nested.researchPolicy;
  const delegationPreference = nested.delegationPreference;
  const recommendedSkillItems = normalizeRecommendationItems(nested.recommendedSkillItems);
  const recommendedSubagentRoleItems = normalizeRecommendationItems(
    nested.recommendedSubagentRoleItems
  );
  const recommendedSkillChain = normalizeStringArray(nested.recommendedSkillChain);
  const recommendedSubagentRoles = normalizeStringArray(nested.recommendedSubagentRoles);
  return {
    source: "model-provider",
    providerId: adapterId,
    providerMode: protocol,
    confidence: confidence === "low" || confidence === "medium" || confidence === "high" ? confidence : "low",
    ...typeof nested.suggestedStage === "string" ? { suggestedStage: nested.suggestedStage } : {},
    ...typeof nested.suggestedAction === "string" ? { suggestedAction: nested.suggestedAction } : {},
    ...typeof nested.suggestedArtifactTarget === "string" ? { suggestedArtifactTarget: nested.suggestedArtifactTarget } : {},
    explicitRolePreference: normalizeStringArray(nested.explicitRolePreference),
    recommendedSkillChain: recommendedSkillChain.length > 0 ? recommendedSkillChain : recommendedSkillItems.map((item) => item.value),
    recommendedSubagentRoles: recommendedSubagentRoles.length > 0 ? recommendedSubagentRoles : recommendedSubagentRoleItems.map((item) => item.value),
    ...recommendedSkillItems.length > 0 ? { recommendedSkillItems } : {},
    ...recommendedSubagentRoleItems.length > 0 ? { recommendedSubagentRoleItems } : {},
    researchPolicy: researchPolicy === "allowed" || researchPolicy === "forbidden" || researchPolicy === "preferred" ? researchPolicy : "allowed",
    delegationPreference: delegationPreference === "decide-for-me" || delegationPreference === "ask-me-first" ? delegationPreference : "ask-me-first",
    constraints: normalizeStringArray(nested.constraints),
    rationale: typeof nested.rationale === "string" && nested.rationale.trim() !== "" ? nested.rationale : "Governance provider response",
    overrideAllowed: false,
    ...nested.forbiddenOverrides && typeof nested.forbiddenOverrides === "object" && !Array.isArray(nested.forbiddenOverrides) ? {
      forbiddenOverrides: nested.forbiddenOverrides
    } : {}
  };
}
async function postJson(endpoint, body, headers, timeoutMs, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Governance provider request failed: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
function defaultOpenAICompatibleSystemPrompt() {
  return [
    "You are a governance hint synthesizer.",
    "Return JSON only.",
    "The input contains an explicit semanticSkillFeatures field describing skill-derived stage/action/interaction/research/delegation/constraint signals.",
    "Treat semanticSkillFeatures as first-class structured routing evidence, not as incidental prose.",
    "You may suggest stage/action/artifact/role/research/delegation/constraints.",
    "You must not assert authority over blocker ownership, failed-check severity, or artifact-derived root target."
  ].join(" ");
}
function defaultAnthropicCompatibleSystemPrompt() {
  return [
    "You are a governance hint synthesizer.",
    "Return JSON only.",
    "The input contains an explicit semanticSkillFeatures field describing skill-derived stage/action/interaction/research/delegation/constraint signals.",
    "Treat semanticSkillFeatures as first-class structured routing evidence, not as incidental prose.",
    "You may suggest stage/action/artifact/role/research/delegation/constraints.",
    "You must not assert authority over blocker ownership, failed-check severity, or artifact-derived root target."
  ].join(" ");
}
function parseOpenAICompatibleResponse(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("OpenAI-compatible provider returned a non-object payload");
  }
  const doc = payload;
  if (typeof doc.output_text === "string" && doc.output_text.trim() !== "") {
    return extractJsonObjectFromText(doc.output_text);
  }
  const choices = doc.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0];
    const message = first.message && typeof first.message === "object" ? first.message : null;
    const content = message?.content;
    if (typeof content === "string") {
      return extractJsonObjectFromText(content);
    }
    if (Array.isArray(content)) {
      const text = content.map(
        (item) => item && typeof item === "object" && typeof item.text === "string" ? item.text : ""
      ).join("\n");
      return extractJsonObjectFromText(text);
    }
  }
  throw new Error("OpenAI-compatible provider response missing choices[0].message.content or output_text");
}
function parseAnthropicCompatibleResponse(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Anthropic-compatible provider returned a non-object payload");
  }
  const doc = payload;
  const content = doc.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error("Anthropic-compatible provider response missing content blocks");
  }
  const text = content.map(
    (item) => item && typeof item === "object" && typeof item.text === "string" ? item.text : ""
  ).join("\n");
  return extractJsonObjectFromText(text);
}
function createStubGovernanceProviderAdapter(candidate, id = "stub-governance-provider-adapter") {
  const provider = createStubModelGovernanceHintProvider(candidate, id);
  return {
    id,
    protocol: "stub",
    displayName: "Stub Governance Provider Adapter",
    resolveModelHints(input) {
      return provider.resolve(input);
    }
  };
}
function createHttpJsonGovernanceProviderAdapter(config) {
  return {
    id: config.id,
    protocol: "http-json",
    displayName: config.displayName ?? "HTTP JSON Governance Provider Adapter",
    async resolveModelHints(input) {
      const response = await postJson(
        config.endpoint,
        (config.requestBuilder ?? defaultHttpJsonRequestBuilder)(input),
        config.headers ?? {},
        config.timeoutMs ?? 3e4,
        config.method ?? "POST"
      );
      const parsed = config.responseParser ? config.responseParser(response, input) : response;
      return toModelGovernanceHintCandidate(parsed, config.id, "http-json");
    }
  };
}
function createOpenAICompatibleGovernanceProviderAdapter(config) {
  const endpoint = `${normalizeOpenAICompatibleBaseUrl(config.baseUrl)}/chat/completions`;
  return {
    id: config.id,
    protocol: "openai-compatible",
    displayName: config.displayName ?? "OpenAI-Compatible Governance Provider Adapter",
    async resolveModelHints(input) {
      const body = {
        model: config.model,
        temperature: 0,
        response_format: {
          type: "json_object"
        },
        messages: [
          {
            role: "system",
            content: config.systemPrompt ?? defaultOpenAICompatibleSystemPrompt()
          },
          {
            role: "user",
            content: JSON.stringify(defaultHttpJsonRequestBuilder(input))
          }
        ]
      };
      const response = await postJson(
        endpoint,
        body,
        {
          ...config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {},
          ...config.headers ?? {}
        },
        config.timeoutMs ?? 3e4,
        "POST"
      );
      const parsed = parseOpenAICompatibleResponse(response);
      return toModelGovernanceHintCandidate(parsed, config.id, "openai-compatible");
    }
  };
}
function createAnthropicCompatibleGovernanceProviderAdapter(config) {
  const endpoint = `${normalizeAnthropicCompatibleBaseUrl(config.baseUrl)}/messages`;
  return {
    id: config.id,
    protocol: "anthropic-http",
    displayName: config.displayName ?? "Anthropic-Compatible Governance Provider Adapter",
    async resolveModelHints(input) {
      const body = {
        model: config.model,
        max_tokens: config.maxTokens ?? 512,
        system: config.systemPrompt ?? defaultAnthropicCompatibleSystemPrompt(),
        messages: [
          {
            role: "user",
            content: JSON.stringify(defaultHttpJsonRequestBuilder(input))
          }
        ]
      };
      const response = await postJson(
        endpoint,
        body,
        {
          ...config.apiKey ? { "x-api-key": config.apiKey } : {},
          "anthropic-version": config.anthropicVersion ?? "2023-06-01",
          ...config.headers ?? {}
        },
        config.timeoutMs ?? 3e4,
        "POST"
      );
      const parsed = parseAnthropicCompatibleResponse(response);
      return toModelGovernanceHintCandidate(parsed, config.id, "anthropic-http");
    }
  };
}
async function resolveModelHintsViaGovernanceProvider(input, adapter) {
  return resolveModelGovernanceHintCandidate(input, {
    id: adapter.id,
    mode: adapter.protocol,
    resolve: (payload) => adapter.resolveModelHints({ ...input, ...payload })
  });
}

// ../../scripts/runtime-context.ts
var fs5 = __toESM(require("node:fs"));
var path5 = __toESM(require("node:path"));

// ../../scripts/runtime-context-registry.ts
var fs4 = __toESM(require("node:fs"));
var path4 = __toESM(require("node:path"));
function runtimeContextRegistryPath(root) {
  return path4.join(root, "_bmad-output", "runtime", "registry.json");
}
function readRuntimeContextRegistry(root) {
  const file = runtimeContextRegistryPath(root);
  const raw = fs4.readFileSync(file, "utf8");
  return JSON.parse(raw);
}

// ../../scripts/runtime-context.ts
var RUNTIME_CONTEXT_VERSION = 1;
var RUNTIME_FLOWS = ["story", "bugfix", "standalone_tasks", "epic", "unknown"];
var STAGE_NAMES = [
  "prd",
  "arch",
  "epics",
  "story_create",
  "story_audit",
  "specify",
  "plan",
  "gaps",
  "tasks",
  "implement",
  "post_audit",
  "epic_create",
  "epic_complete"
];
function isRuntimeFlowId(v) {
  return RUNTIME_FLOWS.includes(v);
}
function isStageName(v) {
  return STAGE_NAMES.includes(v);
}
function projectContextPath(root) {
  return path5.join(root, "_bmad-output", "runtime", "context", "project.json");
}
function resolveRuntimeContextPath(root, explicitPath) {
  const candidate = explicitPath?.trim();
  if (candidate) {
    return path5.isAbsolute(candidate) ? candidate : path5.resolve(root, candidate);
  }
  return projectContextPath(root);
}
function readRuntimeContext(root, explicitPath) {
  const file = resolveRuntimeContextPath(root, explicitPath);
  let raw;
  try {
    raw = fs5.readFileSync(file, "utf8");
  } catch (e) {
    const err = e;
    if (err.code === "ENOENT") {
      throw new Error(`runtime-context missing: ${file}`);
    }
    throw e;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`runtime-context invalid JSON: ${file}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`runtime-context not an object: ${file}`);
  }
  const o = parsed;
  if (o.version !== RUNTIME_CONTEXT_VERSION) {
    throw new Error(
      `runtime-context.version must be ${RUNTIME_CONTEXT_VERSION}, got ${String(o.version)}`
    );
  }
  if (typeof o.flow !== "string" || !isRuntimeFlowId(o.flow)) {
    throw new Error(`runtime-context.flow invalid or missing: ${file}`);
  }
  if (typeof o.stage !== "string" || !isStageName(o.stage)) {
    throw new Error(`runtime-context.stage invalid or missing: ${file}`);
  }
  if (o.templateId !== void 0 && typeof o.templateId !== "string") {
    throw new Error(`runtime-context.templateId must be string when set: ${file}`);
  }
  if (o.sourceMode !== void 0 && o.sourceMode !== "full_bmad" && o.sourceMode !== "seeded_solutioning" && o.sourceMode !== "standalone_story") {
    throw new Error(`runtime-context.sourceMode invalid: ${file}`);
  }
  for (const key of ["epicId", "storyId", "storySlug", "runId", "artifactRoot"]) {
    if (o[key] !== void 0 && typeof o[key] !== "string") {
      throw new Error(`runtime-context.${key} must be string when set: ${file}`);
    }
  }
  for (const key of ["workflow", "step", "artifactPath"]) {
    if (o[key] !== void 0 && typeof o[key] !== "string") {
      throw new Error(`runtime-context.${key} must be string when set: ${file}`);
    }
  }
  if (o.contextScope !== void 0 && o.contextScope !== "project" && o.contextScope !== "story") {
    throw new Error(`runtime-context.contextScope invalid: ${file}`);
  }
  if (o.languagePolicy !== void 0) {
    if (!o.languagePolicy || typeof o.languagePolicy !== "object") {
      throw new Error(`runtime-context.languagePolicy invalid: ${file}`);
    }
    const lp = o.languagePolicy;
    if (lp.resolvedMode !== "zh" && lp.resolvedMode !== "en" && lp.resolvedMode !== "bilingual") {
      throw new Error(`runtime-context.languagePolicy.resolvedMode invalid: ${file}`);
    }
  }
  if (typeof o.updatedAt !== "string" || o.updatedAt.trim() === "") {
    throw new Error(`runtime-context.updatedAt missing: ${file}`);
  }
  const out = {
    version: RUNTIME_CONTEXT_VERSION,
    flow: o.flow,
    stage: o.stage,
    updatedAt: o.updatedAt
  };
  if (o.sourceMode === "full_bmad" || o.sourceMode === "seeded_solutioning" || o.sourceMode === "standalone_story") {
    out.sourceMode = o.sourceMode;
  }
  if (typeof o.templateId === "string" && o.templateId !== "") {
    out.templateId = o.templateId;
  }
  if (typeof o.epicId === "string" && o.epicId !== "") out.epicId = o.epicId;
  if (typeof o.storyId === "string" && o.storyId !== "") out.storyId = o.storyId;
  if (typeof o.storySlug === "string" && o.storySlug !== "") out.storySlug = o.storySlug;
  if (typeof o.runId === "string" && o.runId !== "") out.runId = o.runId;
  if (typeof o.artifactRoot === "string" && o.artifactRoot !== "")
    out.artifactRoot = o.artifactRoot;
  if (typeof o.artifactPath === "string" && o.artifactPath !== "") out.artifactPath = o.artifactPath;
  if (typeof o.workflow === "string" && o.workflow !== "") out.workflow = o.workflow;
  if (typeof o.step === "string" && o.step !== "") out.step = o.step;
  if (o.contextScope === "project" || o.contextScope === "story") out.contextScope = o.contextScope;
  if (o.languagePolicy && typeof o.languagePolicy === "object") {
    const lp = o.languagePolicy;
    if (lp.resolvedMode === "zh" || lp.resolvedMode === "en" || lp.resolvedMode === "bilingual") {
      out.languagePolicy = { resolvedMode: lp.resolvedMode };
    }
  }
  return out;
}

// ../../scripts/runtime-governance.ts
var fs7 = __toESM(require("node:fs"));
var path7 = __toESM(require("node:path"));

// ../../scripts/bmad-config.ts
var import_node_fs = require("node:fs");
var DEFAULT_CONFIG_PATH = "config/bmad-story-config.yaml";
var DEFAULT_MODE = "full";
var cachedConfig = null;
function buildRuntimeConfig(baseConfig, env) {
  const mergedConfig = mergeConfig(baseConfig, {});
  const envOverrides = parseEnvOverrides();
  const cliFlags = parseCliFlags();
  const runtimeEnv = { ...env };
  const override = mergedConfig.environment_overrides[runtimeEnv.platform];
  if (override) {
    runtimeEnv.subagentTool = override.subagent_tool;
    runtimeEnv.subagentType = override.default_subagent_type;
  }
  if (envOverrides.auditGranularity) {
    mergedConfig.audit_granularity.mode = envOverrides.auditGranularity;
  }
  if (cliFlags.auditGranularity) {
    mergedConfig.audit_granularity.mode = cliFlags.auditGranularity;
  }
  if (typeof envOverrides.autoContinue === "boolean") {
    mergedConfig.auto_continue.enabled = envOverrides.autoContinue;
  }
  if (typeof cliFlags.autoContinue === "boolean") {
    mergedConfig.auto_continue.enabled = cliFlags.autoContinue;
  }
  return {
    ...mergedConfig,
    _environment: runtimeEnv
  };
}
function parseCliFlags(argv = process.argv.slice(2)) {
  const result = {};
  for (const arg of argv) {
    if (arg === "--continue") {
      result.autoContinue = true;
      continue;
    }
    if (arg.startsWith("--audit-granularity=")) {
      const value = arg.split("=")[1];
      if (value === "full" || value === "story" || value === "epic") {
        result.auditGranularity = value;
      }
    }
  }
  return result;
}
function parseEnvOverrides() {
  const result = {};
  const envMode = process.env.BMAD_AUDIT_GRANULARITY;
  if (envMode === "full" || envMode === "story" || envMode === "epic") {
    result.auditGranularity = envMode;
  }
  const envContinue = process.env.BMAD_AUTO_CONTINUE?.toLowerCase();
  if (envContinue === "true") {
    result.autoContinue = true;
  }
  if (envContinue === "false") {
    result.autoContinue = false;
  }
  return result;
}
var ENV_CURSOR = {
  platform: "cursor",
  subagentTool: "mcp_task",
  subagentType: "generalPurpose",
  skillsRoot: ".cursor/skills",
  agentsRoot: ".claude/agents",
  configPath: DEFAULT_CONFIG_PATH
};
var ENV_CLAUDE = {
  platform: "claude",
  subagentTool: "Agent",
  subagentType: "general-purpose",
  skillsRoot: ".claude/skills",
  agentsRoot: ".claude/agents",
  configPath: DEFAULT_CONFIG_PATH
};
function detectEnvironment() {
  const envPlatform = process.env.BMAD_PLATFORM?.toLowerCase();
  if (envPlatform === "cursor") {
    return { ...ENV_CURSOR };
  }
  if (envPlatform === "claude") {
    return { ...ENV_CLAUDE };
  }
  if ((0, import_node_fs.existsSync)(".cursor")) {
    return { ...ENV_CURSOR };
  }
  if (process.env.CLAUDE_CODE_CLI === "true") {
    return { ...ENV_CLAUDE };
  }
  return { ...ENV_CLAUDE };
}
function loadConfigFromFile(configPath) {
  const path12 = configPath || DEFAULT_CONFIG_PATH;
  if (!(0, import_node_fs.existsSync)(path12)) {
    return {};
  }
  try {
    const content = (0, import_node_fs.readFileSync)(path12, "utf8");
    return load(content);
  } catch (error) {
    console.error(`[bmad-config] \u8BFB\u53D6\u914D\u7F6E\u6587\u4EF6\u5931\u8D25: ${path12}`, error);
    return {};
  }
}
function getDefaultConfig() {
  return {
    version: "1.0",
    i18n: {
      default_language_mode: "auto",
      default_artifact_language: "auto",
      allow_bilingual_auto_mode: false,
      fallback_language: "en",
      preserve_control_keys_in_english: true,
      preserve_commands_and_paths: true,
      render_bilingual_headings_with_slash: true
    },
    audit_granularity: {
      mode: DEFAULT_MODE,
      modes: {
        full: {
          name: "\u5168\u6D41\u7A0B\u5BA1\u8BA1",
          description: "\u6240\u6709\u9636\u6BB5\u90FD\u6267\u884C\u4E25\u683C\u5BA1\u8BA1\uFF08\u9ED8\u8BA4\u6A21\u5F0F\uFF09",
          stages: {
            story_create: { audit: true, strictness: "standard" },
            story_audit: { audit: true, strictness: "standard" },
            specify: { audit: true, strictness: "standard" },
            plan: { audit: true, strictness: "standard" },
            gaps: { audit: true, strictness: "standard" },
            tasks: { audit: true, strictness: "standard" },
            implement: { audit: true, strictness: "strict" },
            post_audit: { audit: true, strictness: "strict" },
            epic_create: { audit: false },
            epic_complete: { audit: false }
          }
        },
        story: {
          name: "Story\u7EA7\u8F7B\u91CF\u5BA1\u8BA1",
          description: "\u4EC5\u5728Story\u521B\u5EFA\u548C\u5B9E\u65BD\u540E\u6267\u884C\u5BA1\u8BA1\uFF0C\u4E2D\u95F4\u9636\u6BB5\u53EA\u505A\u9A8C\u8BC1",
          stages: {
            story_create: { audit: true, strictness: "standard" },
            story_audit: { audit: true, strictness: "standard" },
            specify: {
              audit: false,
              generate_doc: true,
              validation: "basic",
              checks: ["document_exists", "schema_valid", "required_sections"]
            },
            plan: {
              audit: false,
              generate_doc: true,
              validation: "basic",
              checks: ["document_exists", "schema_valid", "required_sections"]
            },
            gaps: {
              audit: false,
              generate_doc: true,
              validation: "basic",
              checks: ["document_exists", "gap_items_defined"]
            },
            tasks: {
              audit: false,
              generate_doc: true,
              validation: "basic",
              checks: ["document_exists", "task_list_complete"]
            },
            implement: {
              audit: false,
              generate_doc: true,
              validation: "test_only",
              checks: ["all_tests_pass", "lint_no_errors", "document_exists"]
            },
            post_audit: {
              audit: true,
              strictness: "strict",
              checks: [
                "tdd_evidence",
                "ralph_method_compliance",
                "code_quality",
                "integration_tests"
              ]
            },
            epic_create: { audit: false },
            epic_complete: { audit: false }
          }
        },
        epic: {
          name: "Epic\u7EA7\u7EFC\u5408\u5BA1\u8BA1",
          description: "\u4EC5\u5728Epic\u521B\u5EFA\u548C\u5B8C\u6210\u540E\u6267\u884C\u5BA1\u8BA1\uFF0CStory\u7EA7\u53EA\u505A\u6587\u6863\u751F\u6210",
          stages: {
            story_create: { audit: false, generate_doc: true, validation: null },
            story_audit: { audit: false, generate_doc: true, validation: null },
            specify: { audit: false, generate_doc: true, validation: null },
            plan: { audit: false, generate_doc: true, validation: null },
            gaps: { audit: false, generate_doc: true, validation: null },
            tasks: { audit: false, generate_doc: true, validation: null },
            implement: {
              audit: false,
              generate_doc: true,
              validation: "test_only",
              checks: ["all_tests_pass", "lint_no_errors"]
            },
            post_audit: { audit: false },
            epic_create: {
              audit: true,
              strictness: "standard",
              optional: true,
              checks: [
                "epic_scope_clarity",
                "story_split_reasonableness",
                "cross_story_dependencies",
                "epic_architecture_feasibility"
              ]
            },
            epic_complete: {
              audit: true,
              strictness: "strict",
              required_rounds: 3,
              checks: [
                "cross_story_consistency",
                "epic_architecture_compliance",
                "integration_completeness",
                "comprehensive_code_quality",
                "comprehensive_test_coverage",
                "documentation_completeness"
              ]
            }
          }
        }
      }
    },
    auto_continue: {
      enabled: false,
      require_ready_flag: true,
      require_next_action: true,
      source_priority: ["cli", "env", "file", "default"]
    },
    validation_levels: {
      basic: {
        description: "\u57FA\u7840\u6587\u6863\u9A8C\u8BC1",
        checks: [
          { name: "document_exists", description: "\u6587\u6863\u5B58\u5728\u6027\u68C0\u67E5", required: true },
          { name: "schema_valid", description: "\u57FA\u672C\u7ED3\u6784\u68C0\u67E5", required: true },
          { name: "required_sections", description: "\u5FC5\u9700\u7AE0\u8282\u68C0\u67E5", required: true }
        ]
      },
      test_only: {
        description: "\u4EC5\u6D4B\u8BD5\u9A8C\u8BC1",
        checks: [
          { name: "all_tests_pass", description: "\u6240\u6709\u6D4B\u8BD5\u901A\u8FC7", required: true },
          { name: "lint_no_errors", description: "Lint\u65E0\u9519\u8BEF", required: true },
          { name: "document_exists", description: "\u6587\u6863\u5B58\u5728", required: true }
        ]
      },
      full_validation: {
        description: "\u5B8C\u6574\u9A8C\u8BC1\uFF08\u4E0D\u5BA1\u8BA1\uFF09",
        checks: [
          { name: "document_exists", required: true },
          { name: "schema_valid", required: true },
          { name: "content_completeness", required: true },
          { name: "cross_reference_valid", required: true }
        ]
      }
    },
    audit_convergence: {
      default: "standard",
      strict: {
        description: "\u4E25\u683C\u6A21\u5F0F",
        rounds: 3,
        no_gap_required: true,
        critical_auditor_ratio: 0.5,
        applicable_stages: ["implement", "post_audit", "epic_complete"]
      },
      standard: {
        description: "\u6807\u51C6\u6A21\u5F0F",
        rounds: 1,
        no_gap_required: false,
        critical_auditor_ratio: 0.5,
        applicable_stages: ["story_audit", "specify", "plan", "gaps", "tasks", "epic_create"]
      }
    },
    notifications: {
      when_audit_skipped: true,
      when_epic_completed: true,
      when_validation_failed: true
    },
    report_paths: {
      story_audit: "_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_story-{epic}-{story}.md",
      specify: "specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md",
      plan: "specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_plan-E{epic}-S{story}.md",
      gaps: "specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_GAPS-E{epic}-S{story}.md",
      tasks: "specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_tasks-E{epic}-S{story}.md",
      implement: "specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md",
      post_audit: "_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_Story_{epic}-{story}_stage4.md",
      epic_create: "_bmad-output/epic-{epic}-{epic-slug}/AUDIT_Epic_{epic}_create.md",
      epic_complete: "_bmad-output/epic-{epic}-{epic-slug}/AUDIT_Epic_{epic}.md",
      epic_completion_report: "_bmad-output/epic-{epic}-{epic-slug}/EPIC_COMPLETION_REPORT.md"
    },
    environment_overrides: {
      cursor: {
        subagent_tool: "mcp_task",
        default_subagent_type: "generalPurpose"
      },
      claude: {
        subagent_tool: "Agent",
        default_subagent_type: "general-purpose"
      }
    }
  };
}
function mergeConfig(base, override) {
  return {
    ...base,
    ...override,
    audit_granularity: {
      ...base.audit_granularity,
      ...override.audit_granularity,
      modes: {
        ...base.audit_granularity.modes,
        ...override.audit_granularity?.modes
      }
    },
    auto_continue: {
      ...base.auto_continue,
      ...override.auto_continue
    },
    notifications: {
      ...base.notifications,
      ...override.notifications
    },
    i18n: {
      ...base.i18n,
      ...override.i18n
    },
    report_paths: {
      ...base.report_paths,
      ...override.report_paths
    },
    environment_overrides: {
      ...base.environment_overrides,
      ...override.environment_overrides
    }
  };
}
function loadConfig(configPath) {
  const env = detectEnvironment();
  if (!configPath && cachedConfig) {
    return buildRuntimeConfig(cachedConfig, env);
  }
  const baseConfig = getDefaultConfig();
  const fileConfig = loadConfigFromFile(configPath || env.configPath);
  const mergedConfig = mergeConfig(baseConfig, fileConfig);
  const runtimeConfig = buildRuntimeConfig(mergedConfig, env);
  if (!configPath) {
    cachedConfig = {
      ...mergedConfig,
      _environment: runtimeConfig._environment
    };
  }
  return runtimeConfig;
}
function getStageConfig(stage, config) {
  const cfg = config || loadConfig();
  const mode = cfg.audit_granularity.mode;
  return cfg.audit_granularity.modes[mode]?.stages[stage];
}
function getAuditConvergence(strictness, config) {
  const cfg = config || loadConfig();
  return cfg.audit_convergence[strictness];
}

// ../scoring/trigger/trigger-loader.ts
var fs6 = __toESM(require("fs"));
var path6 = __toESM(require("path"));
var cachedConfig2 = null;
var cachedConfigPath = null;
function loadTriggerConfig(configPath) {
  const base = configPath ?? path6.resolve(process.cwd(), "_bmad", "_config", "scoring-trigger-modes.yaml");
  const resolved = path6.isAbsolute(base) ? base : path6.resolve(process.cwd(), base);
  if (cachedConfig2 && cachedConfigPath === resolved) {
    return cachedConfig2;
  }
  if (!fs6.existsSync(resolved)) {
    throw new Error(`Trigger config not found: ${resolved}`);
  }
  const content = fs6.readFileSync(resolved, "utf-8");
  const raw = load(content);
  if (!raw || typeof raw !== "object" || !("scoring_write_control" in raw) || !("event_to_write_mode" in raw)) {
    throw new Error(`Invalid trigger config: missing scoring_write_control or event_to_write_mode`);
  }
  cachedConfig2 = raw;
  cachedConfigPath = resolved;
  return cachedConfig2;
}
function shouldWriteScore(event, stage, scenario, configPath) {
  const config = loadTriggerConfig(configPath);
  const { enabled, call_mapping } = config.scoring_write_control;
  if (!enabled) {
    return { write: false, writeMode: "single_file", reason: "scoring disabled" };
  }
  const entries = Object.values(call_mapping ?? {});
  const matched = entries.find((e) => e.event === event && e.stage === stage);
  if (!matched) {
    return { write: false, writeMode: "single_file", reason: "stage not registered in call_mapping" };
  }
  const eventModes = config.event_to_write_mode?.[event];
  if (!eventModes) {
    return { write: false, writeMode: "single_file", reason: "event not in event_to_write_mode" };
  }
  const modeStr = eventModes[scenario] ?? eventModes.default ?? "single_file";
  const writeMode = modeStr === "jsonl" ? "jsonl" : modeStr === "both" ? "both" : "single_file";
  return { write: true, writeMode, reason: "matched" };
}
function scoringEnabledForTriggerStage(triggerStage, scenario, configPath) {
  const config = loadTriggerConfig(configPath);
  const { enabled, call_mapping } = config.scoring_write_control;
  if (!enabled) {
    return { enabled: false, reason: "scoring disabled" };
  }
  const entries = Object.values(call_mapping ?? {}).filter((e) => e.stage === triggerStage);
  if (entries.length === 0) {
    return { enabled: false, reason: "stage not registered in call_mapping" };
  }
  const events = new Set(entries.map((e) => e.event));
  if (events.size > 1) {
    throw new Error(
      `scoring-trigger-modes.yaml call_mapping: ambiguous multiple events for stage "${triggerStage}"`
    );
  }
  const entry = entries[0];
  const decision = shouldWriteScore(entry.event, triggerStage, scenario, configPath);
  return { enabled: decision.write, reason: decision.reason };
}

// ../../scripts/runtime-governance-template-schema.ts
var import_ajv4 = __toESM(require_ajv());
var ajv4 = new import_ajv4.default({ allErrors: true, strict: true, allowUnionTypes: true });
var runtimePolicyTemplatePatchSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    auditRequired: { type: "boolean" },
    validationLevel: {
      anyOf: [
        { type: "string", enum: ["basic", "test_only", "full_validation"] },
        { type: "null" }
      ]
    },
    strictness: { type: "string", enum: ["strict", "standard"] },
    generateDoc: { type: "boolean" },
    skipAllowed: { type: "boolean" },
    convergence: { type: "object", additionalProperties: true },
    mandatoryGate: { type: "boolean" },
    granularityGoverned: { type: "boolean" }
  }
};
var validatePatch = ajv4.compile(runtimePolicyTemplatePatchSchema);
function assertValidRuntimePolicyTemplatePatch(patch, templateId) {
  if (!validatePatch(patch)) {
    throw new Error(
      `Invalid runtime policy template "${templateId}": ${ajv4.errorsText(validatePatch.errors, { separator: "; " })}`
    );
  }
}
function parseRuntimePolicyTemplatesYaml(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("runtime-policy-templates.yaml: expected object root");
  }
  const o = raw;
  if (typeof o.version !== "string") {
    throw new Error("runtime-policy-templates.yaml: missing string version");
  }
  if (!o.templates || typeof o.templates !== "object") {
    throw new Error("runtime-policy-templates.yaml: missing templates map");
  }
  const templates = o.templates;
  for (const [id, patch] of Object.entries(templates)) {
    assertValidRuntimePolicyTemplatePatch(patch, id);
  }
  return {
    version: o.version,
    templates
  };
}

// ../../scripts/runtime-governance-registry.ts
var augmenters = [];
function applyRegisteredAugmenters(policy, ctx) {
  let p = policy;
  for (const { fn } of augmenters) {
    p = fn(p, ctx);
  }
  return p;
}

// ../../scripts/runtime-governance.ts
var runtimePolicyShadowModeForTests = false;
function defaultConfigDir() {
  return path7.resolve(process.cwd(), "_bmad", "_config");
}
function resolvePath(override, name) {
  if (override) {
    return path7.isAbsolute(override) ? override : path7.resolve(process.cwd(), override);
  }
  return path7.join(defaultConfigDir(), name);
}
function readYamlFile(filePath) {
  const content = fs7.readFileSync(filePath, "utf8");
  return load(content);
}
function loadMandatoryGates(filePath) {
  const raw = readYamlFile(filePath);
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.gates)) {
    throw new Error(`Invalid mandatory gates YAML: ${filePath}`);
  }
  return raw;
}
function loadGranularityStages(filePath) {
  const raw = readYamlFile(filePath);
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.granularity_governed_stages)) {
    throw new Error(`Invalid granularity stages YAML: ${filePath}`);
  }
  return raw;
}
function loadRuntimeStageMapping(filePath) {
  const raw = readYamlFile(filePath);
  if (!raw || typeof raw !== "object" || !raw.runtime_flow_stage_to_trigger_stage || typeof raw.runtime_flow_stage_to_trigger_stage !== "object") {
    throw new Error(`stage-mapping.yaml missing runtime_flow_stage_to_trigger_stage: ${filePath}`);
  }
  return raw;
}
function readLegacyStagePolicyFields(stage, cfg) {
  const stageConfig = getStageConfig(stage, cfg);
  return {
    auditRequired: stageConfig?.audit ?? true,
    validationLevel: stageConfig?.validation ?? null,
    strictness: stageConfig?.strictness ?? "standard",
    generateDoc: stageConfig?.generate_doc ?? true
  };
}
function findMandatoryGateRule(flow, stage, mandatoryPath) {
  const doc = loadMandatoryGates(mandatoryPath);
  const hit = doc.gates.find((g) => g.flow === flow && g.stage === stage);
  return hit ? { id: hit.id } : null;
}
function granularityGovernedForStage(stage, granPath) {
  const doc = loadGranularityStages(granPath);
  return doc.granularity_governed_stages.includes(stage);
}
function resolveTriggerStage(flow, stage, mappingPath) {
  const doc = loadRuntimeStageMapping(mappingPath);
  const flowMap = doc.runtime_flow_stage_to_trigger_stage[flow];
  const mapped = flowMap?.[stage];
  if (mapped !== void 0 && mapped !== "") {
    return { triggerStage: mapped, mappingDescriptor: `${flow}/${stage}\u2192${mapped}` };
  }
  const unmapped = `unmapped_${stage}`;
  return { triggerStage: unmapped, mappingDescriptor: `${flow}/${stage}\u2192${unmapped}` };
}
function mergeRuntimePolicyTemplate(base, templateId, templatesPath, cfg) {
  const content = fs7.readFileSync(templatesPath, "utf8");
  const parsed = parseRuntimePolicyTemplatesYaml(load(content));
  const patch = parsed.templates[templateId];
  if (!patch) {
    throw new Error(`Unknown runtime policy templateId: ${templateId}`);
  }
  const merged = { ...base };
  const mergedRec = merged;
  for (const [k, v] of Object.entries(patch)) {
    mergedRec[k] = v;
  }
  if (patch.strictness !== void 0 && patch.convergence === void 0) {
    merged.convergence = getAuditConvergence(merged.strictness, cfg);
  }
  merged.reason = `${base.reason} | template:${templateId}`;
  return merged;
}
function resolveRuntimeStageForPolicy(stage) {
  if (stage === "constitution") {
    return "specify";
  }
  return stage;
}
function resolveRuntimePolicy(input) {
  const cfg = input.config ?? loadConfig();
  const flow = input.flow;
  const stage = resolveRuntimeStageForPolicy(input.stage);
  const scenario = input.scenario ?? "real_dev";
  const paths = input.governanceYamlPaths ?? {};
  const identitySummaryParts = [
    input.epicId ? `epicId=${input.epicId}` : null,
    input.storyId ? `storyId=${input.storyId}` : null,
    input.storySlug ? `storySlug=${input.storySlug}` : null,
    input.runId ? `runId=${input.runId}` : null,
    input.artifactRoot ? `artifactRoot=${input.artifactRoot}` : null,
    input.contextSource ? `contextSource=${input.contextSource}` : null
  ].filter(Boolean);
  const mandatoryPath = resolvePath(paths.mandatoryGates, "runtime-mandatory-gates.yaml");
  const granPath = resolvePath(paths.granularityStages, "runtime-granularity-stages.yaml");
  const mappingPath = resolvePath(paths.stageMapping, "stage-mapping.yaml");
  const templatesPath = resolvePath(paths.policyTemplates, "runtime-policy-templates.yaml");
  const scoringModesPath = resolvePath(paths.scoringTriggerModes, "scoring-trigger-modes.yaml");
  const legacy = readLegacyStagePolicyFields(stage, cfg);
  const { auditRequired, validationLevel, strictness, generateDoc } = legacy;
  const convergence = getAuditConvergence(strictness, cfg);
  const stageCfg = getStageConfig(stage, cfg);
  const skipAllowed = stageCfg?.optional === true;
  const mandatoryHit = findMandatoryGateRule(flow, stage, mandatoryPath);
  const mandatoryGate = mandatoryHit !== null;
  const granularityGoverned = granularityGovernedForStage(stage, granPath);
  if (mandatoryGate && granularityGoverned) {
    throw new Error(
      `Illegal runtime governance: mandatoryGate and granularityGoverned both true for ${flow}/${stage}`
    );
  }
  const { triggerStage, mappingDescriptor } = resolveTriggerStage(flow, stage, mappingPath);
  const scoring = scoringEnabledForTriggerStage(triggerStage, scenario, scoringModesPath);
  const mandatoryPart = mandatoryHit ? `${mandatoryPath}#${mandatoryHit.id}` : "mandatory:none";
  const granPart = `${granPath}:granularityGoverned=${granularityGoverned}`;
  const legacyPart = `legacy:auditRequired=${auditRequired},validationLevel=${validationLevel},strictness=${strictness},generateDoc=${generateDoc}`;
  const scoringPart = `scoringEnabled=${scoring.enabled}(${scoring.reason})`;
  const identityPart = identitySummaryParts.length > 0 ? `identity:${identitySummaryParts.join(",")}` : "identity:none";
  const reason = `${legacyPart}; convergence:${strictness}; ${mandatoryPart}; ${granPart}; trigger:${mappingDescriptor}; ${scoringPart}; ${identityPart}`;
  const compatibilitySource = runtimePolicyShadowModeForTests ? "shadow" : "governance";
  let policy = {
    flow,
    stage,
    auditRequired,
    validationLevel,
    strictness,
    generateDoc,
    convergence,
    mandatoryGate,
    granularityGoverned,
    skipAllowed,
    scoringEnabled: scoring.enabled,
    triggerStage,
    compatibilitySource,
    reason,
    identity: {
      flow,
      stage,
      ...input.epicId ? { epicId: input.epicId } : {},
      ...input.storyId ? { storyId: input.storyId } : {},
      ...input.storySlug ? { storySlug: input.storySlug } : {},
      ...input.runId ? { runId: input.runId } : {},
      ...input.artifactRoot ? { artifactRoot: input.artifactRoot } : {},
      ...input.contextSource ? { contextSource: input.contextSource } : {}
    },
    control: {
      auditRequired,
      validationLevel,
      strictness,
      generateDoc,
      convergence,
      mandatoryGate,
      granularityGoverned,
      skipAllowed,
      scoringEnabled: scoring.enabled,
      triggerStage,
      reason
    },
    language: {
      preserveMachineKeys: true,
      preserveParserAnchors: true,
      preserveTriggerStage: true
    }
  };
  if (input.templateId) {
    policy = mergeRuntimePolicyTemplate(policy, input.templateId, templatesPath, cfg);
  }
  policy = applyRegisteredAugmenters(policy, input);
  return policy;
}

// ../../scripts/governance-remediation-config.ts
var fs8 = __toESM(require("node:fs"));
var path8 = __toESM(require("node:path"));
function uniqueHosts(hosts) {
  return [...new Set(hosts)];
}
function isHostKind(value) {
  return value === "cursor" || value === "claude" || value === "codex" || value === "generic";
}
function governanceRemediationConfigPath(projectRoot) {
  return path8.join(projectRoot, "_bmad", "_config", "governance-remediation.yaml");
}
function defaultGovernanceRemediationConfig() {
  return {
    version: 1,
    primaryHost: "cursor",
    packetHosts: ["cursor", "claude", "codex"],
    execution: {
      enabled: false,
      authoritativeHost: "cursor",
      fallbackHosts: ["claude", "codex"],
      dispatch: {
        leaseTimeoutSeconds: 900,
        heartbeatIntervalSeconds: 60,
        maxDispatchAttempts: 3
      },
      execution: {
        timeoutMinutes: 30,
        maxExecutionAttempts: 2
      },
      rerunGate: {
        required: true,
        autoSchedule: true,
        maxGateRetries: 2
      },
      escalation: {
        afterDispatchFailures: 3,
        afterExecutionFailures: 2,
        afterGateFailures: 2
      },
      projections: {
        emitNonAuthoritativePackets: true,
        archivePath: "_bmad-output/runtime/governance/archive"
      }
    },
    provider: {
      mode: "stub",
      id: "default-governance-provider"
    }
  };
}
function readGovernanceRemediationConfig(projectRoot, explicitPath) {
  const file = explicitPath ? path8.isAbsolute(explicitPath) ? explicitPath : path8.resolve(projectRoot, explicitPath) : governanceRemediationConfigPath(projectRoot);
  if (!fs8.existsSync(file)) {
    return defaultGovernanceRemediationConfig();
  }
  const parsed = load(fs8.readFileSync(file, "utf8"));
  const base = defaultGovernanceRemediationConfig();
  const primaryHost = parsed?.primaryHost && isHostKind(parsed.primaryHost) ? parsed.primaryHost : base.primaryHost;
  const packetHosts = uniqueHosts(
    Array.isArray(parsed?.packetHosts) ? parsed.packetHosts.filter((host) => typeof host === "string" && isHostKind(host)) : base.packetHosts
  );
  const execution = parsed?.execution ?? base.execution;
  if (parsed?.execution && typeof parsed.execution === "object" && "authoritativeHost" in parsed.execution && typeof parsed.execution.authoritativeHost === "string" && !isHostKind(parsed.execution.authoritativeHost)) {
    throw new Error(
      `Invalid governance-remediation execution.authoritativeHost: ${parsed.execution.authoritativeHost}`
    );
  }
  const authoritativeHost = execution && typeof execution === "object" && typeof execution.authoritativeHost === "string" && isHostKind(execution.authoritativeHost) ? execution.authoritativeHost : primaryHost;
  const fallbackHosts = uniqueHosts(
    Array.isArray(execution?.fallbackHosts) ? execution.fallbackHosts.filter(
      (host) => typeof host === "string" && isHostKind(host)
    ) : base.execution?.fallbackHosts ?? []
  ).filter((host) => host !== authoritativeHost);
  const provider = {
    ...base.provider,
    ...parsed?.provider ?? {}
  };
  return {
    version: parsed?.version === 2 ? 2 : 1,
    primaryHost,
    packetHosts: packetHosts.length > 0 ? packetHosts : [primaryHost],
    execution: {
      enabled: typeof execution?.enabled === "boolean" ? execution.enabled : base.execution?.enabled ?? false,
      authoritativeHost,
      fallbackHosts,
      dispatch: {
        leaseTimeoutSeconds: Number(execution?.dispatch?.leaseTimeoutSeconds) > 0 ? Number(execution?.dispatch?.leaseTimeoutSeconds) : base.execution?.dispatch.leaseTimeoutSeconds ?? 900,
        heartbeatIntervalSeconds: Number(execution?.dispatch?.heartbeatIntervalSeconds) > 0 ? Number(execution?.dispatch?.heartbeatIntervalSeconds) : base.execution?.dispatch.heartbeatIntervalSeconds ?? 60,
        maxDispatchAttempts: Number(execution?.dispatch?.maxDispatchAttempts) > 0 ? Number(execution?.dispatch?.maxDispatchAttempts) : base.execution?.dispatch.maxDispatchAttempts ?? 3
      },
      execution: {
        timeoutMinutes: Number(execution?.execution?.timeoutMinutes) > 0 ? Number(execution?.execution?.timeoutMinutes) : base.execution?.execution.timeoutMinutes ?? 30,
        maxExecutionAttempts: Number(execution?.execution?.maxExecutionAttempts) > 0 ? Number(execution?.execution?.maxExecutionAttempts) : base.execution?.execution.maxExecutionAttempts ?? 2
      },
      rerunGate: {
        required: typeof execution?.rerunGate?.required === "boolean" ? execution.rerunGate.required : base.execution?.rerunGate.required ?? true,
        autoSchedule: typeof execution?.rerunGate?.autoSchedule === "boolean" ? execution.rerunGate.autoSchedule : base.execution?.rerunGate.autoSchedule ?? true,
        maxGateRetries: Number(execution?.rerunGate?.maxGateRetries) > 0 ? Number(execution?.rerunGate?.maxGateRetries) : base.execution?.rerunGate.maxGateRetries ?? 2
      },
      escalation: {
        afterDispatchFailures: Number(execution?.escalation?.afterDispatchFailures) > 0 ? Number(execution?.escalation?.afterDispatchFailures) : base.execution?.escalation.afterDispatchFailures ?? 3,
        afterExecutionFailures: Number(execution?.escalation?.afterExecutionFailures) > 0 ? Number(execution?.escalation?.afterExecutionFailures) : base.execution?.escalation.afterExecutionFailures ?? 2,
        afterGateFailures: Number(execution?.escalation?.afterGateFailures) > 0 ? Number(execution?.escalation?.afterGateFailures) : base.execution?.escalation.afterGateFailures ?? 2
      },
      projections: {
        emitNonAuthoritativePackets: typeof execution?.projections?.emitNonAuthoritativePackets === "boolean" ? execution.projections.emitNonAuthoritativePackets : base.execution?.projections.emitNonAuthoritativePackets ?? true,
        archivePath: typeof execution?.projections?.archivePath === "string" && execution.projections.archivePath.trim() !== "" ? execution.projections.archivePath : base.execution?.projections.archivePath ?? "_bmad-output/runtime/governance/archive"
      }
    },
    provider: {
      ...provider,
      id: provider.id || base.provider.id,
      mode: provider.mode || base.provider.mode
    }
  };
}
function createGovernanceProviderAdapterFromConfig(config) {
  switch (config.provider.mode) {
    case "stub":
      return createStubGovernanceProviderAdapter(
        config.provider.stubCandidate ?? null,
        config.provider.id
      );
    case "http-json": {
      if (!config.provider.endpoint) {
        throw new Error("governance-remediation provider.endpoint is required for http-json mode");
      }
      const providerConfig = {
        id: config.provider.id,
        endpoint: config.provider.endpoint,
        displayName: config.provider.displayName,
        timeoutMs: config.provider.timeoutMs,
        headers: config.provider.headers,
        method: config.provider.method
      };
      return createHttpJsonGovernanceProviderAdapter(providerConfig);
    }
    case "openai-compatible": {
      if (!config.provider.baseUrl || !config.provider.model) {
        throw new Error(
          "governance-remediation provider.baseUrl and provider.model are required for openai-compatible mode"
        );
      }
      const apiKey = config.provider.apiKey ?? (config.provider.apiKeyEnv ? process.env[config.provider.apiKeyEnv] : void 0);
      const providerConfig = {
        id: config.provider.id,
        baseUrl: config.provider.baseUrl,
        model: config.provider.model,
        apiKey,
        timeoutMs: config.provider.timeoutMs,
        headers: config.provider.headers,
        displayName: config.provider.displayName,
        systemPrompt: config.provider.systemPrompt
      };
      return createOpenAICompatibleGovernanceProviderAdapter(providerConfig);
    }
    case "anthropic-compatible": {
      if (!config.provider.baseUrl || !config.provider.model) {
        throw new Error(
          "governance-remediation provider.baseUrl and provider.model are required for anthropic-compatible mode"
        );
      }
      const apiKey = config.provider.apiKey ?? (config.provider.apiKeyEnv ? process.env[config.provider.apiKeyEnv] : void 0);
      const providerConfig = {
        id: config.provider.id,
        baseUrl: config.provider.baseUrl,
        model: config.provider.model,
        apiKey,
        timeoutMs: config.provider.timeoutMs,
        headers: config.provider.headers,
        displayName: config.provider.displayName,
        systemPrompt: config.provider.systemPrompt,
        maxTokens: config.provider.maxTokens,
        anthropicVersion: config.provider.anthropicVersion
      };
      return createAnthropicCompatibleGovernanceProviderAdapter(providerConfig);
    }
    default:
      return void 0;
  }
}

// ../scoring/query/loader.ts
var fs9 = __toESM(require("fs"));
var path10 = __toESM(require("path"));

// ../scoring/constants/path.ts
var import_path = __toESM(require("path"));
function getScoringDataPath() {
  const envPath = process.env.SCORING_DATA_PATH;
  if (envPath) {
    return import_path.default.isAbsolute(envPath) ? envPath : import_path.default.resolve(process.cwd(), envPath);
  }
  return import_path.default.resolve(process.cwd(), "packages", "scoring", "data");
}

// ../scoring/query/loader.ts
var EXCLUDED_JSON = ["sft-dataset.json"];
function isRunScoreRecord(obj) {
  if (obj == null || typeof obj !== "object") return false;
  const o = obj;
  return typeof o.run_id === "string" && o.run_id.length > 0 && typeof o.timestamp === "string" && (o.scenario === "real_dev" || o.scenario === "eval_question") && typeof o.stage === "string";
}
function resolveDataPath(dataPath) {
  if (dataPath == null || dataPath === "") {
    return getScoringDataPath();
  }
  return path10.isAbsolute(dataPath) ? dataPath : path10.resolve(process.cwd(), dataPath);
}
function parseRecords(content) {
  const records = [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (isRunScoreRecord(item)) records.push(item);
      }
    } else if (isRunScoreRecord(parsed)) {
      records.push(parsed);
    }
  } catch {
  }
  return records;
}
function loadAllRecords(dataPath) {
  const base = resolveDataPath(dataPath);
  const records = [];
  if (!fs9.existsSync(base)) {
    return [];
  }
  const entries = fs9.readdirSync(base, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    const full = path10.join(base, e.name);
    if (e.name.endsWith(".json") && !EXCLUDED_JSON.includes(e.name)) {
      try {
        const content = fs9.readFileSync(full, "utf-8");
        records.push(...parseRecords(content));
      } catch {
      }
    }
  }
  const jsonlPath = path10.join(base, "scores.jsonl");
  if (fs9.existsSync(jsonlPath)) {
    const lines = fs9.readFileSync(jsonlPath, "utf-8").split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (isRunScoreRecord(parsed)) records.push(parsed);
      } catch {
      }
    }
  }
  return records;
}
function dedupeByRunIdStage(records) {
  const byKey = /* @__PURE__ */ new Map();
  for (const r of records) {
    const key = `${r.run_id}::${r.stage}`;
    const existing = byKey.get(key);
    if (!existing || new Date(r.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
      byKey.set(key, r);
    }
  }
  return Array.from(byKey.values());
}
function loadAndDedupeRecords(dataPath) {
  const pathToUse = dataPath != null && dataPath !== "" ? dataPath : getScoringDataPath();
  const base = pathToUse === getScoringDataPath() ? pathToUse : resolveDataPath(pathToUse);
  const raw = loadAllRecords(base);
  return dedupeByRunIdStage(raw);
}

// ../scoring/query/parse-epic-story.ts
var RUN_ID_RE = /-e(\d+)-s(\d+)(?:-|$)/;
var SOURCE_PATH_STORY_RE = /story-(\d+)-(\d+)-/;
var SOURCE_PATH_EPIC_RE = /epic-(\d+)-[^/]*\/story-(\d+)-/;
function parseEpicStoryFromRecord(record) {
  const fromRunId = record.run_id.match(RUN_ID_RE);
  if (fromRunId) {
    return {
      epicId: parseInt(fromRunId[1], 10),
      storyId: parseInt(fromRunId[2], 10)
    };
  }
  if (record.source_path) {
    let m = record.source_path.match(SOURCE_PATH_STORY_RE);
    if (m) {
      return {
        epicId: parseInt(m[1], 10),
        storyId: parseInt(m[2], 10)
      };
    }
    m = record.source_path.match(SOURCE_PATH_EPIC_RE);
    if (m) {
      return {
        epicId: parseInt(m[1], 10),
        storyId: parseInt(m[2], 10)
      };
    }
  }
  return null;
}

// ../scoring/analytics/journey-contract-signals.ts
var JOURNEY_CONTRACT_SIGNAL_LABELS = {
  smoke_task_chain: "Smoke Task Chain",
  closure_task_id: "Closure Task",
  journey_unlock: "Journey Unlock",
  gap_split_contract: "Gap Split Contract",
  shared_path_reference: "Shared Path Reference"
};
function effectiveStageForAnalytics(record) {
  return record.trigger_stage === "speckit_5_2" ? "implement" : record.stage;
}
function summarizeJourneyContractSignals(records) {
  const bySignal = /* @__PURE__ */ new Map();
  for (const record of records) {
    const signals = record.journey_contract_signals;
    if (!signals) continue;
    for (const [signal, enabled] of Object.entries(signals)) {
      if (!enabled) continue;
      const current = bySignal.get(signal) ?? {
        count: 0,
        stages: /* @__PURE__ */ new Set(),
        epicStories: /* @__PURE__ */ new Set()
      };
      current.count += 1;
      current.stages.add(effectiveStageForAnalytics(record));
      const parsed = parseEpicStoryFromRecord(record);
      if (parsed) {
        current.epicStories.add(`E${parsed.epicId}.S${parsed.storyId}`);
      }
      bySignal.set(signal, current);
    }
  }
  return [...bySignal.entries()].map(([signal, value]) => ({
    signal,
    label: JOURNEY_CONTRACT_SIGNAL_LABELS[signal],
    count: value.count,
    affected_stages: [...value.stages].sort(),
    epic_stories: [...value.epicStories].sort()
  })).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

// ../scoring/analytics/journey-contract-remediation.ts
var JOURNEY_CONTRACT_RECOMMENDATIONS = {
  smoke_task_chain: "Add at least one smoke task chain per Journey Slice and point setup tasks to that chain.",
  closure_task_id: "Add one closure note task for each Journey Slice and link it to the same smoke path evidence chain.",
  journey_unlock: "Update setup and foundation tasks to state exactly which journey and smoke path they unlock.",
  gap_split_contract: "Split definition gap tasks from implementation gap tasks inside each Journey Slice.",
  shared_path_reference: "Require multi-agent tasks to reference the same journey ledger, invariant ledger, and trace map paths."
};
function buildJourneyContractRemediationHintsFromSummary(summary) {
  return summary.map((item) => ({
    ...item,
    recommendation: JOURNEY_CONTRACT_RECOMMENDATIONS[item.signal]
  }));
}
function buildJourneyContractRemediationHints(records) {
  return buildJourneyContractRemediationHintsFromSummary(
    summarizeJourneyContractSignals(records)
  );
}

// ../scoring/gate/remediation-hints.ts
function buildGateRemediationHints(records) {
  return buildJourneyContractRemediationHints(records);
}

// ../../scripts/governance-remediation-runner.ts
var {
  appendRunnerSummaryToArtifactMarkdown,
  renderGovernanceRunnerSummaryLines
} = require_governance_runner_summary_format();
function toExecutionMode(hostKind) {
  switch (hostKind) {
    case "cursor":
      return "cursor-mcp-task";
    case "claude":
      return "claude-agent-tool";
    case "codex":
      return "codex-spawn-agent";
    case "generic":
    default:
      return "generic-prompt-packet";
  }
}
function sanitizeLoopStateId(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}
function unique4(items) {
  return [...new Set(items.filter((item) => item.trim() !== ""))];
}
function blockerSignature(result) {
  if (!result || result.status !== "fail") {
    return "";
  }
  return unique4([...result.blockerIds ?? []]).sort().join("|");
}
function resolveAbsolutePath(projectRoot, targetPath) {
  return path11.isAbsolute(targetPath) ? targetPath : path11.join(projectRoot, targetPath);
}
function resolveGovernanceScoringDataPath(projectRoot) {
  const envPath = process.env.SCORING_DATA_PATH;
  if (envPath && envPath.trim() !== "") {
    return path11.isAbsolute(envPath) ? envPath : path11.resolve(projectRoot, envPath);
  }
  const candidates = [
    path11.join(projectRoot, "packages", "scoring", "data"),
    path11.join(projectRoot, "scoring", "data"),
    path11.join(projectRoot, "_bmad-output", "scoring")
  ];
  return candidates.find((candidate) => fs10.existsSync(candidate)) ?? candidates[0];
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function parseEpicStoryFromRuntimeContext(runtimeContext) {
  const dottedStory = runtimeContext?.storyId?.match(/^(\d+)\.(\d+)$/);
  if (dottedStory) {
    return {
      epicId: Number(dottedStory[1]),
      storyId: Number(dottedStory[2])
    };
  }
  const epic = runtimeContext?.epicId?.match(/(\d+)/);
  const story = runtimeContext?.storyId?.match(/(\d+)$/);
  if (epic && story) {
    return {
      epicId: Number(epic[1]),
      storyId: Number(story[1])
    };
  }
  return null;
}
function loadJourneyContractHintsForRuntime(projectRoot, runtimeContext) {
  const dataPath = resolveGovernanceScoringDataPath(projectRoot);
  if (!fs10.existsSync(dataPath)) {
    return [];
  }
  const records = loadAndDedupeRecords(dataPath).filter(
    (record) => record.scenario === "real_dev" && record.journey_contract_signals != null
  );
  if (records.length === 0) {
    return [];
  }
  const epicStory = parseEpicStoryFromRuntimeContext(runtimeContext);
  const relevantRecords = epicStory ? records.filter((record) => {
    const parsed = parseEpicStoryFromRecord(record);
    return parsed != null && parsed.epicId === epicStory.epicId && parsed.storyId === epicStory.storyId;
  }) : records;
  if (relevantRecords.length === 0) {
    return [];
  }
  return buildGateRemediationHints(relevantRecords);
}
function buildJourneyContractActionLines(hints) {
  if (hints.length === 0) {
    return ["- (none)"];
  }
  return hints.flatMap((hint) => [
    `- ${hint.signal}: ${hint.recommendation}`,
    `  - Count: ${hint.count}`,
    `  - Affected stages: ${hint.affected_stages.join(", ") || "(none)"}`,
    `  - Stories: ${hint.epic_stories.join(", ") || "(none)"}`
  ]);
}
function uniqueSignals(signals) {
  return [
    ...new Set(
      signals.filter((signal) => Boolean(signal && signal.trim()))
    )
  ].sort();
}
function resolveExecutorRouting(input) {
  const hintSignals = input.journeyContractHints.map((hint) => hint.signal);
  const decisionSignals = input.rerunDecision?.signals ?? [];
  const prioritizedSignals = uniqueSignals([...decisionSignals, ...hintSignals]);
  const targeted = input.rerunDecision?.mode === "targeted" || prioritizedSignals.length > 0;
  if (targeted) {
    return {
      routingMode: "targeted",
      executorRoute: "journey-contract-remediation",
      prioritizedSignals,
      packetStrategy: "journey-contract-remediation-packet",
      reason: input.rerunDecision?.reason ?? "journey contract hints detected; use targeted remediation routing before generic blocker cleanup"
    };
  }
  return {
    routingMode: "generic",
    executorRoute: "default-gate-remediation",
    prioritizedSignals: [],
    packetStrategy: "default-remediation-packet",
    reason: input.rerunDecision?.reason ?? "no journey contract hints detected; use the default gate remediation route"
  };
}
function normalizeRerunStage(stage) {
  return {
    ...stage,
    targetArtifacts: unique4(stage.targetArtifacts ?? []),
    sourceGateFailureIds: unique4(stage.sourceGateFailureIds ?? [])
  };
}
function createRerunStageFromInput(input) {
  return normalizeRerunStage({
    rerunGate: input.rerunGate,
    capabilitySlot: input.capabilitySlot,
    canonicalAgent: input.canonicalAgent,
    targetArtifacts: input.targetArtifacts,
    expectedDelta: input.expectedDelta,
    actualExecutor: input.actualExecutor,
    adapterPath: input.adapterPath,
    rerunOwner: input.rerunOwner,
    sourceGateFailureIds: input.sourceGateFailureIds,
    outcome: input.outcome
  });
}
function activeRerunChain(state) {
  if (state.rerunChain && state.rerunChain.length > 0) {
    return state.rerunChain.map((stage) => normalizeRerunStage(stage));
  }
  return [
    normalizeRerunStage({
      rerunGate: state.rerunGate,
      capabilitySlot: state.capabilitySlot,
      canonicalAgent: state.canonicalAgent,
      targetArtifacts: state.targetArtifacts,
      expectedDelta: ""
    })
  ];
}
function activeRerunStage(state) {
  const chain = activeRerunChain(state);
  const index = Math.min(Math.max(state.rerunStageIndex ?? 0, 0), chain.length - 1);
  return chain[index];
}
function syncLoopStateWithActiveRerunStage(state) {
  const chain = activeRerunChain(state);
  const index = Math.min(Math.max(state.rerunStageIndex ?? 0, 0), chain.length - 1);
  const stage = chain[index];
  state.rerunChain = chain;
  state.rerunStageIndex = index;
  state.rerunGate = stage.rerunGate;
  state.capabilitySlot = stage.capabilitySlot;
  state.canonicalAgent = stage.canonicalAgent;
  state.targetArtifacts = unique4(stage.targetArtifacts);
  return state;
}
function ensureLoopStateRerunChain(state, input) {
  if ((!state.rerunChain || state.rerunChain.length === 0) && input.rerunChain?.length) {
    state.rerunChain = input.rerunChain.map((stage) => normalizeRerunStage(stage));
    state.rerunStageIndex = 0;
  } else if (!state.rerunChain || state.rerunChain.length === 0) {
    state.rerunChain = [createRerunStageFromInput(input)];
    state.rerunStageIndex = 0;
  }
  return syncLoopStateWithActiveRerunStage(state);
}
function advanceLoopStateToNextRerunStage(state) {
  const chain = activeRerunChain(state);
  const currentIndex = Math.min(Math.max(state.rerunStageIndex ?? 0, 0), chain.length - 1);
  if (currentIndex >= chain.length - 1) {
    return null;
  }
  state.rerunChain = chain;
  state.rerunStageIndex = currentIndex + 1;
  syncLoopStateWithActiveRerunStage(state);
  state.updatedAt = nowIso();
  return activeRerunStage(state);
}
function deriveLoopStateId(input) {
  return sanitizeLoopStateId(
    input.loopStateId ?? `${input.rerunGate}--${input.capabilitySlot}--${input.targetArtifacts.join("-") || "artifacts"}`
  );
}
function governanceAttemptLoopStatePath(projectRoot, loopStateId) {
  return path11.join(
    projectRoot,
    "_bmad-output",
    "runtime",
    "governance",
    "remediation-loops",
    `${sanitizeLoopStateId(loopStateId)}.json`
  );
}
function defaultGovernanceAttemptLoopState(input, loopStateId) {
  const timestamp2 = nowIso();
  const rerunChain = (input.rerunChain?.length ? input.rerunChain : [createRerunStageFromInput(input)]).map(
    (stage) => normalizeRerunStage(stage)
  );
  const firstStage = rerunChain[0];
  return {
    version: 1,
    loopStateId,
    rerunGate: firstStage.rerunGate,
    capabilitySlot: firstStage.capabilitySlot,
    canonicalAgent: firstStage.canonicalAgent,
    targetArtifacts: firstStage.targetArtifacts,
    maxAttempts: input.maxAttempts ?? 3,
    maxNoProgressRepeats: input.maxNoProgressRepeats ?? 1,
    attemptCount: 0,
    noProgressRepeatCount: 0,
    status: "idle",
    lastGateResult: null,
    lastStopReason: null,
    executorRouting: null,
    remediationAuditTraceSummaryLines: [],
    rerunChain,
    rerunStageIndex: 0,
    createdAt: timestamp2,
    updatedAt: timestamp2,
    attempts: []
  };
}
function tryReadRuntimeContext(projectRoot) {
  try {
    return readRuntimeContext(projectRoot);
  } catch {
    return null;
  }
}
function tryReadRuntimeContextRegistry(projectRoot) {
  try {
    return readRuntimeContextRegistry(projectRoot);
  } catch {
    return null;
  }
}
function tryResolveRuntimePolicy(runtimeContext) {
  if (!runtimeContext) {
    return null;
  }
  try {
    return resolveRuntimePolicy({
      flow: runtimeContext.flow,
      stage: runtimeContext.stage,
      epicId: runtimeContext.epicId,
      storyId: runtimeContext.storyId,
      storySlug: runtimeContext.storySlug,
      runId: runtimeContext.runId,
      artifactRoot: runtimeContext.artifactRoot,
      contextSource: runtimeContext.sourceMode
    });
  } catch {
    return null;
  }
}
function readGovernanceAttemptLoopState(projectRoot, loopStateId) {
  const file = governanceAttemptLoopStatePath(projectRoot, loopStateId);
  return JSON.parse(fs10.readFileSync(file, "utf8"));
}
function tryReadGovernanceAttemptLoopState(projectRoot, loopStateId) {
  const file = governanceAttemptLoopStatePath(projectRoot, loopStateId);
  if (!fs10.existsSync(file)) {
    return null;
  }
  return readGovernanceAttemptLoopState(projectRoot, loopStateId);
}
function writeGovernanceAttemptLoopState(projectRoot, state) {
  const file = governanceAttemptLoopStatePath(projectRoot, state.loopStateId);
  fs10.mkdirSync(path11.dirname(file), { recursive: true });
  fs10.writeFileSync(file, JSON.stringify(state, null, 2) + "\n", "utf8");
}
function shouldStopForHumanPrReview(input) {
  return input.rerunGateResult.gate === "bmad_story_stage4" && input.rerunGateResult.status === "pass" && input.nextStage?.rerunGate === "pr_review";
}
function ingestRerunGateResult(state, result) {
  const previous = state.lastGateResult;
  const lastAttempt = state.attempts[state.attempts.length - 1];
  if (lastAttempt) {
    lastAttempt.rerunGateResult = {
      ...result,
      observedAt: result.observedAt ?? nowIso()
    };
  }
  const normalized = {
    ...result,
    observedAt: result.observedAt ?? nowIso()
  };
  if (normalized.status === "fail" && previous?.status === "fail" && blockerSignature(previous) !== "" && blockerSignature(previous) === blockerSignature(normalized)) {
    state.noProgressRepeatCount += 1;
  } else if (normalized.status === "fail") {
    state.noProgressRepeatCount = 0;
  } else {
    state.noProgressRepeatCount = 0;
  }
  state.lastGateResult = normalized;
  state.updatedAt = nowIso();
  return state;
}
function writeLoopStateTraceSummary(input) {
  input.loopState.executorRouting = {
    ...input.executorRouting,
    prioritizedSignals: [...input.executorRouting.prioritizedSignals]
  };
  input.loopState.remediationAuditTraceSummaryLines = buildRemediationAuditTraceSummaryLines(
    input.stopReason ?? void 0,
    input.journeyContractHints,
    input.executorRouting
  );
  if (input.attachToLatestAttempt) {
    const lastAttempt = input.loopState.attempts[input.loopState.attempts.length - 1];
    if (lastAttempt) {
      lastAttempt.executorRouting = {
        ...input.executorRouting,
        prioritizedSignals: [...input.executorRouting.prioritizedSignals]
      };
      lastAttempt.remediationAuditTraceSummaryLines = [
        ...input.loopState.remediationAuditTraceSummaryLines
      ];
    }
  }
  return input.loopState;
}
function buildPacketPrompt(input) {
  const runtimeLines = input.runtimeContext ? [
    `- Flow: ${input.runtimeContext.flow}`,
    `- Stage: ${input.runtimeContext.stage}`,
    `- Scope: ${input.runtimeContext.contextScope ?? "project"}`,
    `- Story ID: ${input.runtimeContext.storyId ?? "(none)"}`,
    `- Run ID: ${input.runtimeContext.runId ?? "(none)"}`,
    `- Artifact Root: ${input.runtimeContext.artifactRoot ?? "(none)"}`
  ] : ["- (none)"];
  const policyLines = input.runtimePolicy ? [
    `- Trigger Stage: ${input.runtimePolicy.triggerStage}`,
    `- Strictness: ${input.runtimePolicy.strictness}`,
    `- Audit Required: ${input.runtimePolicy.auditRequired ? "yes" : "no"}`,
    `- Mandatory Gate: ${input.runtimePolicy.mandatoryGate ? "yes" : "no"}`
  ] : ["- (none)"];
  return [
    "# Governance Remediation Task Packet",
    "",
    "## Runtime Context",
    ...runtimeLines,
    "",
    "## Runtime Policy",
    ...policyLines,
    "",
    "## Attempt Loop State",
    `- Loop State ID: ${input.loopState.loopStateId}`,
    `- Current Attempt Number: ${input.currentAttemptNumber}`,
    `- Attempt Count So Far: ${input.loopState.attemptCount}`,
    `- Max Attempts: ${input.loopState.maxAttempts}`,
    `- No-Progress Repeat Count: ${input.loopState.noProgressRepeatCount}`,
    `- Awaiting Rerun Gate: ${input.rerunGate}`,
    `- Previous Gate Result: ${input.loopState.lastGateResult?.status ?? "none"}`,
    "",
    "## Executor Routing Decision",
    `- Routing Mode: ${input.executorRouting.routingMode}`,
    `- Executor Route: ${input.executorRouting.executorRoute}`,
    `- Packet Strategy: ${input.executorRouting.packetStrategy}`,
    `- Prioritized Signals: ${input.executorRouting.prioritizedSignals.join(", ") || "(none)"}`,
    `- Routing Reason: ${input.executorRouting.reason}`,
    "",
    "## Guardrails",
    "- Do not change blocker ownership.",
    "- Do not change failed-check severity.",
    "- Do not change artifact-derived root target.",
    "- Do not continue downstream while the blocker gate remains open.",
    "",
    "## Success Criteria",
    "- Apply the minimal remediation needed to close the named blockers.",
    "- Update only the target artifacts required by the remediation artifact.",
    `- Leave the work ready for rerun of \`${input.rerunGate}\`.`,
    ...input.executorRouting.routingMode === "targeted" ? [
      "- Resolve the prioritized journey contract signals first and keep the same Journey Slice evidence chain intact."
    ] : [],
    "",
    "## Stop Conditions",
    "- Stop if the rerun gate passes.",
    "- Stop if governance-owned fields would need to change.",
    "- Stop if max attempts is reached or no-progress repeats exceed the policy limit.",
    "",
    "## Targeted Remediation Actions",
    ...buildJourneyContractActionLines(input.journeyContractHints),
    "",
    "## Remediation Artifact",
    "",
    input.artifactMarkdown,
    ""
  ].join("\n");
}
function buildExecutorPacket(input) {
  const executorRouting = input.executorRouting ?? resolveExecutorRouting({
    journeyContractHints: input.journeyContractHints,
    rerunDecision: input.rerunDecision
  });
  const successCriteria = [
    "Apply the minimal remediation needed to close the named blockers.",
    "Update only the target artifacts required by the remediation artifact.",
    `Leave the work ready for rerun of ${input.rerunGate}.`,
    ...executorRouting.routingMode === "targeted" ? [
      "Resolve the prioritized journey contract signals first and keep the same Journey Slice evidence chain intact."
    ] : []
  ];
  return {
    hostKind: input.hostKind,
    executionMode: toExecutionMode(input.hostKind),
    routingMode: executorRouting.routingMode,
    executorRoute: executorRouting.executorRoute,
    prioritizedSignals: executorRouting.prioritizedSignals,
    packetStrategy: executorRouting.packetStrategy,
    routingReason: executorRouting.reason,
    prompt: buildPacketPrompt({
      ...input,
      executorRouting
    }),
    guardrails: [
      "Do not change blocker ownership.",
      "Do not change failed-check severity.",
      "Do not change artifact-derived root target.",
      "Do not continue downstream while the blocker gate remains open."
    ],
    successCriteria,
    stopConditions: [
      "Stop if the rerun gate passes.",
      "Stop if governance-owned fields would need to change.",
      "Stop if max attempts is reached.",
      "Stop if no-progress repeats exceed the policy limit."
    ]
  };
}
function createGovernanceExecutorPacket(input) {
  return buildExecutorPacket(input);
}
function governanceExecutorPacketPath(artifactPath, hostKind) {
  return artifactPath.replace(/\.md$/i, `.${hostKind}-packet.md`);
}
function renderGovernanceExecutorPacket(packet) {
  return [
    "# Governance Remediation Executor Packet",
    "",
    `- Host Kind: ${packet.hostKind}`,
    `- Execution Mode: ${packet.executionMode}`,
    `- Routing Mode: ${packet.routingMode}`,
    `- Executor Route: ${packet.executorRoute}`,
    `- Packet Strategy: ${packet.packetStrategy}`,
    `- Prioritized Signals: ${packet.prioritizedSignals.join(", ") || "(none)"}`,
    `- Routing Reason: ${packet.routingReason}`,
    "",
    "## Guardrails",
    ...packet.guardrails.map((line) => `- ${line}`),
    "",
    "## Success Criteria",
    ...packet.successCriteria.map((line) => `- ${line}`),
    "",
    "## Stop Conditions",
    ...packet.stopConditions.map((line) => `- ${line}`),
    "",
    "## Prompt",
    "",
    packet.prompt,
    ""
  ].join("\n");
}
function writeGovernanceExecutorPacket(artifactPath, packet) {
  const file = governanceExecutorPacketPath(artifactPath, packet.hostKind);
  fs10.mkdirSync(path11.dirname(file), { recursive: true });
  fs10.writeFileSync(file, renderGovernanceExecutorPacket(packet), "utf8");
  return file;
}
async function resolveModelHintsCandidate(input) {
  if (!input.providerAdapter || !input.promptText) {
    return null;
  }
  const adapterInput = {
    projectRoot: input.projectRoot,
    hostKind: input.hostKind,
    promptText: input.promptText,
    stageContextKnown: input.stageContextKnown,
    gateFailureExists: input.gateFailureExists,
    blockerOwnershipLocked: input.blockerOwnershipLocked,
    rootTargetLocked: input.rootTargetLocked,
    equivalentAdapterCount: input.equivalentAdapterCount,
    capabilitySlot: input.capabilitySlot,
    canonicalAgent: input.canonicalAgent,
    actualExecutor: input.actualExecutor,
    targetArtifacts: input.targetArtifacts,
    availableSkills: input.availableSkills,
    skillPaths: input.skillPaths,
    skillInventory: input.skillInventory
  };
  return resolveModelHintsViaGovernanceProvider(adapterInput, input.providerAdapter);
}
function stopResult(input) {
  return {
    artifactPath: null,
    artifactResult: null,
    executionIntentCandidate: input.executionIntentCandidate,
    executionPlanDecision: input.executionPlanDecision,
    journeyContractHints: input.journeyContractHints,
    runtimeContext: input.runtimeContext,
    runtimeRegistry: input.runtimeRegistry,
    runtimePolicy: input.runtimePolicy,
    modelHintsCandidate: input.modelHintsCandidate,
    loopState: input.loopState,
    currentAttemptNumber: input.loopState.attemptCount > 0 ? input.loopState.attemptCount : null,
    nextAttemptNumber: null,
    shouldContinue: false,
    stopReason: input.stopReason,
    rerunGateResultIngested: input.rerunGateResultIngested,
    executorPacket: null,
    packetPaths: {}
  };
}
async function runGovernanceRemediation(input) {
  const loopStateId = deriveLoopStateId(input);
  const runtimeContext = tryReadRuntimeContext(input.projectRoot);
  const runtimeRegistry = tryReadRuntimeContextRegistry(input.projectRoot);
  const runtimePolicy = tryResolveRuntimePolicy(runtimeContext);
  const resolvedSkillInventory = input.availableSkills?.length || input.skillPaths?.length || input.skillInventory?.length ? {
    availableSkills: input.availableSkills ?? [],
    skillPaths: input.skillPaths ?? [],
    skillInventory: input.skillInventory ?? []
  } : resolveGovernanceSkillInventory({
    projectRoot: input.projectRoot,
    hostKind: input.hostKind
  });
  const modelHintsCandidate = await resolveModelHintsCandidate(input);
  const promptHintUsage = resolvePromptHintUsageFromText({
    projectRoot: input.projectRoot,
    promptText: input.promptText,
    stageContextKnown: input.stageContextKnown,
    gateFailure: {
      exists: input.gateFailureExists,
      blockerOwnershipLocked: input.blockerOwnershipLocked
    },
    artifactState: {
      rootTargetLocked: input.rootTargetLocked,
      equivalentAdapterCount: input.equivalentAdapterCount
    },
    modelHintsCandidate,
    availableSkills: resolvedSkillInventory.availableSkills,
    skillPaths: resolvedSkillInventory.skillPaths,
    skillInventory: resolvedSkillInventory.skillInventory
  });
  const executionIntentCandidate = promptHintUsage.executionIntentCandidate;
  const executionPlanDecision = promptHintUsage.executionPlanDecision;
  const journeyContractHints = loadJourneyContractHintsForRuntime(
    input.projectRoot,
    runtimeContext
  );
  let loopState = tryReadGovernanceAttemptLoopState(input.projectRoot, loopStateId) ?? defaultGovernanceAttemptLoopState(input, loopStateId);
  loopState.maxAttempts = input.maxAttempts ?? loopState.maxAttempts;
  loopState.maxNoProgressRepeats = input.maxNoProgressRepeats ?? loopState.maxNoProgressRepeats;
  loopState = ensureLoopStateRerunChain(loopState, input);
  let rerunGateResultIngested = false;
  if (input.rerunGateResult) {
    loopState = ingestRerunGateResult(loopState, input.rerunGateResult);
    rerunGateResultIngested = true;
    if (input.rerunGateResult.status === "pass") {
      const nextStage = advanceLoopStateToNextRerunStage(loopState);
      if (!nextStage) {
        loopState = writeLoopStateTraceSummary({
          loopState,
          stopReason: "rerun gate passed",
          journeyContractHints,
          executorRouting: resolveExecutorRouting({
            journeyContractHints,
            rerunDecision: input.rerunDecision
          })
        });
        loopState.status = "completed";
        loopState.lastStopReason = "rerun gate passed";
        loopState.updatedAt = nowIso();
        writeGovernanceAttemptLoopState(input.projectRoot, loopState);
        return stopResult({
          loopState,
          stopReason: "rerun gate passed",
          runtimeContext,
          runtimeRegistry,
          runtimePolicy,
          rerunGateResultIngested,
          modelHintsCandidate,
          executionIntentCandidate,
          executionPlanDecision,
          journeyContractHints
        });
      }
      if (shouldStopForHumanPrReview({ rerunGateResult: input.rerunGateResult, nextStage })) {
        loopState = writeLoopStateTraceSummary({
          loopState,
          stopReason: "await human review",
          journeyContractHints,
          executorRouting: resolveExecutorRouting({
            journeyContractHints,
            rerunDecision: input.rerunDecision
          })
        });
        loopState.status = "stopped";
        loopState.lastStopReason = "await human review";
        loopState.updatedAt = nowIso();
        writeGovernanceAttemptLoopState(input.projectRoot, loopState);
        return stopResult({
          loopState,
          stopReason: "await human review",
          runtimeContext,
          runtimeRegistry,
          runtimePolicy,
          rerunGateResultIngested,
          modelHintsCandidate,
          executionIntentCandidate,
          executionPlanDecision,
          journeyContractHints
        });
      }
      loopState.status = "idle";
      loopState.lastStopReason = null;
      loopState.updatedAt = nowIso();
    }
    if (loopState.attemptCount >= loopState.maxAttempts) {
      loopState = writeLoopStateTraceSummary({
        loopState,
        stopReason: `max attempts reached (${loopState.maxAttempts})`,
        journeyContractHints,
        executorRouting: resolveExecutorRouting({
          journeyContractHints,
          rerunDecision: input.rerunDecision
        })
      });
      loopState.status = "stopped";
      loopState.lastStopReason = `max attempts reached (${loopState.maxAttempts})`;
      loopState.updatedAt = nowIso();
      writeGovernanceAttemptLoopState(input.projectRoot, loopState);
      return stopResult({
        loopState,
        stopReason: loopState.lastStopReason,
        runtimeContext,
        runtimeRegistry,
        runtimePolicy,
        rerunGateResultIngested,
        modelHintsCandidate,
        executionIntentCandidate,
        executionPlanDecision,
        journeyContractHints
      });
    }
    if (loopState.noProgressRepeatCount >= loopState.maxNoProgressRepeats) {
      loopState = writeLoopStateTraceSummary({
        loopState,
        stopReason: `no-progress repeat limit reached (${loopState.maxNoProgressRepeats})`,
        journeyContractHints,
        executorRouting: resolveExecutorRouting({
          journeyContractHints,
          rerunDecision: input.rerunDecision
        })
      });
      loopState.status = "stopped";
      loopState.lastStopReason = `no-progress repeat limit reached (${loopState.maxNoProgressRepeats})`;
      loopState.updatedAt = nowIso();
      writeGovernanceAttemptLoopState(input.projectRoot, loopState);
      return stopResult({
        loopState,
        stopReason: loopState.lastStopReason,
        runtimeContext,
        runtimeRegistry,
        runtimePolicy,
        rerunGateResultIngested,
        modelHintsCandidate,
        executionIntentCandidate,
        executionPlanDecision,
        journeyContractHints
      });
    }
  }
  const stage = activeRerunStage(loopState);
  const currentAttemptNumber = loopState.attemptCount + 1;
  if (currentAttemptNumber > loopState.maxAttempts) {
    loopState = writeLoopStateTraceSummary({
      loopState,
      stopReason: `max attempts reached (${loopState.maxAttempts})`,
      journeyContractHints,
      executorRouting: resolveExecutorRouting({
        journeyContractHints,
        rerunDecision: input.rerunDecision
      })
    });
    loopState.status = "stopped";
    loopState.lastStopReason = `max attempts reached (${loopState.maxAttempts})`;
    loopState.updatedAt = nowIso();
    writeGovernanceAttemptLoopState(input.projectRoot, loopState);
    return stopResult({
      loopState,
      stopReason: loopState.lastStopReason,
      runtimeContext,
      runtimeRegistry,
      runtimePolicy,
      rerunGateResultIngested,
      modelHintsCandidate,
      executionIntentCandidate,
      executionPlanDecision,
      journeyContractHints
    });
  }
  const absoluteOutputPath = resolveAbsolutePath(input.projectRoot, input.outputPath);
  const sharedArtifactsUpdated = unique4([
    ...input.sharedArtifactsUpdated ?? [],
    ...input.rerunGateResult?.updatedArtifacts ?? []
  ]);
  const executorRouting = resolveExecutorRouting({
    journeyContractHints,
    rerunDecision: input.rerunDecision
  });
  const artifactResult = writeGovernanceRemediationArtifact({
    ...input,
    outputPath: absoluteOutputPath,
    modelHintsCandidate,
    journeyContractHints,
    sourceGateFailureIds: stage.sourceGateFailureIds && stage.sourceGateFailureIds.length > 0 ? stage.sourceGateFailureIds : input.sourceGateFailureIds,
    capabilitySlot: stage.capabilitySlot,
    canonicalAgent: stage.canonicalAgent,
    actualExecutor: stage.actualExecutor ?? input.actualExecutor,
    adapterPath: stage.adapterPath ?? input.adapterPath,
    targetArtifacts: stage.targetArtifacts,
    availableSkills: resolvedSkillInventory.availableSkills,
    skillPaths: resolvedSkillInventory.skillPaths,
    skillInventory: resolvedSkillInventory.skillInventory,
    expectedDelta: stage.expectedDelta || input.expectedDelta,
    rerunOwner: stage.rerunOwner ?? input.rerunOwner,
    rerunGate: stage.rerunGate,
    outcome: stage.outcome ?? input.outcome,
    sharedArtifactsUpdated,
    contradictionsDelta: input.contradictionsDelta ?? input.rerunGateResult?.contradictionsDelta,
    externalProofAdded: input.externalProofAdded ?? input.rerunGateResult?.externalProofAdded,
    readyToRerunGate: input.readyToRerunGate ?? false,
    stopReason: input.stopReason,
    executorRouting
  });
  loopState.attemptCount = currentAttemptNumber;
  loopState.status = "awaiting_rerun";
  loopState.lastStopReason = null;
  loopState.updatedAt = nowIso();
  loopState.attempts.push({
    attemptNumber: currentAttemptNumber,
    attemptId: input.attemptId,
    outputPath: absoluteOutputPath,
    outcome: stage.outcome ?? input.outcome,
    createdAt: loopState.updatedAt,
    sourceGateFailureIds: stage.sourceGateFailureIds && stage.sourceGateFailureIds.length > 0 ? stage.sourceGateFailureIds : input.sourceGateFailureIds
  });
  loopState = writeLoopStateTraceSummary({
    loopState,
    stopReason: input.stopReason ?? null,
    journeyContractHints,
    executorRouting,
    attachToLatestAttempt: true
  });
  writeGovernanceAttemptLoopState(input.projectRoot, loopState);
  const provisionalExecutorPacket = buildExecutorPacket({
    hostKind: input.hostKind,
    runtimeContext,
    runtimePolicy,
    loopState,
    currentAttemptNumber,
    rerunGate: stage.rerunGate,
    artifactMarkdown: artifactResult.markdown,
    journeyContractHints: artifactResult.journeyContractHints,
    rerunDecision: input.rerunDecision,
    executorRouting
  });
  const artifactWithRunnerSummary = {
    ...artifactResult,
    markdown: appendRunnerSummaryToArtifactMarkdown(
      artifactResult.markdown,
      buildGovernanceRemediationRunnerSummaryLines({
        artifactPath: absoluteOutputPath,
        artifactResult,
        executionIntentCandidate,
        executionPlanDecision,
        journeyContractHints: artifactResult.journeyContractHints,
        runtimeContext,
        runtimeRegistry,
        runtimePolicy,
        modelHintsCandidate,
        loopState,
        currentAttemptNumber,
        nextAttemptNumber: currentAttemptNumber + 1,
        shouldContinue: true,
        stopReason: null,
        rerunGateResultIngested,
        executorPacket: provisionalExecutorPacket,
        packetPaths: {}
      })
    )
  };
  fs10.writeFileSync(absoluteOutputPath, artifactWithRunnerSummary.markdown, "utf8");
  const executorPacket = buildExecutorPacket({
    hostKind: input.hostKind,
    runtimeContext,
    runtimePolicy,
    loopState,
    currentAttemptNumber,
    rerunGate: stage.rerunGate,
    artifactMarkdown: artifactWithRunnerSummary.markdown,
    journeyContractHints: artifactWithRunnerSummary.journeyContractHints,
    rerunDecision: input.rerunDecision,
    executorRouting
  });
  return {
    artifactPath: absoluteOutputPath,
    artifactResult: artifactWithRunnerSummary,
    executionIntentCandidate: artifactWithRunnerSummary.executionIntentCandidate ?? executionIntentCandidate,
    executionPlanDecision: artifactWithRunnerSummary.executionPlanDecision ?? executionPlanDecision,
    journeyContractHints: artifactWithRunnerSummary.journeyContractHints,
    runtimeContext,
    runtimeRegistry,
    runtimePolicy,
    modelHintsCandidate,
    loopState,
    currentAttemptNumber,
    nextAttemptNumber: currentAttemptNumber + 1,
    shouldContinue: true,
    stopReason: null,
    rerunGateResultIngested,
    executorPacket,
    packetPaths: {}
  };
}
function parseBooleanFlag2(value, flagName) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Invalid ${flagName}: expected true|false`);
}
function parseList2(value) {
  if (!value) {
    return [];
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
function argValue2(args, flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : void 0;
}
function buildGovernanceRemediationRunnerSummaryLines(result) {
  const lines = [
    "## Governance Remediation Runner Summary",
    `- Loop State ID: ${result.loopState.loopStateId}`,
    `- Current Attempt Number: ${result.currentAttemptNumber ?? "(none)"}`,
    `- Next Attempt Number: ${result.nextAttemptNumber ?? "(none)"}`,
    `- Should Continue: ${result.shouldContinue ? "yes" : "no"}`,
    `- Stop Reason: ${result.stopReason ?? "(none)"}`,
    `- Artifact Path: ${result.artifactPath ?? "(none)"}`,
    `- Executor Packet: ${result.executorPacket ? "yes" : "no"}`,
    "",
    "## Loop State Trace Summary",
    ...result.loopState.remediationAuditTraceSummaryLines.length > 0 ? result.loopState.remediationAuditTraceSummaryLines.map((line) => `- ${line}`) : ["- (none)"]
  ];
  const packetPaths = result.packetPaths ? Object.entries(result.packetPaths).filter((entry) => Boolean(entry[1])) : [];
  if (packetPaths.length > 0) {
    lines.push("");
    lines.push("## Packet Paths");
    for (const [hostKind, packetPath] of packetPaths) {
      lines.push(`- ${hostKind}: ${packetPath}`);
    }
  }
  return lines;
}
function renderGovernanceRemediationRunnerSummary(result) {
  return renderGovernanceRunnerSummaryLines(
    buildGovernanceRemediationRunnerSummaryLines(result)
  );
}
async function main2() {
  const argvTokens = process.argv.map((value) => path11.basename(String(value)).toLowerCase());
  const isDirectRunnerCli = argvTokens.some((value) => value.includes("governance-remediation-runner"));
  if (process.env.BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS === "1") {
    return;
  }
  if (require.main !== module || !isDirectRunnerCli) {
    return;
  }
  const args = process.argv.slice(2);
  const jsonInputPath = argValue2(args, "--jsonInputPath");
  if (jsonInputPath) {
    const payload = JSON.parse(fs10.readFileSync(path11.resolve(jsonInputPath), "utf8"));
    const result2 = await runGovernanceRemediation(payload);
    process.stdout.write(JSON.stringify(result2));
    return;
  }
  const outputPath = argValue2(args, "--outputPath");
  if (!outputPath) {
    throw new Error(
      "Usage: npx ts-node --transpile-only scripts/governance-remediation-runner.ts --outputPath <path> --attemptId <id> --capabilitySlot <slot> --canonicalAgent <agent> --actualExecutor <executor> --adapterPath <path> --expectedDelta <text> --rerunOwner <owner> --rerunGate <gate> --outcome <text> --stageContextKnown true|false --gateFailureExists true|false --blockerOwnershipLocked true|false --rootTargetLocked true|false --equivalentAdapterCount <n> [--projectRoot <path>] [--configPath <path>] [--promptText <text>] [--sourceGateFailureIds a,b] [--targetArtifacts a,b]"
    );
  }
  const projectRoot = argValue2(args, "--projectRoot") ? path11.resolve(argValue2(args, "--projectRoot")) : process.cwd();
  const config = readGovernanceRemediationConfig(projectRoot, argValue2(args, "--configPath"));
  const providerAdapter = createGovernanceProviderAdapterFromConfig(config);
  const result = await runGovernanceRemediation({
    projectRoot,
    outputPath,
    promptText: argValue2(args, "--promptText"),
    stageContextKnown: parseBooleanFlag2(argValue2(args, "--stageContextKnown"), "--stageContextKnown"),
    gateFailureExists: parseBooleanFlag2(argValue2(args, "--gateFailureExists"), "--gateFailureExists"),
    blockerOwnershipLocked: parseBooleanFlag2(
      argValue2(args, "--blockerOwnershipLocked"),
      "--blockerOwnershipLocked"
    ),
    rootTargetLocked: parseBooleanFlag2(argValue2(args, "--rootTargetLocked"), "--rootTargetLocked"),
    equivalentAdapterCount: Number(argValue2(args, "--equivalentAdapterCount") ?? "0"),
    attemptId: argValue2(args, "--attemptId") ?? "attempt-unknown",
    sourceGateFailureIds: parseList2(argValue2(args, "--sourceGateFailureIds")),
    capabilitySlot: argValue2(args, "--capabilitySlot") ?? "unknown-slot",
    canonicalAgent: argValue2(args, "--canonicalAgent") ?? "unknown-agent",
    actualExecutor: argValue2(args, "--actualExecutor") ?? "unknown-executor",
    adapterPath: argValue2(args, "--adapterPath") ?? "unknown-adapter",
    targetArtifacts: parseList2(argValue2(args, "--targetArtifacts")),
    expectedDelta: argValue2(args, "--expectedDelta") ?? "n/a",
    rerunOwner: argValue2(args, "--rerunOwner") ?? "PM",
    rerunGate: argValue2(args, "--rerunGate") ?? "n/a",
    outcome: argValue2(args, "--outcome") ?? "n/a",
    sharedArtifactsUpdated: parseList2(argValue2(args, "--sharedArtifactsUpdated")),
    contradictionsDelta: argValue2(args, "--contradictionsDelta"),
    externalProofAdded: argValue2(args, "--externalProofAdded"),
    readyToRerunGate: argValue2(args, "--readyToRerunGate") ? parseBooleanFlag2(argValue2(args, "--readyToRerunGate"), "--readyToRerunGate") : void 0,
    stopReason: argValue2(args, "--stopReason"),
    hostKind: config.primaryHost,
    providerAdapter,
    maxAttempts: argValue2(args, "--maxAttempts") ? Number(argValue2(args, "--maxAttempts")) : void 0,
    maxNoProgressRepeats: argValue2(args, "--maxNoProgressRepeats") ? Number(argValue2(args, "--maxNoProgressRepeats")) : void 0,
    loopStateId: argValue2(args, "--loopStateId")
  });
  if (!result.executorPacket || !result.artifactPath || !result.artifactResult) {
    console.log(renderGovernanceRemediationRunnerSummary(result));
    return;
  }
  const packetPaths = {};
  for (const hostKind of config.packetHosts) {
    const packet = createGovernanceExecutorPacket({
      hostKind,
      runtimeContext: result.runtimeContext,
      runtimePolicy: result.runtimePolicy,
      loopState: result.loopState,
      currentAttemptNumber: result.currentAttemptNumber ?? result.loopState.attemptCount,
      rerunGate: result.loopState.rerunGate,
      artifactMarkdown: result.artifactResult.markdown,
      journeyContractHints: result.artifactResult.journeyContractHints,
      rerunDecision: {
        mode: result.executorPacket.routingMode,
        signals: result.executorPacket.prioritizedSignals,
        reason: result.executorPacket.routingReason
      },
      executorRouting: {
        routingMode: result.executorPacket.routingMode,
        executorRoute: result.executorPacket.executorRoute,
        prioritizedSignals: result.executorPacket.prioritizedSignals,
        packetStrategy: result.executorPacket.packetStrategy,
        reason: result.executorPacket.routingReason
      }
    });
    packetPaths[hostKind] = writeGovernanceExecutorPacket(result.artifactPath, packet);
  }
  result.packetPaths = packetPaths;
  console.log(renderGovernanceRemediationRunnerSummary(result));
}
void main2();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildGovernanceRemediationRunnerSummaryLines,
  createGovernanceExecutorPacket,
  governanceAttemptLoopStatePath,
  governanceExecutorPacketPath,
  readGovernanceAttemptLoopState,
  renderGovernanceExecutorPacket,
  runGovernanceRemediation,
  writeGovernanceAttemptLoopState,
  writeGovernanceExecutorPacket
});
/*! Bundled license information:

js-yaml/dist/js-yaml.mjs:
  (*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT *)
*/
