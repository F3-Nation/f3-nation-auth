import type { AuthUser, AuthTokens, OauthClients, TokenExchangeParams } from "./types";
import fetch from "node-fetch";

/**
 * Configuration for initializing AuthClient.
 */
export interface AuthClientConfig {
  clients: {
    localClient: {
      CLIENT_ID: string;
      CLIENT_SECRET: string;
      REDIRECT_URI: string;
      AUTH_SERVER_URL: string;
    };
    f3AppClient: {
      CLIENT_ID: string;
      CLIENT_SECRET: string;
      REDIRECT_URI: string;
      AUTH_SERVER_URL: string;
    };
    f3App2Client: {
      CLIENT_ID: string;
      CLIENT_SECRET: string;
      REDIRECT_URI: string;
      AUTH_SERVER_URL: string;
    };
  };
}

export class AuthClient {
  private config: AuthClientConfig;

  /**
   * Initialize the AuthClient with OAuth client configs and secrets.
   * @param config AuthClientConfig object
   */
  constructor(config: AuthClientConfig) {
    this.config = config;
  }

  /**
   * Returns public OAuth client configuration (no secrets).
   */
  getOAuthConfig(): OauthClients {
    return {
      localClient: {
        CLIENT_ID: this.config.clients.localClient.CLIENT_ID,
        REDIRECT_URI: this.config.clients.localClient.REDIRECT_URI,
        AUTH_SERVER_URL: this.config.clients.localClient.AUTH_SERVER_URL,
      },
      f3AppClient: {
        CLIENT_ID: this.config.clients.f3AppClient.CLIENT_ID,
        REDIRECT_URI: this.config.clients.f3AppClient.REDIRECT_URI,
        AUTH_SERVER_URL: this.config.clients.f3AppClient.AUTH_SERVER_URL,
      },
      f3App2Client: {
        CLIENT_ID: this.config.clients.f3App2Client.CLIENT_ID,
        REDIRECT_URI: this.config.clients.f3App2Client.REDIRECT_URI,
        AUTH_SERVER_URL: this.config.clients.f3App2Client.AUTH_SERVER_URL,
      },
    };
  }

  /**
   * Exchanges an authorization code for access/refresh tokens.
   * @param params TokenExchangeParams
   * @returns Token response from the auth provider
   */
  async exchangeCodeForToken(params: TokenExchangeParams): Promise<AuthTokens> {
    const clientConfig = this.config.clients[params.clientType];

    if (!clientConfig) {
      throw new Error(`Unknown clientType: ${params.clientType}`);
    }

    const tokenResponse = await fetch(`${clientConfig.AUTH_SERVER_URL}/api/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: clientConfig.REDIRECT_URI,
        client_id: clientConfig.CLIENT_ID,
        client_secret: clientConfig.CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      let errorData;
      try {
        errorData = await tokenResponse.json();
      } catch {
        errorData = { error: "Unknown error" };
      }
      throw new Error(
        `Token exchange failed: ${errorData.error_description || errorData.error || tokenResponse.statusText}`,
      );
    }

    return tokenResponse.json();
  }

  // Existing stub methods (to be implemented)
  async loginWithEmail(_email: string, _password: string): Promise<AuthTokens> {
    // TODO: Implement actual API call to auth-provider
    throw new Error("Not implemented");
  }

  async loginWithGoogle(_googleToken: string): Promise<AuthTokens> {
    // TODO: Implement actual API call to auth-provider
    throw new Error("Not implemented");
  }

  async getUser(_accessToken: string): Promise<AuthUser> {
    // TODO: Implement actual API call to auth-provider
    throw new Error("Not implemented");
  }

  async logout(_refreshToken: string): Promise<void> {
    // TODO: Implement actual API call to auth-provider
    throw new Error("Not implemented");
  }
}
