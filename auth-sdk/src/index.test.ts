import { describe, it, expect, vi } from "vitest";
import { AuthClient } from ".";
import fetch, { Response } from "node-fetch";

vi.mock("node-fetch");

const mockConfig = {
  client: {
    CLIENT_ID: "test-client-id",
    CLIENT_SECRET: "test-client-secret",
    REDIRECT_URI: "https://test.com/callback",
    AUTH_SERVER_URL: "https://example.com",
  },
};

describe("AuthClient", () => {
  it("should instantiate with a config", () => {
    const client = new AuthClient(mockConfig);
    expect(client).toBeInstanceOf(AuthClient);
  });

  it("should return OAuth config without secrets", () => {
    const client = new AuthClient(mockConfig);
    const config = client.getOAuthConfig();
    expect(config).toEqual({
      CLIENT_ID: "test-client-id",
      REDIRECT_URI: "https://test.com/callback",
      AUTH_SERVER_URL: "https://example.com",
    });
    expect(config).not.toHaveProperty("CLIENT_SECRET");
  });

  describe("exchangeCodeForToken", () => {
    it("should exchange code for tokens", async () => {
      const mockTokens = {
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_in: 3600,
      };
      
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokens),
        status: 200,
        statusText: "OK",
      } as Response);

      const client = new AuthClient(mockConfig);
      const tokens = await client.exchangeCodeForToken({
        code: "test-code",
      });

      expect(tokens).toEqual(mockTokens);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/api/oauth/token",
        expect.objectContaining({
          method: "POST",
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: "test-code",
            redirect_uri: "https://test.com/callback",
            client_id: "test-client-id",
            client_secret: "test-client-secret",
          }),
        })
      );
    });

    it("should throw error when token exchange fails", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: () => Promise.resolve({ error: "invalid_request" }),
      } as Response);

      const client = new AuthClient(mockConfig);
      await expect(
        client.exchangeCodeForToken({ code: "invalid-code" })
      ).rejects.toThrow("Token exchange failed: invalid_request");
    });

    it("should throw generic error when JSON parsing fails", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: () => Promise.reject(new Error("JSON parse error")),
      } as Response);

      const client = new AuthClient(mockConfig);
      await expect(
        client.exchangeCodeForToken({ code: "bad-code" })
      ).rejects.toThrow("Token exchange failed: Unknown error");
    });
  });

  it("loginWithEmail throws not implemented", async () => {
    const client = new AuthClient(mockConfig);
    await expect(client.loginWithEmail("test@example.com", "pw")).rejects.toThrow(
      "Not implemented",
    );
  });

  it("loginWithGoogle throws not implemented", async () => {
    const client = new AuthClient(mockConfig);
    await expect(client.loginWithGoogle("google-token")).rejects.toThrow(
      "Not implemented",
    );
  });

  it("getUser throws not implemented", async () => {
    const client = new AuthClient(mockConfig);
    await expect(client.getUser("access-token")).rejects.toThrow(
      "Not implemented",
    );
  });

  it("logout throws not implemented", async () => {
    const client = new AuthClient(mockConfig);
    await expect(client.logout("refresh-token")).rejects.toThrow(
      "Not implemented",
    );
  });
});
