type Fields = Record<string, unknown>;

export interface Logger {
  info(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
}

function serializeError(value: unknown): unknown {
  return value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value;
}

/** One JSON object per line on stdout/stderr, so the host's log viewer can parse it. */
export function createLogger(): Logger {
  const write = (level: "info" | "error", message: string, fields: Fields = {}) => {
    const entry = { time: new Date().toISOString(), level, message, ...fields };
    const line = JSON.stringify(entry, (_key, value: unknown) => serializeError(value));
    if (level === "error") console.error(line);
    else console.log(line);
  };
  return {
    info: (message, fields) => { write("info", message, fields); },
    error: (message, fields) => { write("error", message, fields); },
  };
}
