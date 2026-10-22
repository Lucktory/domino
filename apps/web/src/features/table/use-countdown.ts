import { useEffect, useState } from "react";

const TICK_MS = 200;

/**
 * Milliseconds left until `deadline` (server time), re-rendered a few times a second; null when nobody
 * is on the clock. Only displays the server's clock: the server alone decides when time is up.
 */
export function useCountdown(deadline: number | null, clockOffset: number): number | null {
  const remainingAt = () => (deadline === null ? null : Math.max(0, deadline - (Date.now() + clockOffset)));
  const [remaining, setRemaining] = useState(remainingAt);

  useEffect(() => {
    if (deadline === null) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      setRemaining(Math.max(0, deadline - (Date.now() + clockOffset)));
    };
    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [deadline, clockOffset]);

  return remaining;
}
