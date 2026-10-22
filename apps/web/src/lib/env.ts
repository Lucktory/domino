function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing ${name}. Copy apps/web/.env.example to apps/web/.env and set it.`);
  }
  return value;
}

export const env = {
  serverUrl: required("VITE_SERVER_URL", import.meta.env.VITE_SERVER_URL),
};
