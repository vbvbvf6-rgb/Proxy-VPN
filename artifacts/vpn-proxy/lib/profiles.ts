export type ProxyProtocol =
  | 'vless'
  | 'vmess'
  | 'trojan'
  | 'shadowsocks'
  | 'socks'
  | 'http'
  | 'xray-json';

export interface VPNProfile {
  id: string;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  raw: string;
  addedAt: number;
}

type ProfileInput = Omit<VPNProfile, 'id' | 'addedAt'>;

const protocolLabels: Record<ProxyProtocol, string> = {
  vless: 'VLESS',
  vmess: 'VMess',
  trojan: 'Trojan',
  shadowsocks: 'Shadowsocks',
  socks: 'SOCKS5',
  http: 'HTTP',
  'xray-json': 'JSON',
};

export function getProtocolLabel(protocol: ProxyProtocol): string {
  return protocolLabels[protocol];
}

function decodeBase64(value: string): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const character of normalized) {
    if (character === '=') break;
    const digit = alphabet.indexOf(character);
    if (digit < 0) continue;
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  if (bytes.length === 0) {
    throw new Error('Не удалось прочитать ссылку. Проверьте, что она скопирована полностью.');
  }

  const encoded = bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join('');
  try {
    return decodeURIComponent(encoded);
  } catch {
    return bytes.map((byte) => String.fromCharCode(byte)).join('');
  }
}

function decodeName(fragment: string | undefined, fallback: string): string {
  if (!fragment) return fallback;
  try {
    return decodeURIComponent(fragment.replace(/\+/g, ' ')) || fallback;
  } catch {
    return fragment || fallback;
  }
}

function parsePort(value: string | number | undefined, raw: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`В ссылке указан некорректный порт: ${raw}`);
  }
  return port;
}

function splitEndpoint(endpoint: string): { host: string; port: number } {
  const trimmed = endpoint.trim();
  let host = '';
  let portText = '';

  if (trimmed.startsWith('[')) {
    const closingBracket = trimmed.indexOf(']');
    if (closingBracket < 0 || trimmed[closingBracket + 1] !== ':') {
      throw new Error('Не удалось определить адрес сервера в Shadowsocks-ссылке.');
    }
    host = trimmed.slice(1, closingBracket);
    portText = trimmed.slice(closingBracket + 2);
  } else {
    const separator = trimmed.lastIndexOf(':');
    if (separator < 1) {
      throw new Error('Не удалось определить адрес сервера в ссылке.');
    }
    host = trimmed.slice(0, separator);
    portText = trimmed.slice(separator + 1);
  }

  if (!host) throw new Error('В ссылке не указан адрес сервера.');
  return { host, port: parsePort(portText, endpoint) };
}

function parseVmess(raw: string): ProfileInput {
  const payload = raw.slice('vmess://'.length).split('#')[0];
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(decodeBase64(payload)) as Record<string, unknown>;
  } catch {
    throw new Error('Не удалось прочитать VMess-конфигурацию. Проверьте ссылку.');
  }

  const host = String(parsed.add ?? parsed.server ?? '').trim();
  if (!host) throw new Error('В VMess-конфигурации не найден адрес сервера.');
  const name = String(parsed.ps ?? parsed.name ?? host);
  return {
    name,
    protocol: 'vmess',
    host,
    port: parsePort(parsed.port as string | number | undefined, raw),
    raw,
  };
}

function parseShadowsocks(raw: string): ProfileInput {
  const body = raw.slice('ss://'.length);
  const fragmentIndex = body.indexOf('#');
  const fragment =
    fragmentIndex >= 0 ? decodeName(body.slice(fragmentIndex + 1), '') : '';
  const withoutFragment = fragmentIndex >= 0 ? body.slice(0, fragmentIndex) : body;
  const atIndex = withoutFragment.lastIndexOf('@');
  let credentials = '';
  let endpoint = '';

  if (atIndex >= 0) {
    const encodedCredentials = withoutFragment.slice(0, atIndex);
    endpoint = withoutFragment.slice(atIndex + 1);
    credentials = encodedCredentials.includes(':')
      ? decodeURIComponent(encodedCredentials)
      : decodeBase64(encodedCredentials);
  } else {
    const decoded = decodeBase64(withoutFragment);
    const decodedAtIndex = decoded.lastIndexOf('@');
    if (decodedAtIndex < 0) {
      throw new Error('Не удалось прочитать Shadowsocks-ссылку.');
    }
    credentials = decoded.slice(0, decodedAtIndex);
    endpoint = decoded.slice(decodedAtIndex + 1);
  }

  if (!credentials.includes(':')) {
    throw new Error('В Shadowsocks-ссылке не найдены метод шифрования и пароль.');
  }
  const { host, port } = splitEndpoint(endpoint);
  return {
    name: fragment || host,
    protocol: 'shadowsocks',
    host,
    port,
    raw,
  };
}

