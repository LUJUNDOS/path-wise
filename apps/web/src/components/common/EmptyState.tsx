import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  title = '暂无数据',
  description,
  className,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-12', className)}>
      {icon ?? <Inbox className="h-12 w-12 text-muted-foreground/50" />}
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground/70 text-center max-w-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
