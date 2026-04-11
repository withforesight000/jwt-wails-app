import type { I18nContext } from './types';

export function translateBackendMessage(
  t: I18nContext['t'],
  message: string | null | undefined,
): string {
  if (!message) {
    return '';
  }

  const key = `backend.${message}`;
  const translated = t(key);
  return translated === key ? message : translated;
}

export function translateBackendMessages(
  t: I18nContext['t'],
  messages: string[] | null | undefined,
): string[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map((message) => translateBackendMessage(t, message));
}
