// Trust proxy resolution.
//
// How many proxy hops Express may trust when resolving req.ip. Kept out of
// server.js so it can be validated and unit-tested without booting the app.

/**
 * Resolves TRUST_PROXY into a value Express understands.
 *
 * Accepted:
 *   unset / '' / 'false' / 'none' / 'off' -> false, trust nothing (DEFAULT)
 *   'true'                                 -> true, trust all proxies (unsafe)
 *   'hop'                                  -> true, for a fixed chain (unsafe)
 *   '<integer 0-64>'                       -> that many hops
 *   'loopback'                             -> Express trust-proxy function
 *   '<comma-separated CIDR list>'          -> Express trust-proxy function
 *
 * The default is deliberately "trust nothing". A hospital LAN install behind
 * Caddy has one hop, but the proxy is a fixed local address: trusting it gains
 * nothing for audit accuracy (every row would say "Caddy") and costs spoofing
 * resistance. Ignoring X-Forwarded-For outright means a client cannot forge an
 * audit identity or mint a fresh rate-limit bucket by setting the header.
 *
 * Returns { trustProxy, description, hops } where `hops` is null for the
 * non-numeric forms.
 */
export function resolveTrustProxy(value) {
  if (value === undefined || value === null) {
    return { trustProxy: false, description: 'disabled (no trusted proxies)', hops: 0 };
  }

  const raw = String(value).trim();

  if (raw === '') {
    return { trustProxy: false, description: 'disabled (no trusted proxies)', hops: 0 };
  }

  const lower = raw.toLowerCase();
  if (lower === 'false' || lower === 'none' || lower === 'off' || lower === '0') {
    return { trustProxy: false, description: 'disabled (no trusted proxies)', hops: 0 };
  }

  // 'true', 'hop', 'loopback' and CIDR lists are all trust-everything or
  // trust-by-subnet forms Express supports natively. They are accepted because
  // they are legitimate, but each carries a spoofing consequence the operator
  // must already understand, so they are logged loudly rather than silently.
  if (lower === 'true' || lower === 'loopback') {
    return {
      trustProxy: true,
      description: 'TRUE -- trusts the entire X-Forwarded-For chain, left-most entry wins',
      hops: null,
    };
  }
  if (lower === 'hop') {
    return {
      trustProxy: 'hop',
      description: 'hop count -- trusts the closest populated hop',
      hops: null,
    };
  }

  if (/^\d+$/.test(raw)) {
    const hops = Number(raw);
    // Express treats a huge number as "count from the right, clamped", which
    // is harmless, but it is far more likely a typo than an intent. Cap it so
    // the mistake surfaces immediately instead of quietly trusting everything.
    if (hops > 64) {
      throw new Error(
        `TRUST_PROXY="${raw}" is not a plausible hop count (max 64).\n` +
          'Count the proxies between the browser and this process. The Render demo uses 3.\n' +
          'If you genuinely want to trust the whole chain, set TRUST_PROXY=true and read ' +
          'the warning logged at startup first -- that form lets a client forge its own IP.'
      );
    }
    return {
      trustProxy: hops,
      description: hops === 0 ? 'disabled (no trusted proxies)' : `${hops} hop${hops === 1 ? '' : 's'}`,
      hops,
    };
  }

  if (/^[0-9a-fA-F:./\s,]+$/.test(raw) && raw.includes(',')) {
    // A subnet list, e.g. "10.0.0.0/8,172.16.0.0/12". Anything only reachable
    // by these networks may set X-Forwarded-For.
    return {
      trustProxy: raw.split(',').map((s) => s.trim()).filter(Boolean),
      description: `subnet list -- trusts proxies in ${raw}`,
      hops: null,
    };
  }

  if (/^[0-9a-fA-F:.]+\/[0-9]+$/.test(raw)) {
    return {
      trustProxy: raw,
      description: `subnet -- trusts proxies in ${raw}`,
      hops: null,
    };
  }

  throw new Error(
    `TRUST_PROXY="${raw}" is not a value I understand.\n` +
      'Accepted: a hop count (0-64), "true", "hop", "loopback", a CIDR block such as ' +
      '"10.0.0.0/8", or a comma-separated list of CIDR blocks.\n' +
      'Leave it unset to trust no proxies, which is the right default for a hospital LAN.'
  );
}