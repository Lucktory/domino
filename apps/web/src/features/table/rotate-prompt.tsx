import { useEffect, useRef, useState } from "react";
import { images } from "../../assets/index.ts";
import { useCopy } from "../../lib/i18n/language.tsx";

/** Full screen plus a landscape lock: Android Chrome allows it after a tap; iPhones have neither. */
function canLockLandscape(): boolean {
  return document.fullscreenEnabled && "lock" in screen.orientation;
}

/**
 * Covers the table while a phone is upright (styles.css shows it only then): the table is played in
 * landscape. Where the browser allows it, one tap goes full screen and locks landscape; leaving the
 * table gives the phone back its normal rotation.
 */
export function RotatePrompt() {
  const copy = useCopy();
  const [failed, setFailed] = useState(false);
  const locked = useRef(false);

  useEffect(
    () => () => {
      if (!locked.current) return;
      screen.orientation.unlock();
      if (document.fullscreenElement !== null) {
        document.exitFullscreen().catch((error: unknown) => {
          console.error("exit full screen failed", error);
        });
      }
    },
    [],
  );

  const lockLandscape = async () => {
    setFailed(false);
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      locked.current = true;
      await screen.orientation.lock("landscape");
    } catch (error: unknown) {
      console.error("landscape lock failed", error);
      setFailed(true);
    }
  };

  return (
    <div className="rotate-prompt" role="dialog" aria-modal="true" aria-labelledby="rotate-title">
      <img className="rotate-host" src={images.host.offer} alt="" draggable={false} />
      <div className="rotate-phone" aria-hidden="true" />
      <h2 id="rotate-title" className="rotate-title">
        {copy.rotateTitle}
      </h2>
      <p className="rotate-body">{copy.rotateBody}</p>
      {canLockLandscape() && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            void lockLandscape();
          }}
        >
          {copy.rotateButton}
        </button>
      )}
      {failed && (
        <p className="rotate-failed" role="alert">
          {copy.rotateFailed}
        </p>
      )}
    </div>
  );
}
