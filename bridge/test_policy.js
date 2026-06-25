// Parity check: the browser policy.js forward pass must reproduce SB3's
// deterministic actions on the sample (obs -> action) pairs embedded in policy.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPolicy } from "../web/policy.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const json = JSON.parse(fs.readFileSync(path.join(here, "../web/policy.json"), "utf8"));
const policy = createPolicy(json);

let match = 0, total = 0, mismatches = [];
for (const s of json.samples) {
  const got = policy.forward(s.obs);
  total++;
  if (JSON.stringify(got) === JSON.stringify(s.action)) match++;
  else if (mismatches.length < 5) mismatches.push({ expected: s.action, got });
}
console.log(`obs_size=${json.obs_size} action_dims=${JSON.stringify(json.action_dims)}`);
console.log(`policy parity: ${match}/${total} samples match SB3 deterministic action`);
if (mismatches.length) console.log("mismatches (first few):", JSON.stringify(mismatches));
console.log(match === total ? "POLICY PARITY PASS ✓" : "POLICY PARITY FAIL ✗");
process.exit(match === total ? 0 : 1);
