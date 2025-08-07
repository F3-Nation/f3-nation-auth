"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AuthClient: () => AuthClient
});
module.exports = __toCommonJS(index_exports);
var import_node_fetch = __toESM(require("node-fetch"), 1);
var AuthClient = class {
  /**
   * Initialize the AuthClient with OAuth client configs and secrets.
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
      localClient: {
        CLIENT_ID: this.config.clients.localClient.CLIENT_ID,
        REDIRECT_URI: this.config.clients.localClient.REDIRECT_URI,
        AUTH_SERVER_URL: this.config.clients.localClient.AUTH_SERVER_URL
      },
      f3AppClient: {
        CLIENT_ID: this.config.clients.f3AppClient.CLIENT_ID,
        REDIRECT_URI: this.config.clients.f3AppClient.REDIRECT_URI,
        AUTH_SERVER_URL: this.config.clients.f3AppClient.AUTH_SERVER_URL
      },
      f3App2Client: {
        CLIENT_ID: this.config.clients.f3App2Client.CLIENT_ID,
        REDIRECT_URI: this.config.clients.f3App2Client.REDIRECT_URI,
        AUTH_SERVER_URL: this.config.clients.f3App2Client.AUTH_SERVER_URL
      }
    };
  }
  /**
   * Exchanges an authorization code for access/refresh tokens.
   * @param params TokenExchangeParams
   * @returns Token response from the auth provider
   */
  async exchangeCodeForToken(params) {
    const clientConfig = this.config.clients[params.clientType];
    if (!clientConfig) {
      throw new Error(`Unknown clientType: ${params.clientType}`);
    }
    const tokenResponse = await (0, import_node_fetch.default)(`${clientConfig.AUTH_SERVER_URL}/api/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: params.code,
        redirect_uri: clientConfig.REDIRECT_URI,
        client_id: clientConfig.CLIENT_ID,
        client_secret: clientConfig.CLIENT_SECRET
      })
    });
    if (!tokenResponse.ok) {
      let errorData;
      try {
        errorData = await tokenResponse.json();
      } catch {
        errorData = { error: "Unknown error" };
      }
      throw new Error(
        `Token exchange failed: ${errorData.error_description || errorData.error || tokenResponse.statusText}`
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthClient
});
