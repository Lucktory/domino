import { deriveSide, type Action, type BoardEnd, type PlayerView, type TileId } from "@dominio/engine";
import type { TableView } from "@dominio/protocol";
import { Fragment, useCallback, useState, type ReactNode } from "react";
import { Dialog } from "../../components/ui/dialog.tsx";
import { TileBack } from "../../components/ui/domino-tile.tsx";
import { LanguageToggle } from "../../components/ui/language-toggle.tsx";
import { useCopy } from "../../lib/i18n/language.tsx";
import { Board } from "./board.tsx";
import { deriveOutcome, deriveTurnMoment, isMyMoment } from "./game-moment.ts";
import { HandResultPanel } from "./hand-result.tsx";
import { PlayerHand } from "./player-hand.tsx";
import { SeatPlate } from "./seat-plate.tsx";
import { useCountdown } from "./use-countdown.ts";
import { RotatePrompt } from "./rotate-prompt.tsx";
import { TurnHint } from "./turn-banner.tsx";

interface TableScreenProps {
  readonly table: TableView;
  readonly game: PlayerView;
  readonly pending: boolean;
  readonly onAct: (action: Action) => void;
  /** Leaves the table; during a live match this forfeits it. */
  readonly onLeave: () => void;
  readonly onPlayAgain: () => void;
  /** Server clock minus this phone's clock, for the turn countdown. */
  readonly clockOffset: number;
}

/** Face-down tiles shown on the rival's plate; the count beside them is exact. */
const MAX_BACKS = 10;

function tileCountOf(game: PlayerView, seat: number): number {
  const count = game.tileCounts[seat];
  if (count === undefined) throw new Error(`no tile count for seat ${seat}`);
  return count;
}

function nicknameOf(table: TableView, seat: number): string {
  const view = table.seats[seat];
  if (view === undefined || view === null) throw new Error(`seat ${seat} is empty`);
  return view.nickname;
}

