import type { CSSProperties } from "react";
import { images } from "../../assets/index.ts";

type Spot = readonly [x: number, y: number];

/** Pip positions in a unit square, for a half read top-to-bottom. */
const PIP_SPOTS: Record<number, readonly Spot[]> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.72, 0.28], [0.28, 0.72]],
  3: [[0.72, 0.28], [0.5, 0.5], [0.28, 0.72]],
  4: [[0.29, 0.29], [0.71, 0.29], [0.29, 0.71], [0.71, 0.71]],
  5: [[0.29, 0.29], [0.71, 0.29], [0.5, 0.5], [0.29, 0.71], [0.71, 0.71]],
  6: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.5], [0.7, 0.5], [0.3, 0.75], [0.7, 0.75]],
};

const HALF = 50;
const PIP_RADIUS = 5.4;

function spotsFor(pip: number): readonly Spot[] {
  const spots = PIP_SPOTS[pip];
  if (spots === undefined) throw new Error(`no pip layout for ${pip}`);
  return spots;
}

interface DominoTileProps {
  /** Top half when vertical, left half when horizontal. */
  readonly first: number;
  readonly second: number;
  readonly orientation: "vertical" | "horizontal";
  /** Accessible name; omit for decorative tiles (they are hidden from assistive tech). */
  readonly label?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * The one place a tile is drawn: the ivory face image, then the divider and pips on top, so the
 * numbers are always exact whatever the artwork. Swap the images in assets/ to restyle tiles.
 */
export function DominoTile({ first, second, orientation, label, className, style }: DominoTileProps) {
  const vertical = orientation === "vertical";
  const width = vertical ? HALF : HALF * 2;
  const height = vertical ? HALF * 2 : HALF;

  const pips = [first, second].flatMap((pip, half) =>
    spotsFor(pip).map(([x, y], i) => {
      // Horizontal tiles transpose the layout so a six reads as two rows of three.
      const cx = vertical ? x * HALF : y * HALF + half * HALF;
      const cy = vertical ? y * HALF + half * HALF : x * HALF;
      return (
        <g key={`${half}-${i}`}>
          <circle cx={cx} cy={cy} r={PIP_RADIUS} className="tile-pip" />
          <circle cx={cx - 1.4} cy={cy - 1.6} r={1.5} className="tile-pip-shine" />
        </g>
      );
    }),
  );

  const a11y = label === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": label };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`tile tile-${orientation} ${className ?? ""}`} style={style} {...a11y}>
      <image
        href={vertical ? images.tile.faceVertical : images.tile.faceHorizontal}
        width={width}
        height={height}
        preserveAspectRatio="none"
      />
      {vertical ? (
        <line x1={10} y1={HALF} x2={width - 10} y2={HALF} className="tile-divider" />
      ) : (
        <line x1={HALF} y1={10} x2={HALF} y2={height - 10} className="tile-divider" />
      )}
      {pips}
    </svg>
  );
}

/** A face-down tile (opponent's hand, the draw pile). */
export function TileBack({ className }: { readonly className?: string }) {
  return <img src={images.tile.backVertical} alt="" className={`tile tile-back ${className ?? ""}`} draggable={false} />;
}
