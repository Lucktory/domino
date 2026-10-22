import type { ReactNode } from "react";
import { Avatar } from "./avatar.tsx";

interface HostBubbleProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** Valentina's portrait with a speech bubble: greetings and turn hints. Hook: .host-bubble. */
export function HostBubble({ children, className }: HostBubbleProps) {
  return (
    <div className={`host-bubble ${className ?? ""}`}>
      <Avatar name="" host size="sm" />
      <p className="host-bubble-text">{children}</p>
    </div>
  );
}
