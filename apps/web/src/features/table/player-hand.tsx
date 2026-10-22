import type { Move, Tile, TileId } from "@dominio/engine";
import { DominoTile } from "../../components/ui/domino-tile.tsx";
import { useCopy } from "../../lib/i18n/language.tsx";

interface PlayerHandProps {
  readonly tiles: readonly Tile[];
  readonly legalMoves: readonly Move[];
  readonly selectedTileId: TileId | null;
  readonly myTurn: boolean;
  readonly disabled: boolean;
  readonly onTap: (tileId: TileId) => void;
}

function byValue(a: Tile, b: Tile): number {
  return b.high - a.high || b.low - a.low;
}

/** One scrollable row: the hand never pushes the action buttons off screen, however many tiles it holds. */
export function PlayerHand({ tiles, legalMoves, selectedTileId, myTurn, disabled, onTap }: PlayerHandProps) {
  const copy = useCopy();
  const playable = new Set(legalMoves.map((m) => m.tileId));
  return (
    <div className={myTurn ? "hand hand-my-turn" : "hand"}>
      {[...tiles].sort(byValue).map((tile) => {
        const canPlay = playable.has(tile.id);
        const selected = tile.id === selectedTileId;
        const state = selected ? "selected" : canPlay ? "playable" : "idle";
        return (
          <button
            key={tile.id}
            type="button"
            className={`hand-tile hand-tile-${state}`}
            disabled={disabled || !canPlay}
            aria-pressed={selected}
            onClick={() => {
              onTap(tile.id);
            }}
          >
            <DominoTile first={tile.high} second={tile.low} orientation="vertical" label={copy.tileName(tile.high, tile.low)} />
          </button>
        );
      })}
    </div>
  );
}
