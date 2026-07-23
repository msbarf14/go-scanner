import { describe, expect, it } from 'vitest';
import { nextRecoveryVariants, recoveryVariantCount } from './preprocess';

describe('nextRecoveryVariants', () => {
  it('limits recovery to two variants per cycle by default', () => {
    expect(nextRecoveryVariants(0)).toEqual(['center_crop', 'contrast']);
  });

  it('rotates variants across cycles', () => {
    expect(nextRecoveryVariants(2)).toEqual(['threshold', 'inverted']);
  });

  it('wraps at the end of the variant list', () => {
    const start = recoveryVariantCount() - 1;
    expect(nextRecoveryVariants(start)).toEqual(['upscale', 'center_crop']);
  });
});
