import type { app } from '@/wailsjs/go/models';

declare global {
  interface Window {
    go: {
      app: {
        App: {
          VerifyAndDecodeJWT(
            tokenString: string,
            keyBytes: number[],
          ): Promise<app.JWTResult>;
        };
      };
    };
    playwrightVerifyJWT(
      tokenString: string,
      keyBytes: number[],
    ): Promise<app.JWTResult>;
  }
}

export {};
