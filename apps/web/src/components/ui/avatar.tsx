import { images } from "../../assets/index.ts";

/** Stable index per name, so a player keeps the same face everywhere and on both phones. */
function avatarFor(name: string): string {
  let hash = 0;
  for (const char of name) {
    const code = char.codePointAt(0);
    if (code !== undefined) hash = (hash * 31 + code) % 9973;
  }
  const avatar = images.avatars[hash % images.avatars.length];
  if (avatar === undefined) throw new Error("avatar list is empty");
  return avatar;
}

interface AvatarProps {
  readonly name: string;
  readonly size?: "sm" | "md" | "lg";
  /** Gold glow: it is this player's turn. */
  readonly active?: boolean;
  readonly offline?: boolean;
  /** The hostess portrait instead of a player face. */
  readonly host?: boolean;
}

export function Avatar({ name, size = "md", active = false, offline = false, host = false }: AvatarProps) {
  const classes = ["avatar", `avatar-${size}`];
  if (active) classes.push("avatar-active");
  if (offline) classes.push("avatar-offline");
  return (
    <img
      src={host ? images.host.portrait : avatarFor(name)}
      alt=""
      className={classes.join(" ")}
      draggable={false}
    />
  );
}
