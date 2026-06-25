import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
}

function Progress({ className, value, ...props }: ProgressProps) {
  return (
    <div
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className,
      )}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-primary transition-all duration-300 ease-in-out"
        style={{ transform: `translateX(-${100 - Math.min(Math.max(value, 0), 100)}%)` }}
      />
    </div>
  );
}

export { Progress };
