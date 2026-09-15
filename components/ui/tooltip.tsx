"use client";

import { ReactNode, useState } from "react";

type TooltipProps = {
  content: string | ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
};

export function Tooltip({ content, children, side = "top", delay = 200 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setVisible(false);
  };

  const sideClasses = {
    top: "bottom-full mb-2",
    bottom: "top-full mt-2",
    left: "right-full mr-2",
    right: "left-full ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-gray-800 border-l-transparent border-r-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-gray-800 border-l-transparent border-r-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-gray-800 border-t-transparent border-b-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-gray-800 border-t-transparent border-b-transparent border-l-transparent",
  };

  return (
    <div className="relative inline-block" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {visible && (
        <div
          className={`absolute ${sideClasses[side]} z-50 whitespace-nowrap bg-gray-800 text-white text-sm rounded px-2 py-1 pointer-events-none`}
        >
          {content}
          <div className={`absolute w-0 h-0 border-4 ${arrowClasses[side]}`} />
        </div>
      )}
    </div>
  );
}

// Icon button for tooltips
type TooltipIconProps = {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
};

export function TooltipIcon({ tooltip, side = "top" }: TooltipIconProps) {
  return (
    <Tooltip content={tooltip} side={side}>
      <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-gray-500 border border-gray-400 rounded-full cursor-help hover:text-gray-700 hover:border-gray-600">
        ?
      </span>
    </Tooltip>
  );
}
