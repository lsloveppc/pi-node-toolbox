import { cn } from "../lib/utils";
import { GlowingEffect } from "./GlowingEffect";

interface ToolCardProps {
  index: number;
  title: string;
  onClick: () => void;
  isRunning?: boolean;
  className?: string;
}

export function ToolCard({
  index,
  title,
  onClick,
  isRunning = false,
  className,
}: ToolCardProps) {
  return (
    <li className={cn("list-none", className)}>
      <div className="relative h-full rounded-[1.25rem] border border-slate-200/60 dark:border-slate-700/40 p-3 md:rounded-[1.5rem] md:p-4 bg-white/50 dark:bg-black backdrop-blur-sm shadow-lg transition-all duration-300 hover:scale-[1.02]">
        <GlowingEffect
          spread={40}
          variant="blue-purple"
          movementDuration={2}
        />
        <div className="relative flex flex-col gap-3">
          {/* Top: number circle + title */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <span className="text-base font-bold text-white">{index}</span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
              {title}
            </h3>
          </div>

          {/* Bottom: execute button */}
          <button
            onClick={onClick}
            disabled={isRunning}
            className={cn(
              "w-full py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200",
              "bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400",
              "text-white shadow-md shadow-purple-600/20",
              "border border-purple-400/30",
              isRunning && "opacity-60 cursor-wait"
            )}
          >
            {isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                执行中
              </span>
            ) : (
              "执行"
            )}
          </button>
        </div>
      </div>
    </li>
  );
}
