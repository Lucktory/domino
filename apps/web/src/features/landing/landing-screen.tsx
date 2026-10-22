import { images, videos } from "../../assets/index.ts";
import { LanguageToggle } from "../../components/ui/language-toggle.tsx";
import { useCopy } from "../../lib/i18n/language.tsx";
import { REDUCED_MOTION_QUERY, useMediaQuery, WIDE_LAYOUT_QUERY } from "../../lib/media-query.ts";

interface LandingScreenProps {
  readonly onSignUp: () => void;
  readonly onSignIn: () => void;
}

/**
 * Welcome. Upright: the hostess artwork (logo included) fills the screen; real buttons sit on its empty
 * felt. Wide: the welcome video behind the logo and buttons (mounted only there, so upright phones never
 * download it).
 */
export function LandingScreen({ onSignUp, onSignIn }: LandingScreenProps) {
  const copy = useCopy();
  const wide = useMediaQuery(WIDE_LAYOUT_QUERY);
  const calm = useMediaQuery(REDUCED_MOTION_QUERY);
  return (
    <main className="landing">
      <img className="landing-hero" src={images.heroWelcome} alt="" draggable={false} />
      {wide && (
        <div className="landing-media" aria-hidden="true">
          {calm ? (
            <img className="landing-video" src={images.welcomePoster} alt="" draggable={false} />
          ) : (
            // Plays once (no loop) and stays on its last frame.
            <video className="landing-video" src={videos.welcome} poster={images.welcomePoster} autoPlay muted playsInline preload="auto" />
          )}
        </div>
      )}
      <LanguageToggle className="lang-toggle-floating" />
      <section className="landing-actions">
        {/* Landscape crops the artwork to Valentina, so the logo is drawn here instead (hidden in portrait). */}
        <img className="landing-logo" src={images.logo} alt="" draggable={false} />
        <h1 className="visually-hidden">{copy.heroTitle}</h1>
        <p className="landing-tagline">{copy.heroTagline}</p>
        <button type="button" className="btn btn-primary btn-wide" onClick={onSignUp}>
          {copy.heroSignUp}
        </button>
        <button type="button" className="btn btn-ghost btn-wide" onClick={onSignIn}>
          {copy.heroSignIn}
        </button>
        <p className="landing-fine">{copy.heroAdults}</p>
      </section>
    </main>
  );
}
