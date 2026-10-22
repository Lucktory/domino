import type { TileId } from "@dominio/engine";
import { z } from "zod";

/** Every message a phone may send. The server parses each one with these schemas. */

const TILE_ID_PATTERN = /^[0-6]-[0-6]$/;

const tileIdSchema = z.custom<TileId>((value) => typeof value === "string" && TILE_ID_PATTERN.test(value), {
  message: "invalid tile id",
});

/** At least one letter or digit, so a name can never be invisible (spaces, zero-width characters). */
const nicknameSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/[\p{L}\p{N}]/u);

export const TABLE_CODE_LENGTH = 6;
/** No 0/O or 1/I, so codes read aloud without confusion. */
export const TABLE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const tableCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(TABLE_CODE_LENGTH)
  .regex(new RegExp(`^[${TABLE_CODE_ALPHABET}]+$`));

/** Game modes a table can be: 1 vs 1, 2 vs 2 in pairs, or 3 / 4 players each for themselves. */
export const GAME_MODES = ["1v1", "2v2", "3p", "4p"] as const;
export type GameMode = (typeof GAME_MODES)[number];

/** Opening a private table (always 1 vs 1 for now). */
export const playerNameInputSchema = z.object({ nickname: nicknameSchema });

/** Starting a quick match in a mode. */
export const quickMatchInputSchema = z.object({ nickname: nicknameSchema, mode: z.enum(GAME_MODES) });

export const joinTableInputSchema = z.object({ code: tableCodeSchema, nickname: nicknameSchema });

export const leaveTableInputSchema = z.object({ tableId: z.uuid() });

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("play"), tileId: tileIdSchema, end: z.enum(["left", "right"]) }),
  z.object({ type: z.literal("draw") }),
  z.object({ type: z.literal("pass") }),
  z.object({ type: z.literal("next-hand") }),
]);

export const gameActionInputSchema = z.object({
  tableId: z.uuid(),
  /** The state version the player was looking at. A mismatch means a stale or repeated tap. */
  expectedVersion: z.int().positive(),
  action: actionSchema,
});

export type PlayerNameInput = z.input<typeof playerNameInputSchema>;
export type QuickMatchInput = z.input<typeof quickMatchInputSchema>;
export type LeaveTableInput = z.input<typeof leaveTableInputSchema>;
export type JoinTableInput = z.input<typeof joinTableInputSchema>;
export type GameActionInput = z.input<typeof gameActionInputSchema>;
