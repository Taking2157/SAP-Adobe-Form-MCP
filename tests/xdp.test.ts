import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockProvider } from '../src/providers/mock.js';
import { decodeAndValidateXdp, analyzeXdp } from '../src/core/xdp.js';

const mock = new MockProvider();

test('mock provider lists and returns SFP details', async () => {
  const forms = await mock.listCustomForms('DEV100', 'Z*', 10);
  assert.equal(forms.length, 2);
  assert.equal((await mock.getFormMetadata('DEV100', 'ZDEMO_INVOICE')).interfaceName, 'ZIF_DEMO_INVOICE');
  assert.equal((await mock.getFormInterface('DEV100', 'ZDEMO_INVOICE')).parameters.length, 2);
  assert.equal((await mock.getFormContext('DEV100', 'ZDEMO_INVOICE')).nodes.length, 2);
});

test('valid XDP yields languages and lifecycle events', async () => {
  const layout = await mock.getFormLayout('DEV100', 'ZDEMO_INVOICE');
  const xml = decodeAndValidateXdp(layout.xdpBase64, 1024 * 1024);
  const analysis = analyzeXdp(xml);
  assert.equal(analysis.scripts.length, 3);
  assert.equal(analysis.summary.byLanguage.FormCalc, 1);
  assert.equal(analysis.summary.byLanguage.JavaScript, 2);
  assert.deepEqual(analysis.fieldNames, ['INVOICE_NO', 'AMOUNT']);
  assert.equal(analysis.summary.byEvent['layout:ready'], 1);
  assert.ok(analysis.summary.findings.some((s) => s.includes('relayout')));
  assert.equal(analysis.scripts[0]?.snippet, undefined);
});

test('rejects non-XDP, malicious entities and size overflow', () => {
  assert.throws(() => decodeAndValidateXdp(Buffer.from('<a/>').toString('base64'), 1000), /XDP root/);
  assert.throws(() => decodeAndValidateXdp(Buffer.from('<!DOCTYPE xdp [<!ENTITY x SYSTEM "file:\/\/\/etc\/passwd">]><xdp:xdp/>').toString('base64'), 1000), /DTD/);
  assert.throws(() => decodeAndValidateXdp('!bad', 1000), /base64/);
  assert.throws(() => decodeAndValidateXdp(Buffer.from('<xdp:xdp/>').toString('base64'), 3), /exceeds/);
});
