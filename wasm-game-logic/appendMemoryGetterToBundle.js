const fs = require("fs");
const path = require("path");

let wasmPath = path.join(path.dirname(__filename), "pkg", "wasm_game_logic_bg.js");
let wasmContent = fs.readFileSync(wasmPath, "utf8");
let newContent = wasmContent + "\nexport function getMemory() { return wasm.memory.buffer }";
fs.writeFileSync(wasmPath, newContent);
