import { HttpStatus, Injectable, Logger, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { App, applicationDefault, cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { Auth, DecodedIdToken, getAuth } from 'firebase-admin/auth';

import { AppException, ErrorCode } from '../../common/errors';
import { AppConfig } from '../../config/app-config.service';

/** Thin wrapper over firebase-admin so the rest of the app never touches the SDK directly. */
@Injectable()
export class FirebaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App;
  private auth: Auth;
  /** Whether a service account is configured (needed for admin calls, not for verifying tokens). */
  hasCredentials = false;

  constructor(private readonly config: AppConfig) {}

  onModuleInit() {
    const projectId = this.config.get('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get('FIREBASE_PRIVATE_KEY');

    let credential;
    if (clientEmail && privateKey) {
      credential = cert({ projectId, clientEmail, privateKey });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credential = applicationDefault();
    }
    this.hasCredentials = !!credential;

    this.app = initializeApp({ projectId, ...(credential ? { credential } : {}) }, 'friendship-api');
    this.auth = getAuth(this.app);

    const emulator = this.config.get('FIREBASE_AUTH_EMULATOR_HOST');
    this.logger.log(
      `Firebase project "${projectId}"` +
        (emulator ? ` using the Auth Emulator at ${emulator}` : '') +
        (this.hasCredentials ? ' with a service account' : ' (token verification only)'),
    );
  }

  async onModuleDestroy() {
    await deleteApp(this.app);
  }

  /** 401 for a bad token, 500/503 when the problem is on our side. */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    try {
      return await this.auth.verifyIdToken(idToken, this.config.get('FIREBASE_CHECK_REVOKED'));
    } catch (error) {
      const message = (error as Error).message ?? String(error);

      // valid token, but for another Firebase project: our config doesn't match the app
      if (/incorrect "(aud|iss)"/.test(message)) {
        const projectId = this.config.get('FIREBASE_PROJECT_ID');
        this.logger.error(`Token is for a different project than "${projectId}": ${message}`);
        throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL, 'Login verification is misconfigured');
      }

      // couldn't download Google's public keys
      if (message.includes('Error fetching public keys')) {
        this.logger.error(`Cannot reach Google to verify tokens: ${message}`);
        throw new AppException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.INTERNAL, 'Login verification is unavailable');
      }

      // expired, revoked, malformed, bad signature
      this.logger.debug(`Token rejected: ${message}`);
      throw new UnauthorizedException('Invalid or expired Firebase ID token');
    }
  }

  /** Signs the user out of every device: their refresh tokens stop working. */
  async revokeSessions(uid: string): Promise<void> {
    this.requireCredentials();
    await this.auth.revokeRefreshTokens(uid);
  }

  /** Deletes the Firebase account. A no-op without a service account. */
  async deleteUser(uid: string): Promise<void> {
    if (!this.hasCredentials) {
      this.logger.warn(`No service account configured — Firebase user ${uid} was not deleted`);
      return;
    }
    await this.auth.deleteUser(uid).catch((error: { code?: string }) => {
      if (error.code !== 'auth/user-not-found') throw error;
    });
  }

  private requireCredentials() {
    if (!this.hasCredentials) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.INTERNAL,
        'Firebase service account is not configured on the server',
      );
    }
  }
}