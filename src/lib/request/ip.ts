export function getClientIp(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',');
    if (first?.trim()) {
      return first.trim();
    }
  }

  const realIp = headers.get('x-real-ip') || headers.get('x-client-ip');

  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  return 'unknown';
}
