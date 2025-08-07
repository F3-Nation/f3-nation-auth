interface AuthUser {
    id: string;
    email: string;
    name?: string;
    [key: string]: unknown;
}
interface AuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
    [key: string]: unknown;
}
interface OauthClient {
    CLIENT_ID: string;
    REDIRECT_URI: string;
    AUTH_SERVER_URL: string;
}
interface TokenExchangeParams {
    code: string;
}
interface ClientConfig {
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    REDIRECT_URI: string;
    AUTH_SERVER_URL: string;
}

/**
 * Configuration for initializing AuthClient.
 */
interface AuthClientConfig {
    client: ClientConfig;
}
declare class AuthClient {
    private config;
    /**
     * Initialize the AuthClient with OAuth client config and secrets.
     * @param config AuthClientConfig object
     */
    constructor(config: AuthClientConfig);
    /**
     * Returns public OAuth client configuration (no secrets).
     */
    getOAuthConfig(): OauthClient;
    /**
     * Exchanges an authorization code for access/refresh tokens.
     * @param params TokenExchangeParams
     * @returns Token response from the auth provider
     */
    exchangeCodeForToken(params: TokenExchangeParams): Promise<AuthTokens>;
    loginWithEmail(_email: string, _password: string): Promise<AuthTokens>;
    loginWithGoogle(_googleToken: string): Promise<AuthTokens>;
    getUser(_accessToken: string): Promise<AuthUser>;
    logout(_refreshToken: string): Promise<void>;
}

export { AuthClient, type AuthClientConfig };
