import { describe, expect, it } from 'vitest';
import { beltFor } from './package-belt';

describe('beltFor', () => {
  it('draws one segment per lesson up to 20', () => {
    expect(beltFor(3, 10)).toEqual({ kind: 'segments', total: 10, filled: 3 });
    expect(beltFor(0, 20)).toEqual({ kind: 'segments', total: 20, filled: 0 });
  });
  it('draws a continuous bar above 20 lessons', () => {
    expect(beltFor(15, 30)).toEqual({ kind: 'bar', percent: 50 });
  });
  it('never fills more than the total or less than nothing', () => {
    expect(beltFor(12, 10)).toEqual({ kind: 'segments', total: 10, filled: 10 });
    expect(beltFor(-1, 10)).toEqual({ kind: 'segments', total: 10, filled: 0 });
  });
});
