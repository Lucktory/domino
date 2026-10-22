import { images } from "../../assets/index.ts";
import type { Outcome } from "./game-moment.ts";

/**
 * Artwork of the full-screen result, one per outcome. Replace the images in assets/ to restyle;
 * the wrapper classes are the design hooks: .outcome-art + .outcome-art-win | -loss | -tie.
 */
export function OutcomeArt({ kind }: { readonly kind: Outcome["kind"] }) {
  return (
    <div className={`outcome-art outcome-art-${kind}`} aria-hidden="true">
      {kind === "win" && <img className="outcome-scene" src={images.result.win} alt="" draggable={false} />}
      {kind === "loss" && <img className="outcome-scene" src={images.result.loss} alt="" draggable={false} />}
      {kind === "tie" && <img className="outcome-host" src={images.host.present} alt="" draggable={false} />}
    </div>
  );
}