function parseProxyUri(rawValue: string): ProfileInput {
  const raw = rawValue.trim();
  const scheme = raw.slice(0, raw.indexOf(':')).toLowerCase();

  if (scheme === 'vmess') return parseVmess(raw);
  if (scheme === 'ss') return parseShadowsocks(raw);
  if (
    scheme !== 'vless' &&
    scheme !== 'trojan' &&
    scheme !== 'socks' &&
    scheme !== 'socks5' &&
    scheme !== 'http'
  ) {
    throw new Error(`Формат ссылки «${scheme || 'неизвестный'}» пока не поддерживается.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Не удалось прочитать ссылку. Проверьте её формат.');
  }

  const host = parsed.hostname;
  if (!host) throw new Error('В ссылке не указан адрес сервера.');
  const port = parsePort(parsed.port, raw);
  const fragment = raw.includes('#') ? raw.slice(raw.indexOf('#') + 1) : '';

  return {
    name: decodeName(fragment, host),
    protocol: scheme === 'socks5' ? 'socks' : scheme,
    host,
    port,
    raw,
  };
}

function getXrayProfiles(value: string): ProfileInput[] {
  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    return [];
  }

  const entries = Array.isArray(decoded) ? decoded : [decoded];
  const configs = entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    if (Array.isArray(record.outbounds)) return [record];
    if (Array.isArray(record.configs)) {
      return record.configs.filter(
        (item): item is Record<string, unknown> =>
          !!item &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          Array.isArray((item as Record<string, unknown>).outbounds),
      );
    }
    return [];
  });

  return configs.map((config) => {
    const outbounds = config.outbounds as Array<Record<string, unknown>>;
    const outbound =
      outbounds.find((item) => {
        const tag = String(item.tag ?? '').toLowerCase();
        const protocol = String(item.protocol ?? '').toLowerCase();
        return (
          !['direct', 'block', 'dns'].includes(tag) &&
          !['freedom', 'blackhole', 'dns'].includes(protocol)
        );
      }) ?? outbounds[0];
    const settings =
      outbound?.settings && typeof outbound.settings === 'object'
        ? (outbound.settings as Record<string, unknown>)
        : {};
    const vnext = Array.isArray(settings.vnext)
      ? (settings.vnext[0] as Record<string, unknown> | undefined)
      : undefined;
    const servers = Array.isArray(settings.servers)
      ? (settings.servers[0] as Record<string, unknown> | undefined)
      : undefined;
    const host = String(
      vnext?.address ??
        servers?.address ??
        settings.address ??
        'Xray JSON',
    );
    const rawPort = vnext?.port ?? servers?.port ?? settings.port;
    const parsedPort = Number(rawPort);
    const protocol = String(outbound?.protocol ?? '').toLowerCase();
    const supportedProtocol: ProxyProtocol[] = [
      'vless',
      'vmess',
      'trojan',
      'shadowsocks',
      'socks',
      'http',
    ];
    const displayProtocol = supportedProtocol.includes(
      protocol as ProxyProtocol,
    )
      ? (protocol as ProxyProtocol)
      : 'xray-json';
    const metadata =
      config.meta && typeof config.meta === 'object'
        ? (config.meta as Record<string, unknown>)
        : {};
    const name = String(
      config.remarks ??
        config.name ??
        metadata.serverDescription ??
        outbound?.tag ??
        host,
    );

    return {
      name,
      protocol: displayProtocol,
      host,
      port:
        Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
          ? parsedPort
          : 0,
      raw: JSON.stringify(config),
    };
  });
}

function expandSubscriptionText(value: string): string[] {
  let text = value.trim().replace(/^\uFEFF/, '');
  if (!text) return [];

  const knownScheme = /^(?:vless|vmess|trojan|ss):\/\//i;
  if (!knownScheme.test(text)) {
    try {
      const decoded = decodeBase64(text);
      const decodedText = decoded.trim();
      if (
        knownScheme.test(decodedText) ||
        decodedText.startsWith('{') ||
        decodedText.startsWith('[') ||
        decoded.includes('\n')
      ) {
        text = decoded;
      }
    } catch {
      // Keep the original text so the caller can report an unsupported format.
    }
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

export async function parseProfiles(input: string): Promise<ProfileInput[]> {
  let text = input.trim();
  if (!text) {
    throw new Error('Вставьте VPN-ссылку или ссылку подписки.');
  }

  const isHttpProxy = /^https?:\/\/[^/\s@]+:[^/\s@]+@[^/\s]+/i.test(text);
  if (/^https?:\/\//i.test(text) && !isHttpProxy) {
    let response: Response;
    try {
      response = await fetch(text);
    } catch {
      throw new Error('Не удалось загрузить подписку. Проверьте ссылку и подключение к интернету.');
    }
    if (!response.ok) {
      throw new Error(`Сервер подписки ответил с ошибкой ${response.status}.`);
    }
    text = await response.text();
  }

  const jsonProfiles = getXrayProfiles(text);
  if (jsonProfiles.length) return jsonProfiles;

  const lines = expandSubscriptionText(text);
  if (lines.length === 0) {
    throw new Error('В подписке не найдено VPN-профилей.');
  }

  const profiles: ProfileInput[] = [];
  const errors: string[] = [];
  for (const line of lines) {
    try {
      profiles.push(parseProxyUri(line));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Не удалось прочитать профиль.');
    }
  }

  if (profiles.length === 0) {
    throw new Error(errors[0] ?? 'В этой ссылке не найден поддерживаемый профиль.');
  }
  return profiles;
}

export function createProfile(profile: ProfileInput): VPNProfile {
  return {
    ...profile,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    addedAt: Date.now(),
  };
}
