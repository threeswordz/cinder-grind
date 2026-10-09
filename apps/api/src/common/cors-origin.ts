type CorsCallback = (error: Error | null, allow?: boolean) => void;

export function corsOriginPolicy(allowedOrigin: string) {
  return (origin: string | undefined, callback: CorsCallback): void => {
    callback(null, origin === undefined || origin === allowedOrigin);
  };
}
