import { HostBubble } from "../../components/ui/host-bubble.tsx";
import { useCopy } from "../../lib/i18n/language.tsx";
import type { TurnMoment } from "./game-moment.ts";

interface TurnHintProps {
  readonly moment: TurnMoment;
  readonly theirName: string;
  /** One more timeout loses the match. */
  readonly lastChance: boolean;
  /** Pairs: losing the match loses it for the team, and the warning says so. */
  readonly team: boolean;
}

/** Valentina tells the player what to do. Hook: .host-bubble.moment-<moment>, .hint-last-chance. */
export function TurnHint({ moment, theirName, lastChance, team }: TurnHintProps) {
  const copy = useCopy();
  const text =
    lastChance ? (team ? copy.lastChanceTeam : copy.lastChance)
    : moment === "opening" ? copy.mustOpenWith
    : moment === "choose-end" ? copy.chooseEnd
    : moment === "must-draw" ? copy.noMoveDraw
    : moment === "must-pass" ? copy.noMovePass
    : moment === "play" ? copy.hintPlay
    : moment === "their-turn" ? copy.hintWait(theirName)
    : copy.handOver;
  return <HostBubble className={`moment-${moment} ${lastChance ? "hint-last-chance" : ""}`}>{text}</HostBubble>;
}
