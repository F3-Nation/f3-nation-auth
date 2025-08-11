// src/index.ts
import fetch from "node-fetch";
var AuthClient = class {
  /**
   * Initialize the AuthClient with OAuth client config and secrets.
   * @param config AuthClientConfig object
   */
  constructor(config) {
    this.config = config;
  }
  /**
   * Returns public OAuth client configuration (no secrets).
   */
  getOAuthConfig() {
    return {
      CLIENT_ID: this.config.client.CLIENT_ID,
      REDIRECT_URI: this.config.client.REDIRECT_URI,
      AUTH_SERVER_URL: this.config.client.AUTH_SERVER_URL,
    };
  }
  /**
   * Exchanges an authorization code for access/refresh tokens.
   * @param params TokenExchangeParams
   * @returns Token response from the auth provider
   */
  async exchangeCodeForToken(params) {
    const clientConfig = this.config.client;
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
  async loginWithEmail(_email, _password) {
    throw new Error("Not implemented");
  }
  async loginWithGoogle(_googleToken) {
    throw new Error("Not implemented");
  }
  async getUser(_accessToken) {
    throw new Error("Not implemented");
  }
  async logout(_refreshToken) {
    throw new Error("Not implemented");
  }
};
export { AuthClient };
