import { useCallback, useEffect, useRef, useState } from 'react';
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
import { cn } from '@/lib/utils';
import type { TripConflict } from '@path-wise/shared';

interface ConflictWarningModalProps {
  open: boolean;
  conflicts: TripConflict[];
  onForceGenerate: () => void;
  onBackToEdit: () => void;
  onResolveConflict: (index: number, action: string, value: string) => void;
}

export function ConflictWarningModal({
  open,
  conflicts,
  onForceGenerate,
  onBackToEdit,
  onResolveConflict,
}: ConflictWarningModalProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  // Track previous open state for reset-on-reopen
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open) {
      if (!prevOpenRef.current) {
        // Modal just opened — reset dismissed set
        setDismissed(new Set());
      }
    }
    prevOpenRef.current = open;
  }, [open]);

  // Auto-proceed when all conflicts have been individually resolved
  useEffect(() => {
    if (open && conflicts.length > 0 && dismissed.size >= conflicts.length) {
      onForceGenerate();
    }
  }, [open, conflicts.length, dismissed.size, onForceGenerate]);

  const handleDismiss = useCallback((index: number) => {
    setDismissed((prev) => new Set(prev).add(index));
  }, []);

  const handleResolve = useCallback(
    (index: number, action: string, value: string) => {
      handleDismiss(index);
      onResolveConflict(index, action, value);
    },
    [handleDismiss, onResolveConflict],
  );

  return (
    <Dialog open={open} onOpenChange={() => {}} modal>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            检测到以下可能需要注意的地方
          </DialogTitle>
          <DialogDescription>以下冲突仅为提示，您可以坚持原有选择继续生成</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {conflicts.map((conflict, index) => {
            if (dismissed.has(index)) return null;

            const isWarning = conflict.severity === 'warning';
            return (
              <div
                key={index}
                className={cn(
                  'rounded-lg border p-3',
                  isWarning ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50',
                )}
              >
                <p className="text-sm font-medium">
                  {index + 1}. {conflict.message}
                </p>
                {conflict.suggestion && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleDismiss(index)}
                    >
                      保持当前选择
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        handleResolve(
                          index,
                          conflict.suggestion!.action,
                          conflict.suggestion!.value,
                        )
                      }
                    >
                      调整为{conflict.suggestion.value}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onBackToEdit}>
            返回修改
          </Button>
          <Button onClick={onForceGenerate}>坚持生成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
