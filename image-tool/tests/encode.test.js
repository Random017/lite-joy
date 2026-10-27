import { describe, expect, it } from 'vitest';
import { searchQuality } from '../src/core/encode.js';

describe('质量二分搜索', () => {
  it('找到不超过目标体积的最高质量', async () => {
    const encode = async (quality) => ({ size: Math.round(200_000 * quality) });
    const result = await searchQuality({ encode, targetBytes: 100_000 });
    expect(result).not.toBeNull();
    expect(result.blob.size).toBeLessThanOrEqual(100_000);
    expect(result.quality).toBeGreaterThan(0.45);
  });

  it('最低质量仍超标时返回 null', async () => {
    const encode = async () => ({ size: 90_000 });
    const result = await searchQuality({ encode, targetBytes: 50_000 });
    expect(result).toBeNull();
  });

  it('最高质量已达标时返回最高质量', async () => {
    const encode = async (quality) => ({ size: Math.round(10_000 * quality) });
    const result = await searchQuality({
      encode,
      targetBytes: 20_000,
      maxQuality: 0.92,
    });
    expect(result.blob.size).toBeLessThanOrEqual(20_000);
    expect(result.quality).toBeGreaterThan(0.9);
  });
});
