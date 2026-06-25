/**
 * PageHeader — 页面顶部导航栏共享组件
 *
 * 所有页面 Header 共用同一套 sticky + backdrop-blur 基础样式，
 * 通过 left / right 插槽和 className 覆盖满足各页面差异。
 */
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** 左侧内容（如返回按钮、Logo） */
  left?: ReactNode;
  /** 右侧内容（如操作按钮、主题切换） */
  right?: ReactNode;
  /** 覆盖外层 <header> 的 className（如 z-index、过渡动画） */
  className?: string;
}

export function PageHeader({ left, right, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-lg',
        className,
      )}
    >
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">{left}</div>
        <div className="flex items-center gap-1">{right}</div>
      </div>
    </header>
  );
}
