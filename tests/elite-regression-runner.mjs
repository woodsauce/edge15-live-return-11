import fs from 'node:fs';
import { analyzeTrackerExport, passesEliteDeployGate } from '../src/lib/edge15-regression-test.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node test/sample-regression-runner.mjs path/to/edge15-tracker.json');
  process.exit(1);
}

const json = JSON.parse(fs.readFileSync(file, 'utf8'));
const summary = analyzeTrackerExport(json);
console.log(JSON.stringify(summary, null, 2));
console.log('Deploy gate:', passesEliteDeployGate(summary, 96.4));
