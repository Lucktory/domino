import { randomInt } from "node:crypto";
import { TABLE_CODE_ALPHABET, TABLE_CODE_LENGTH } from "@dominio/protocol";

export function generateTableCode(): string {
  let code = "";
  for (let i = 0; i < TABLE_CODE_LENGTH; i++) {
    code += TABLE_CODE_ALPHABET.charAt(randomInt(TABLE_CODE_ALPHABET.length));
  }
  return code;
}
