const fs = require("fs");

const filePath = process.argv[2];
if (!filePath) throw new Error("Usage: node validate-blueprint-snippet.js <clipboard-text-file>");

const text = fs.readFileSync(filePath, "utf8");
for (const [index, line] of text.split(/\r?\n/).entries()) {
  if ((line.match(/"/g) || []).length % 2 !== 0) {
    throw new Error(`Unbalanced quote on line ${index + 1}`);
  }
}
const nodeBlocks = [...text.matchAll(/^Begin Object Class=.*? Name="([^"]+)"[\s\S]*?^End Object$/gm)];
const nodes = new Map();
const pins = new Map();

for (const [, nodeName] of nodeBlocks) {
  if (nodes.has(nodeName)) throw new Error(`Duplicate node name: ${nodeName}`);
  nodes.set(nodeName, true);
}

for (const [, nodeName] of nodeBlocks) {
  const block = nodeBlocks.find(match => match[1] === nodeName)[0];
  const nodeGuid = block.match(/^\s*NodeGuid=([0-9A-F]{32})$/m)?.[1];
  if (!nodeGuid) throw new Error(`Missing NodeGuid: ${nodeName}`);
  for (const pinMatch of block.matchAll(/CustomProperties Pin \(PinId=([0-9A-F]{32}),.*?\)\s*$/gm)) {
    const pinId = pinMatch[1];
    if (pins.has(pinId)) throw new Error(`Duplicate PinId: ${pinId}`);
    pins.set(pinId, { nodeName, line: pinMatch[0] });
  }
}

for (const [pinId, source] of pins) {
  const linkedText = source.line.match(/LinkedTo=\((.*?)\),PersistentGuid=/)?.[1] || "";
  for (const match of linkedText.matchAll(/([A-Za-z0-9_]+) ([0-9A-F]{32}),/g)) {
    const [, targetNode, targetPinId] = match;
    const target = pins.get(targetPinId);
    if (!nodes.has(targetNode)) throw new Error(`${pinId} links to missing node ${targetNode}`);
    if (!target) throw new Error(`${pinId} links to missing pin ${targetPinId}`);
    if (target.nodeName !== targetNode) {
      throw new Error(`${pinId} expects ${targetNode}, but ${targetPinId} belongs to ${target.nodeName}`);
    }
    const reciprocal = `${source.nodeName} ${pinId},`;
    if (!target.line.includes(reciprocal)) {
      throw new Error(`${pinId} -> ${targetPinId} is not reciprocal`);
    }
  }
}

console.log(`Valid: ${nodes.size} nodes, ${pins.size} pins, all links reciprocal.`);
