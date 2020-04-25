# Debugging the debugger

This is a small test project to compare deno and node's inspector protocol transmissions.

## Debugging vscode-node2

There may be better ways, but this worked for me:

* git clone https://github.com/microsoft/vscode-node-debug2
* npm install
* gulp build
* Open debug panel
* "Run Extension" - This opens a new editor marked "Extension Development Host"
* Open folder: the folder of this project (ensure the editor is still "Extension Development Host", or restart from previous step)
* Back in vscode-node-debug2 editor's debug panel: "launch as server". This should start multi-session debugging mode, and print something like: "waiting for debug protocol on port 4712"
* Ensure this port, 4712, is specified in this projects .vscode/launch.json's "debugServer" property

To get the output, I opened `node_modules/noice-json-rpc/lib/noice-json-rpc.js`, and modified `_logMessage`
```js
    _logMessage(message, direction) {
        console.log(`Client ${direction === 'send' ? '>' : '<'}`, message);
        if (this._consoleLog) {
            console.log(`Client ${direction === 'send' ? '>' : '<'}`, message);
        }
        if (this._emitLog) {
            this.emit(direction, message);
        }
    }
```

One can now set breakpoints in the vscode-node-debug2 editor, and start debugging sessions in this project.

I just ran `npm install` and `npx tsc` first.

## Test output interactions

For the test output:
* Put a breakpoint on line 2 and 7 in index.ts.
* Started debug session
* It pauses on line 2.
* Step over
* Push Run (F5)
* It pauses on line 7
* Push Run (F5) again
* Session ends

## vscode-deno

Currently using a fork of deno where the compiled filename is added to `ModuleSource` and `CompiledModule`, passed into `mod_new`, and eventually added as `bindings::module_origin`.
Atm it's not quite commitable with lots of `println!()`s, and tests failing as stack traces reference the transpiled files.

Uses https://github.com/gvatn/vscode-deno.
Similarly edited noice-json.
On debug panel, can just "Launch Client" as it stands. I think the debugger should run in it's own process eventually though.

## Observations

Line numbers coming through inspector corresponds to compiled files. Mapping back to .ts would need userland translation with deno-specific knowledge by the debugging plugin used.
Communicating breakpoints is not straightforward without the fork mentioned above. Inspector will report the .ts files as the source, while the plugins will either have mismatched lines (transpiled in inspector vs source in the editor), or if plugin has `outFiles` configured, it will expect the inspector to report transpiled files as the source (while it reports the original .ts files).

As in the mentioned fork, changing module_origin names to transpiled files, gives undesirable stack traces in Deno. Currently, the .ts files is referenced in the stack traces, while the fork currently references transpiled files. A mapping back to .ts files would avoid the regression.

## Other incompatabilities

Deno should be run with the .ts files (probably), while node should be getting the transpiled file as argument. There could be a thin layer that handles this difference, or in unmodified plugins one can setup outFiles and a build step.

At one point the vscode plugin requests evaluation of:
```js
[process.pid, process.version, process.arch]
```
The pid is used. I think version and arch is just used for telemetry. 
There is `Deno.pid`, I don't think there is arch, but just for telemetry. A number is expected from version.

Though not via the above evaluation, the version of node is used to determine which protocol to use: https://github.com/microsoft/vscode-node-debug2/blob/master/src/nodeDebugAdapter.ts#L969

## Source map files
Standard source map from tsc:
```
{"version":3,"file":"index.js","sourceRoot":"","sources":["../src/index.ts"],"names":[],"mappings":"AAAA,SAAS,GAAG,CAAC,CAAS,EAAE,CAAS;IAC7B,OAAO,CAAC,GAAG,CAAC,SAAS,EAAE,CAAC,EAAE,CAAC,CAAC,CAAC;IAC7B,OAAO,CAAC,GAAG,CAAC,CAAC;AACjB,CAAC;AAED,SAAS,GAAG,CAAC,CAAS,EAAE,CAAS;IAC7B,OAAO,CAAC,GAAG,CAAC,CAAC;AACjB,CAAC;AAED,IAAI,CAAC,GAAG,GAAG,CAAC,CAAC,EAAE,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,CAAC,CAAC;AAC1B,OAAO,CAAC,GAAG,CAAC,CAAC,CAAC,CAAC"}
```

Deno source map:
```
{"version":3,"file":"index.js","sourceRoot":"","sources":["file:///home/gudmund/code/ts-test/src/index.ts"],"names":[],"mappings":";AAAA,SAAS,GAAG,CAAC,CAAS,EAAE,CAAS;IAC7B,OAAO,CAAC,GAAG,CAAC,SAAS,EAAE,CAAC,EAAE,CAAC,CAAC,CAAC;IAC7B,OAAO,CAAC,GAAG,CAAC,CAAC;AACjB,CAAC;AAED,SAAS,GAAG,CAAC,CAAS,EAAE,CAAS;IAC7B,OAAO,CAAC,GAAG,CAAC,CAAC;AACjB,CAAC;AAED,IAAI,CAAC,GAAG,GAAG,CAAC,CAAC,EAAE,GAAG,CAAC,CAAC,EAAE,CAAC,CAAC,CAAC,CAAC;AAC1B,OAAO,CAAC,GAAG,CAAC,CAAC,CAAC,CAAC"}
```
Small note `index.js` is referenced, while real file name is `index.ts.js`. Likewise in the bottom of `index.ts.js`, `sourceMappingURL=index.js.map`, while the real file name is index.js.ts.map.

For reference, Deno also outputs a meta file `index.ts.meta`:
```
{"source_path":"/home/gudmund/code/ts-test/src/index.ts","version_hash":"a04083473444d8e91a5277bc3873d9e4c12b75c1d477417fe4fa10856c532034"}
```

## Protocol output

See `protocol-deno.txt` and `protocol-node.txt`. Note that deno is using the patch above, else breakpoints would not stick (when .ts files is used as `module_origin`).

## Suggestion

Align with behaviour of node as much as possible/reasonable to smooth integration with current tooling. There are a variety of plugins that use the information.