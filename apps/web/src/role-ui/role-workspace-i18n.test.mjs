import assert from 'node:assert/strict';
import test from 'node:test';
import { labels, translate } from './role-workspace-i18n.ts';

test('V1.1-B chrome is complete in English, Thai and Traditional Chinese', () => {
  const baseline = Object.keys(labels.en);
  for (const locale of ['en', 'th', 'zh-TW']) {
    assert.deepEqual(Object.keys(labels[locale]).sort(), baseline.slice().sort(), locale + ' must cover all source chrome keys');
    for (const key of baseline) {
      assert.ok(labels[locale][key].trim().length > 0, locale + ':' + key);
      assert.equal(translate(locale, key, 'FALLBACK'), labels[locale][key]);
    }
  }
});

test('locale display strings do not affect canonical backend codes', () => {
  assert.equal(translate('th', 'statusDraft', 'DRAFT'), 'ฉบับร่าง');
  assert.equal(translate('zh-TW', 'statusRejected', 'REJECTED'), '已駁回');
  assert.equal(translate('en', 'undefinedSourceCode', 'DRAFT'), 'DRAFT');
  assert.equal(translate('zh-TW', 'undefinedSourceCode', 'THB'), 'THB');
});

test('required navigation and My Work labels exist for all locales', () => {
  for (const locale of ['en', 'th', 'zh-TW']) {
    for (const key of ['home', 'work', 'menu', 'signOut', 'context', 'chooseProject',
      'noProject', 'noQueue', 'queueUnavailable', 'sourceOnly', 'open', 'lineOne', 'lineMany',
      'statusDraft', 'statusRejected', 'language', 'loading', 'error']) {
      assert.ok(translate(locale, key, '').trim(), locale + ':' + key);
    }
  }
});
