/**
 * Tailwind 类名合并工具单元测试
 * cn() = clsx + tailwind-merge
 */
import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('应合并多个字符串类名', () => {
    const result = cn('text-red-500', 'bg-blue-100');
    expect(result).toContain('text-red-500');
    expect(result).toContain('bg-blue-100');
  });

  it('应过滤 falsy 值', () => {
    const result = cn(
      'base',
      (false && 'hidden') as string,
      undefined as unknown as string,
      null as unknown as string,
      '' as string,
      (0 && 'zero') as string,
    );
    expect(result).toBe('base');
  });

  it('twMerge 应解决冲突（后者胜）', () => {
    const result = cn('px-2 py-1', 'px-4');
    // px-2 被 px-4 覆盖
    expect(result).toContain('px-4');
    expect(result).not.toContain('px-2');
    expect(result).toContain('py-1');
  });

  it('条件类名', () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn('btn', isActive && 'active', isDisabled && 'disabled');
    expect(result).toContain('btn');
    expect(result).toContain('active');
    expect(result).not.toContain('disabled');
  });

  it('空参数返回空字符串', () => {
    expect(cn()).toBe('');
  });

  it('应支持 classValue 数组', () => {
    const result = cn(['a', 'b'], 'c');
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toContain('c');
  });

  it('应支持对象语法', () => {
    const result = cn({ 'text-bold': true, 'text-hidden': false });
    expect(result).toContain('text-bold');
    expect(result).not.toContain('text-hidden');
  });
});
