import { openTagDepth, joinContinuation, stripFences } from '../html/completeness';

describe('completeness utilities', () => {
  test('openTagDepth', () => {
    expect(openTagDepth('<div><div>x</div></div>')).toBe(0);
    expect(openTagDepth('<div><div>x</div>')).toBe(1);
    expect(openTagDepth('<div><input class="a"><div cla')).toBe(-1);
    expect(openTagDepth('<div class="screen"><div class="row">Hello</div></div>')).toBe(0);
  });

  test('joinContinuation dedupes overlap', () => {
    expect(
      joinContinuation('<div class="a">hello world, this is long</div>', ', this is long</div></div>')
    ).toBe('<div class="a">hello world, this is long</div></div>');

    expect(
      joinContinuation('<div>Part 1', 'Part 2</div>')
    ).toBe('<div>Part 1Part 2</div>');
  });

  test('stripFences removes markdown code fences', () => {
    expect(stripFences('```html\n<div>hello</div>\n```')).toBe('<div>hello</div>');
    expect(stripFences('```\n<div>hello</div>\n```')).toBe('<div>hello</div>');
    expect(stripFences('<div>hello</div>')).toBe('<div>hello</div>');
  });
});
