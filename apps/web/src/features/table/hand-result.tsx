import { deriveSide, type HandResult, type PlayerView, type Tile } from "@dominio/engine";
import type { SeatView } from "@dominio/protocol";
import { Dialog } from "../../components/ui/dialog.tsx";
import { DominoTile } from "../../components/ui/domino-tile.tsx";
import { useCopy } from "../../lib/i18n/language.tsx";
import type { Messages } from "../../lib/i18n/messages-es.ts";
import type { Outcome } from "./game-moment.ts";
import { OutcomeArt } from "./outcome-art.tsx";

interface HandResultPanelProps {
  readonly game: PlayerView;
  readonly outcome: Outcome;
  readonly seats: readonly (SeatView | null)[];
  readonly pending: boolean;
  readonly onNextHand: () => void;
  readonly onPlayAgain: () => void;
  readonly onLeave: () => void;
}

function nameOf(seats: readonly (SeatView | null)[], seat: number): string {
  const view = seats[seat];
  if (view === undefined || view === null) throw new Error(`seat ${seat} is empty`);
  return view.nickname;
}

function revealedOf(revealed: readonly (readonly Tile[])[], seat: number): readonly Tile[] {
  const tiles = revealed[seat];
  if (tiles === undefined) throw new Error(`no revealed hand for seat ${seat}`);
  return tiles;
}

function pipsOf(result: HandResult, seat: number): number {
  const pips = result.remainingPips[seat];
  if (pips === undefined) throw new Error(`no pip count for seat ${seat}`);
  return pips;
}

interface Table {
  readonly rules: PlayerView["rules"];
  readonly mySeat: number;
  readonly seats: readonly (SeatView | null)[];
}

/** Who left or ran out of time, as seen by this player: themselves, their partner, the other team, or by name. */
function describeLeaver(kind: "forfeit" | "timeout", leaver: number, table: Table, copy: Messages): string {
  const timeout = kind === "timeout";
  if (leaver === table.mySeat) return timeout ? copy.reasonTimeoutYou : copy.reasonForfeitYou;
  if (table.rules.teams === "pairs") {
    const partner = deriveSide(table.rules, leaver) === deriveSide(table.rules, table.mySeat);
    if (partner) return timeout ? copy.reasonTimeoutTeamLoss : copy.reasonForfeitTeamLoss;
    return timeout ? copy.reasonTimeoutTeamWin : copy.reasonForfeitTeamWin;
  }
  if (table.rules.seatCount === 2) return timeout ? copy.reasonTimeoutThey : copy.reasonForfeitThey;
  const name = nameOf(table.seats, leaver);
  return timeout ? copy.reasonTimeoutNamed(name) : copy.reasonForfeitNamed(name);
}

/** The seat that left; only asked for forfeit and timeout endings, which always have one. */
function leaverOf(outcome: Outcome): number {
  if (outcome.leaver === null) throw new Error(`${outcome.reason} without a leaver`);
  return outcome.leaver;
}

/** Title and one-line reason for each outcome; in pairs they speak of teams. */
function describe(outcome: Outcome, table: Table, copy: Messages): { title: string; reason: string } {
  const pairs = table.rules.teams === "pairs";
  const abandoned = outcome.reason === "forfeit" || outcome.reason === "timeout";
  switch (outcome.kind) {
    case "tie": {
      if (outcome.reason === "domino") throw new Error("a domino always has a winner");
      if (outcome.reason === "blocked") return { title: copy.tie, reason: copy.reasonBlockedTie };
      // Someone else left and the players still at the table tied for fewest pips.
      const name = nameOf(table.seats, leaverOf(outcome));
      return { title: copy.tie, reason: outcome.reason === "timeout" ? copy.reasonTimeoutTie(name) : copy.reasonForfeitTie(name) };
    }
    case "win": {
      const title = pairs ? copy.teamWin : copy.youWin;
      if (abandoned) return { title, reason: describeLeaver(outcome.reason === "timeout" ? "timeout" : "forfeit", leaverOf(outcome), table, copy) };
      if (pairs) return { title, reason: outcome.reason === "domino" ? copy.reasonDominoTeamWin : copy.reasonBlockedTeamWin };
      return { title, reason: outcome.reason === "domino" ? copy.reasonDominoYou : copy.reasonBlockedYou };
    }
    case "loss": {
      // Each seat plays for itself unless in pairs, so outside pairs the winning side is a seat.
      const winner = outcome.winnerSide === null || pairs ? null : nameOf(table.seats, outcome.winnerSide);
      const title = pairs ? copy.teamLoss : winner === null ? copy.youLose : copy.theyWin(winner);
      if (abandoned) return { title, reason: describeLeaver(outcome.reason === "timeout" ? "timeout" : "forfeit", leaverOf(outcome), table, copy) };
      if (pairs) return { title, reason: outcome.reason === "domino" ? copy.reasonDominoTeamLoss : copy.reasonBlockedTeamLoss };
      if (winner === null) throw new Error("a played-out loss always has a winner");
      return { title, reason: outcome.reason === "domino" ? copy.reasonDominoThey(winner) : copy.reasonBlockedThey(winner) };
    }
  }
}

