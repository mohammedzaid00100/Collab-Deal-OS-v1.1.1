export function isTrustedMutationRequest(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const origin = request.headers.get('origin');
  if (!configuredUrl || !origin) return false;
  try {
    return new URL(origin).origin === new URL(configuredUrl).origin;
  } catch {
    return false;
  }
}
