import { isServer } from 'solid-js/web';
import type { SsrBehavior } from '../types.js';

export const resolveInitialLoading = (ssr?: SsrBehavior) => {
  if (isServer && ssr === 'fallback') {
    return false;
  }

  return true;
};

export const isServerSide = () => isServer;
