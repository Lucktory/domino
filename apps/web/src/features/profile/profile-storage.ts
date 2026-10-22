import { playerNameInputSchema } from "@dominio/protocol";
import { readStored, removeStored, writeStored } from "../../lib/browser-storage.ts";

/** Until accounts exist, a profile is only the name shown at the table, kept on this device. */
export interface Profile {
  readonly nickname: string;
}

const PROFILE_KEY = "dominio.profile";

/** The trimmed nickname if the server will accept it, else null. Same rule as the server's schema. */
export function validateNickname(raw: string): string | null {
  const parsed = playerNameInputSchema.safeParse({ nickname: raw });
  return parsed.success ? parsed.data.nickname : null;
}

export function readProfile(): Profile | null {
  const raw = readStored(PROFILE_KEY);
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    const nickname = typeof value === "object" && value !== null && "nickname" in value ? value.nickname : null;
    const valid = typeof nickname === "string" ? validateNickname(nickname) : null;
    if (valid === null) console.warn("stored profile is invalid; asking the player to sign in again");
    return valid === null ? null : { nickname: valid };
  } catch (error) {
    console.warn("stored profile is not JSON; asking the player to sign in again", error);
    return null;
  }
}

export function saveProfile(nickname: string): Profile {
  const profile: Profile = { nickname };
  writeStored(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function clearProfile(): void {
  removeStored(PROFILE_KEY);
}
