import type { SiteKey } from '../sites/site-registry';
import { ADMIN_TOKENS } from './tokens-admin';
import { CAR_TOKENS } from './tokens-car';
import { DEV_TOKENS } from './tokens-dev';
import { LAN_TOKENS } from './tokens-lan';
import { MAIN_TOKENS } from './tokens-main';
import type { SiteTokens } from './tokens';

export const ALL_SITE_TOKENS: readonly SiteTokens[] = [MAIN_TOKENS, LAN_TOKENS, CAR_TOKENS, DEV_TOKENS, ADMIN_TOKENS];

export function tokensFor(key: SiteKey): SiteTokens {
  return ALL_SITE_TOKENS.find((t) => t.key === key)!;
}
