/**
 * Every image and video the app shows, in one place. Generated art: replace a file (same name) to restyle.
 * Images used only from CSS (bg-club-*, felt, plate-*) are referenced in styles.css instead.
 */
import avatar1 from "./avatar-1.webp";
import avatar2 from "./avatar-2.webp";
import avatar3 from "./avatar-3.webp";
import avatar4 from "./avatar-4.webp";
import avatar5 from "./avatar-5.webp";
import heroWelcome from "./hero-welcome.webp";
import hostOffer from "./host-offer.webp";
import hostPortrait from "./host-portrait.webp";
import hostPresent from "./host-present.webp";
import hostThink from "./host-think.webp";
import hostWave from "./host-wave.webp";
import logo from "./logo.webp";
import resultLoss from "./result-loss.webp";
import resultWin from "./result-win.webp";
import roomTable2 from "./room-table-2.webp";
import roomTable2v2 from "./room-table-2v2.webp";
import roomTable3 from "./room-table-3.webp";
import roomTable4 from "./room-table-4.webp";
import roomTablePrivate from "./room-table-private.webp";
import tileBackV from "./tile-back-v.webp";
import tileFaceH from "./tile-face-h.webp";
import tileFaceV from "./tile-face-v.webp";
import timerRing from "./timer-ring.webp";
import vs from "./vs.webp";
import welcomePoster from "./welcome-poster.webp";
import welcomeVideo from "./welcome.mp4";

export const images = {
  logo,
  heroWelcome,
  host: {
    portrait: hostPortrait,
    wave: hostWave,
    present: hostPresent,
    /** Open hand toward the player: the landscape welcome and the "turn your phone" prompt. */
    offer: hostOffer,
    /** Thoughtful, holding a tile: while searching for a rival. */
    think: hostThink,
  },
  result: { win: resultWin, loss: resultLoss },
  /** Lobby card pictures, one per room. */
  room: { oneVsOne: roomTable2, private: roomTablePrivate, twoVsTwo: roomTable2v2, threePlayers: roomTable3, fourPlayers: roomTable4 },
  /** Shown over the player's avatar slot while their turn clock runs. */
  timerRing,
  vs,
  tile: { faceVertical: tileFaceV, faceHorizontal: tileFaceH, backVertical: tileBackV },
  /** Player avatars; a player always gets the same one (see components/ui/avatar.tsx). */
  avatars: [avatar1, avatar2, avatar3, avatar4, avatar5],
  /** First frame of the welcome video: shown while it loads, and instead of it for reduced motion. */
  welcomePoster,
} as const;

export const videos = {
  /** Landscape welcome: Valentina at the club table (8 s, plays once and stays on the last frame). */
  welcome: welcomeVideo,
} as const;