export function TableScreen({ table, game, pending, onAct, onLeave, onPlayAgain, clockOffset }: TableScreenProps) {
  const copy = useCopy();
  /** Tile waiting for the player to pick an end; tied to the version it was picked in. */
  const [selection, setSelection] = useState<{ tileId: TileId; version: number } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const closeConfirm = useCallback(() => {
    setConfirmLeave(false);
  }, []);

  const selectedTileId = selection?.version === game.version ? selection.tileId : null;
  const moment = deriveTurnMoment(game, selectedTileId !== null);
  const myTurn = isMyMoment(moment);
  const outcome = deriveOutcome(game);
  const myName = nicknameOf(table, game.seat);
  const turnName = nicknameOf(table, game.turn);
  const remainingMs = useCountdown(table.turnDeadline, clockOffset);
  const totalMs = game.rules.turnSeconds * 1000;
  const maxStrikes = game.rules.timeoutStrikesToForfeit;
  const strikesOf = (seat: number) => {
    const count = game.timeoutStrikes[seat];
    if (count === undefined) throw new Error(`no strike count for seat ${seat}`);
    return count;
  };
  const clockOf = (seat: number) => (game.phase === "playing" && game.turn === seat ? remainingMs : null);
  // One more timeout would lose the match: say so while the player can still act.
  const lastChance = myTurn && maxStrikes > 1 && strikesOf(game.seat) === maxStrikes - 1;
  const pairs = game.rules.teams === "pairs";
  const seatCount = table.seats.length;
  // Seats around the table as seen from mine, in turn order: the seat that plays after me on the right,
  // the one before me on the left, and with 4 seats the one opposite on top (my partner in pairs).
  // With 2 seats the rival sits on top.
  const sides = seatCount >= 3 ? { left: (game.seat + seatCount - 1) % seatCount, right: (game.seat + 1) % seatCount } : null;
  const top = seatCount === 3 ? [] : [(game.seat + Math.floor(seatCount / 2)) % seatCount];

  const backsOf = (index: number) =>
    Array.from({ length: Math.min(tileCountOf(game, index), MAX_BACKS) }, (_, i) => <TileBack key={i} />);

  /** Another player's plate: wide along the top, or upright at a side of the board. */
  const otherSeat = (index: number, orientation: "horizontal" | "vertical", children?: ReactNode) => {
    const seat = table.seats[index];
    if (seat === undefined || seat === null) throw new Error(`seat ${index} is empty during a match`);
    const partner = pairs && deriveSide(game.rules, index) === deriveSide(game.rules, game.seat);
    return (
      <SeatPlate
        side={partner ? "partner" : "rival"}
        orientation={orientation}
        name={seat.nickname}
        connected={seat.connected}
        remainingMs={clockOf(index)}
        totalMs={totalMs}
        strikes={strikesOf(index)}
        maxStrikes={maxStrikes}
        detail={copy.tiles(tileCountOf(game, index))}
      >
        {children}
      </SeatPlate>
    );
  };

  const movesFor = (tileId: TileId) => game.legalMoves.filter((m) => m.tileId === tileId);
  const targetEnds: BoardEnd[] = selectedTileId === null ? [] : movesFor(selectedTileId).map((m) => m.end);

  const play = (tileId: TileId, end: BoardEnd) => {
    setSelection(null);
    onAct({ type: "play", tileId, end });
  };

  const tapTile = (tileId: TileId) => {
    if (selectedTileId === tileId) {
      setSelection(null);
      return;
    }
    const moves = movesFor(tileId);
    const only = moves.length === 1 ? moves[0] : undefined;
    if (only !== undefined) play(only.tileId, only.end);
    else if (moves.length > 1) setSelection({ tileId, version: game.version });
  };

  return (
    <main className="table-screen">
      <RotatePrompt />

      {/* The felt is the whole screen; everything below floats on it. Hidden while the phone is upright. */}
      <div className={sides === null ? "table-stage" : "table-stage table-stage-sides"}>
        <header className="table-top">
          <button
            type="button"
            className="btn-text table-leave"
            onClick={() => {
              if (game.phase === "finished") onLeave();
              else setConfirmLeave(true);
            }}
          >
            {copy.leave}
          </button>
          <div className="opponents">
            {top.map((index) => (
              <Fragment key={index}>
                {otherSeat(
                  index,
                  "horizontal",
                  <div className="opponent-backs" aria-hidden="true">
                    {backsOf(index)}
                  </div>,
                )}
              </Fragment>
            ))}
          </div>
          <div className="table-corner">
            <LanguageToggle />
            {game.rules.whenNoMove === "draw" && (
              <p className="stock" aria-label={`${copy.stock} ${game.stockCount}`}>
                <TileBack className="stock-icon" />
                <strong>{game.stockCount}</strong>
              </p>
            )}
          </div>
        </header>

        {sides !== null &&
          (["left", "right"] as const).map((position) => (
            <div key={position} className={`side-seat side-seat-${position}`}>
              {otherSeat(sides[position], "vertical")}
              <div className="side-backs" aria-hidden="true">
                {backsOf(sides[position])}
              </div>
            </div>
          ))}

        <Board
          board={game.board}
          openingIndex={game.openingIndex}
          targetEnds={targetEnds}
          onPickEnd={(end) => {
            if (selectedTileId !== null) play(selectedTileId, end);
          }}
        />

        {/* Valentina speaks from just above the player's plate. */}
        <div className="table-hint">
          <TurnHint moment={moment} theirName={turnName} lastChance={lastChance} team={pairs} />
        </div>

        <footer className={myTurn ? "table-bottom me-turn" : "table-bottom"} aria-label={myName}>
          <SeatPlate
            side="me"
            name={myName}
            connected
            remainingMs={clockOf(game.seat)}
            totalMs={totalMs}
            strikes={strikesOf(game.seat)}
            maxStrikes={maxStrikes}
          />
          <div className="hand-tray">
            <PlayerHand
              tiles={game.hand}
              legalMoves={game.legalMoves}
              selectedTileId={selectedTileId}
              myTurn={myTurn}
              disabled={pending || !myTurn}
              onTap={tapTile}
            />
          </div>
          {/* Always present so the hand tray keeps one width; buttons appear only when needed. */}
          <div className="actions">
            {game.canDraw && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={() => {
                  onAct({ type: "draw" });
                }}
              >
                {copy.draw}
              </button>
            )}
            {game.canPass && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={() => {
                  onAct({ type: "pass" });
                }}
              >
                {copy.pass}
              </button>
            )}
          </div>
        </footer>
      </div>

      {confirmLeave && (
        <Dialog title={copy.leaveTitle} onDismiss={closeConfirm}>
          <p className="dialog-body">{pairs ? copy.leaveBodyTeam : seatCount > 2 ? copy.leaveBodySolo : copy.leaveBody}</p>
          <div className="dialog-actions">
            <button type="button" className="btn btn-primary" data-autofocus onClick={closeConfirm}>
              {copy.leaveStay}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={pending}
              onClick={() => {
                setConfirmLeave(false);
                onLeave();
              }}
            >
              {copy.leaveConfirm}
            </button>
          </div>
        </Dialog>
      )}

      {outcome !== null && (
        <HandResultPanel
          game={game}
          outcome={outcome}
          seats={table.seats}
          pending={pending}
          onNextHand={() => {
            onAct({ type: "next-hand" });
          }}
          onPlayAgain={onPlayAgain}
          onLeave={onLeave}
        />
      )}
    </main>
  );
}
