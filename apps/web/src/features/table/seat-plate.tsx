import type { ReactNode } from "react";
import { images } from "../../assets/index.ts";
import { Avatar } from "../../components/ui/avatar.tsx";
import { useCopy } from "../../lib/i18n/language.tsx";

/** The last seconds of a turn are shown in red. */
const URGENT_MS = 5000;
/** Countdown arc, in the timer ring's 256-unit drawing: just inside the ring's inner edge (99.5). */
const ARC_RADIUS = 93;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS;

interface SeatPlateProps {
  /**
   * Different plates so nobody confuses the seats: "me" and "partner" (my team, gold and emerald) or
   * "rival" (bronze and burgundy). Hook: .seat-plate-<side>.
   */
  readonly side: "me" | "partner" | "rival";
  /** horizontal: the wide plate artwork. vertical: an upright panel for a seat at the side of the board. */
  readonly orientation?: "horizontal" | "vertical";
  readonly name: string;
  readonly connected: boolean;
  /** Milliseconds left on this seat's clock; null when it is not this seat's turn. */
  readonly remainingMs: number | null;
  readonly totalMs: number;
  readonly strikes: number;
  readonly maxStrikes: number;
  /** Short line under the name (the rival's tile count). */
  readonly detail?: string;
  /** Extra content on the right (the opponent's face-down tiles). */
  readonly children?: ReactNode;
}

/**
 * A seat drawn on the plate artwork (styles.css): the avatar fills the plate's round slot; during this
 * seat's turn the ornate timer ring covers the slot with the countdown arc and the seconds left.
 */
export function SeatPlate({ side, orientation = "horizontal", name, connected, remainingMs, totalMs, strikes, maxStrikes, detail, children }: SeatPlateProps) {
  const copy = useCopy();
  const onClock = remainingMs !== null;
  const fraction = onClock ? Math.min(1, remainingMs / totalMs) : 0;
  const urgent = onClock && remainingMs <= URGENT_MS;
  const seconds = onClock ? Math.ceil(remainingMs / 1000) : 0;

  return (
    <div className={`seat-plate seat-plate-${side} seat-plate-${orientation} ${onClock ? "seat-plate-turn" : ""}`}>
      <div className={`seat-slot ${urgent ? "timer-urgent" : ""}`}>
        <Avatar name={name} size="md" offline={!connected} />
        {onClock && (
          <>
            <img className="timer-ring" src={images.timerRing} alt="" draggable={false} />
            {/* The countdown arc is drawn over the ring so it stays visible. */}
            <svg className="timer-arc" viewBox="0 0 256 256" aria-hidden="true">
              <circle className="timer-track" cx="128" cy="128" r={ARC_RADIUS} />
              <circle
                className="timer-progress"
                cx="128"
                cy="128"
                r={ARC_RADIUS}
                strokeDasharray={ARC_LENGTH}
                strokeDashoffset={ARC_LENGTH * (1 - fraction)}
              />
            </svg>
            <span className="timer-seconds" role="timer" aria-label={copy.secondsLeft(seconds)}>
              {seconds}
            </span>
          </>
        )}
      </div>
      <div className="seat-info">
        {/* Label and name share a line so the plate's bar holds at most two lines. */}
        <p className="seat-title">
          <span className="seat-label">{side === "me" ? copy.you : side === "partner" ? copy.partnerLabel : copy.rivalLabel}</span>
          <span className="seat-name">{name}</span>
        </p>
        <p className="seat-meta">
          {detail !== undefined && <span className="seat-detail">{detail}</span>}
          {!connected && <span className="badge-offline">{copy.offline}</span>}
          {strikes > 0 && <span className="badge-strikes">{copy.strikes(strikes, maxStrikes)}</span>}
        </p>
      </div>
      {children}
    </div>
  );
}
