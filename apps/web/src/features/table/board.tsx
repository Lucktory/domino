import type { BoardEnd, PlacedTile } from "@dominio/engine";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DominoTile } from "../../components/ui/domino-tile.tsx";
import { useCopy } from "../../lib/i18n/language.tsx";
import { computeBoardLayout, computeView, type Rect } from "./board-layout.ts";

interface BoardProps {
  readonly board: readonly PlacedTile[];
  readonly openingIndex: number;
  /** Ends where the selected tile can go; shown as tap targets where the tile would land. */
  readonly targetEnds: readonly BoardEnd[];
  readonly onPickEnd: (end: BoardEnd) => void;
}

/** End badges are circles of this diameter in table units (board-layout.test.ts keeps them in view). */
const BADGE_DIAMETER = 0.85;

/** Size of the board area, which the screen layout fixes (never the tiles), so it cannot feed back. */
function useAreaSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  return { ref, ...size };
}

/**
 * The table every player sees: the same arrangement (laid out in table units) and the same zoom step
 * (derived from the board), scaled as one picture to this screen. Zoom steps animate (styles.css).
 */
export function Board({ board, openingIndex, targetEnds, onPickEnd }: BoardProps) {
  const copy = useCopy();
  const { ref, width, height } = useAreaSize<HTMLDivElement>();
  const layout = computeBoardLayout(board, openingIndex);
  const view = computeView(layout);
  const scale = Math.max(0, Math.min(width / view.w, height / view.h));

  const place = (r: Rect): CSSProperties => ({
    left: (r.x - view.x) * scale,
    top: (r.y - view.y) * scale,
    width: r.w * scale,
    height: r.h * scale,
  });
  const badgeSize = BADGE_DIAMETER * scale;

  return (
    <section className="board" aria-label={copy.boardLabel}>
      {layout.ends !== null && (
        <p className="visually-hidden" aria-live="polite">
          {copy.openEnds(layout.ends.left.pip, layout.ends.right.pip)}
        </p>
      )}
      <div ref={ref} className="board-area">
        {scale > 0 && (
          <div className="board-canvas" style={{ width: view.w * scale, height: view.h * scale }}>
            {layout.tiles.map((t) => (
              <DominoTile
                key={t.placed.tile.id}
                first={t.first}
                second={t.second}
                orientation={t.vertical ? "vertical" : "horizontal"}
                label={copy.tileName(t.placed.left, t.placed.right)}
                className={t.end === null ? "board-tile" : "board-tile board-end"}
                style={place(t)}
              />
            ))}
            {layout.ends !== null &&
              (["left", "right"] as const).map((end) => {
                const badge = layout.ends?.[end];
                if (badge === undefined) return null;
                return (
                  <span
                    key={`badge-${end}`}
                    className="end-badge"
                    aria-hidden="true"
                    style={{
                      left: (badge.x - view.x) * scale,
                      top: (badge.y - view.y) * scale,
                      width: badgeSize,
                      height: badgeSize,
                      fontSize: badgeSize * 0.62,
                    }}
                  >
                    {badge.pip}
                  </span>
                );
              })}
            {targetEnds.map((end) => (
              <button
                key={end}
                type="button"
                className="end-slot"
                aria-label={end === "left" ? copy.endLeft : copy.endRight}
                style={place(layout.slots[end])}
                onClick={() => {
                  onPickEnd(end);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
