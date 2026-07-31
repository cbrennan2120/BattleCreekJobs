declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

export function env(name: string): string | undefined {
  if (typeof Netlify !== "undefined") return Netlify.env.get(name);
  return process.env[name];
}

export function requiredEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function isNetlifyRuntime(): boolean {
  return env("NETLIFY") === "true" || Boolean(env("CONTEXT"));
}
