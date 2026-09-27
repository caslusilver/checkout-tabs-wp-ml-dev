const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const window = {};
const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'address-ml-modal.js'), 'utf8');
vm.runInNewContext(source, { window, console });
const normalize = window.CCCheckoutTabs.normalizePhoneForCheckout;

test('preserves a Brazilian national number whose DDD is 55', () => {
  const result = normalize('55 91234-5678', 'BR');
  assert.equal(result.wooDigits, '55912345678');
  assert.equal(result.ddiCount, 0);
});

test('removes only the DDI from a full Brazilian number with DDD 55', () => {
  const result = normalize('+55 55 91234-5678', 'BR');
  assert.equal(result.wooDigits, '55912345678');
  assert.equal(result.sourceLength, 13);
  assert.equal(result.ddiCount, 1);
});

test('normalizes legacy digits-only E.164 and landline numbers', () => {
  assert.equal(normalize('5511912345678', 'BR').wooDigits, '11912345678');
  assert.equal(normalize('+55 55 1234-5678', 'BR').wooDigits, '5512345678');
  assert.equal(normalize('55 1234-5678', 'BR').wooDigits, '5512345678');
});

test('recovers a duplicated Brazilian DDI without trimming the last digits', () => {
  const result = normalize('55 55 55 91234-5678', 'BR');
  assert.equal(result.wooDigits, '55912345678');
  assert.equal(result.ddiCount, 2);
});

test('keeps the explicit DDI out of WooCommerce while the number is incomplete', () => {
  const result = normalize('+55 55 91234-56', 'BR');
  assert.equal(result.wooDigits, '559123456');
  assert.equal(result.ddiCount, 1);
});

test('does not guess Brazilian DDI for an explicit foreign country', () => {
  const result = normalize('55 12345-6789', 'PT');
  assert.equal(result.wooDigits, '55123456789');
  assert.equal(result.ddiCount, 0);
  assert.equal(normalize('+351 912 345 678', 'BR').wooDigits, '351912345678');
});

test('rejects an overlong Brazilian number instead of cutting its tail', () => {
  const result = normalize('55119123456789', 'BR');
  assert.equal(result.valid, false);
  assert.equal(result.wooDigits, '');
  assert.equal(result.reason, 'invalid_br_length');
});

test('detects only the old prefix-first truncation before recovering from a full reference', () => {
  const wasTruncated = window.CCCheckoutTabs.isTruncatedBrazilPhone;
  assert.equal(wasTruncated('55559123456', '+55 55 91234-5678'), true);
  assert.equal(wasTruncated('55912345678', '+55 55 91234-5678'), false);
  assert.equal(wasTruncated('55123456789', '+351 912 345 678'), false);
});
