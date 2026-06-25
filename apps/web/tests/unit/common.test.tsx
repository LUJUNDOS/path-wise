/**
 * 共用组件单元测试
 * 依据：docs/测试用例文档_v1.0.0.md
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';

describe('ErrorBoundary', () => {
  function ThrowError() {
    throw new Error('test error');
  }

  it('应捕获子组件错误并显示错误界面', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain('页面出现错误');
    expect(container.textContent).toContain('test error');
  });

  it('正常子组件应正确渲染', () => {
    render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('正常内容')).toBeTruthy();
  });

  it('应支持自定义 fallback', () => {
    render(
      <ErrorBoundary fallback={<div>自定义错误界面</div>}>
        <ThrowError />
      </ErrorBoundary>,
    );
    expect(screen.getByText('自定义错误界面')).toBeTruthy();
  });
});

describe('LoadingSpinner', () => {
  it('应渲染加载动画', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('应显示加载文本', () => {
    render(<LoadingSpinner text="加载中..." />);
    expect(screen.getByText('加载中...')).toBeTruthy();
  });

  it('应支持不同尺寸', () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const spinner = container.querySelector('.h-12.w-12');
    expect(spinner).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('应显示默认空状态', () => {
    render(<EmptyState />);
    expect(screen.getByText('暂无数据')).toBeTruthy();
  });

  it('应显示自定义标题和描述', () => {
    render(<EmptyState title="没有攻略" description="请先生成攻略" />);
    expect(screen.getByText('没有攻略')).toBeTruthy();
    expect(screen.getByText('请先生成攻略')).toBeTruthy();
  });

  it('应渲染操作按钮', () => {
    render(<EmptyState action={<button type="button">创建</button>} />);
    expect(screen.getByText('创建')).toBeTruthy();
  });
});
