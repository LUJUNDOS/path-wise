import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** confirm 按钮样式：default（确认类操作）、destructive（删除类操作） */
  variant?: 'default' | 'destructive';
  /** 标题旁图标，默认 destructive 时显示 AlertTriangle */
  icon?: React.ReactNode;
  /** 自定义内容（description 与 footer 之间） */
  children?: React.ReactNode;
  /** 阻止 ESC / 点击遮罩关闭，默认 false */
  blocking?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * 通用确认对话框，用于删除攻略、取消生成等需要二次确认的操作。
 * 基于 shadcn/ui Dialog 组装，与 ConflictWarningModal 保持一致的交互模式。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  icon,
  children,
  blocking = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const defaultIcon =
    variant === 'destructive' ? <AlertTriangle className="h-5 w-5 text-destructive" /> : null;

  return (
    <Dialog open={open} onOpenChange={blocking ? () => {} : onOpenChange} modal>
      <DialogContent
        className="max-w-sm"
        onPointerDownOutside={blocking ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={blocking ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon ?? defaultIcon}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {children}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={handleConfirm}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
