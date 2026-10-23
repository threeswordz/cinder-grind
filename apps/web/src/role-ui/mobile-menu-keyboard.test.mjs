import assert from 'node:assert/strict';
import test from 'node:test';
import { dismissMobileNavigation } from './mobile-menu-keyboard.ts';

function keyEvent(key = 'Escape', overrides = {}) {
  return {
    key, defaultPrevented: false, nativeEvent: { isComposing: false },
    prevented: false, stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
    ...overrides,
  };
}

test('Escape from an open mobile navigation closes it and consumes the key', () => {
  const event = keyEvent();
  let open = true;
  dismissMobileNavigation(event, true, open, () => { open = false; });
  assert.equal(open, false);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
});

test('desktop, closed navigation, other keys and consumed/composing keys remain unchanged', () => {
  for (const [mobile, open, event] of [
    [false, true, keyEvent()], [true, false, keyEvent()],
    ...['Tab', 'Enter', 'ArrowDown'].map(key => [true, true, keyEvent(key)]),
    [true, true, keyEvent('Escape', { defaultPrevented: true })],
    [true, true, keyEvent('Escape', { nativeEvent: { isComposing: true } })],
  ]) {
    let closed = false;
    dismissMobileNavigation(event, mobile, open, () => { closed = true; });
    assert.equal(closed, false);
    assert.equal(event.prevented, false);
    assert.equal(event.stopped, false);
  }
});