function HandTiles({ title, tiles, pips }: { title: string; tiles: readonly Tile[]; pips: number }) {
  const copy = useCopy();
  return (
    <div className="result-hand">
      <p className="result-hand-title">
        <span>{title}</span>
        <span className="result-hand-pips">{copy.points(pips)}</span>
      </p>
      {tiles.length === 0 ? (
        <p className="muted">{copy.noTilesLeft}</p>
      ) : (
        <div className="result-tiles">
          {tiles.map((tile) => (
            <DominoTile
              key={tile.id}
              first={tile.high}
              second={tile.low}
              orientation="vertical"
              label={copy.tileName(tile.high, tile.low)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Result screen. Its look is chosen per outcome through the design hooks
 * .outcome-win | .outcome-loss | .outcome-tie and the OutcomeArt slot.
 */
export function HandResultPanel({ game, outcome, seats, pending, onNextHand, onPlayAgain, onLeave }: HandResultPanelProps) {
  const copy = useCopy();
  const result = game.handResult;
  const revealed = game.revealedHands;
  if (result === null || revealed === null) throw new Error("result panel without a finished hand");

  const pairs = game.rules.teams === "pairs";
  const { title, reason } = describe(outcome, { rules: game.rules, mySeat: game.seat, seats }, copy);
  const mySide = deriveSide(game.rules, game.seat);
  const many = revealed.length > 2;
  // One box per side: in pairs your team's tiles (yours first) and the other team's; otherwise one per seat.
  const boxes = pairs
    ? [true, false].map((ours) => {
        const members = revealed.flatMap((_, seat) => ((deriveSide(game.rules, seat) === mySide) === ours ? [seat] : []));
        if (ours) members.sort((a, b) => (a === game.seat ? -1 : b === game.seat ? 1 : 0));
        return {
          key: ours ? "ours" : "theirs",
          title: ours ? copy.yourTeamTiles : copy.rivalTeamTiles,
          tiles: members.flatMap((seat) => revealedOf(revealed, seat)),
          pips: members.reduce((sum, seat) => sum + pipsOf(result, seat), 0),
        };
      })
    : [game.seat, ...revealed.flatMap((_, seat) => (seat === game.seat ? [] : [seat]))].map((seat) => ({
        key: String(seat),
        // With 3 or 4 players the boxes are narrow: the name alone.
        title: seat === game.seat ? (many ? copy.you : copy.yourTiles) : many ? nameOf(seats, seat) : copy.theirTiles(nameOf(seats, seat)),
        tiles: revealedOf(revealed, seat),
        pips: pipsOf(result, seat),
      }));
  // Leaving and timing out end the match without points.
  const showPoints = outcome.kind !== "tie" && outcome.reason !== "forfeit" && outcome.reason !== "timeout";

  return (
    <Dialog
      title={title}
      variant="full"
      className={`result outcome outcome-${outcome.kind}`}
      lead={<OutcomeArt kind={outcome.kind} />}
    >
      <p className="result-reason">{reason}</p>
      {showPoints && <p className="result-points">{(outcome.kind === "win" ? "+" : "") + copy.points(outcome.points)}</p>}

      <div className="result-hands">
        {boxes.map((box) => (
          <HandTiles key={box.key} title={box.title} tiles={box.tiles} pips={box.pips} />
        ))}
      </div>

      {game.rules.match.kind === "points" && (
        <div className="result-scores">
          <p className="result-hand-title">{copy.score}</p>
          {game.scores.map((score, side) => (
            <p key={side} className="result-score-row">
              <span>{pairs ? (side === mySide ? copy.yourTeamTiles : copy.rivalTeamTiles) : side === game.seat ? copy.you : nameOf(seats, side)}</span>
              <span>{score}</span>
            </p>
          ))}
        </div>
      )}

      <div className="result-actions">
        {game.phase === "finished" ? (
          <>
            <button type="button" className="btn btn-primary btn-wide" data-autofocus disabled={pending} onClick={onPlayAgain}>
              {copy.playAgain}
            </button>
            <button type="button" className="btn btn-ghost btn-wide" disabled={pending} onClick={onLeave}>
              {copy.backToLobby}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-wide" data-autofocus disabled={pending} onClick={onNextHand}>
            {copy.nextHand}
          </button>
        )}
      </div>
    </Dialog>
  );
}
