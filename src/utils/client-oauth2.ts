import Querystring, { ParsedUrlQueryInput } from 'querystring';
import fetch, { HeadersInit } from 'node-fetch';

/**
 * Default headers for executing OAuth 2.0 flows.
 */
const DEFAULT_HEADERS = {
  Accept: 'application/json, application/x-www-form-urlencoded',
  'Content-Type': 'application/x-www-form-urlencoded',
};

/**
 * Format error response types to regular strings for displaying to clients.
 *
 * Reference: http://tools.ietf.org/html/rfc6749#section-4.1.2.1
 */
const ERROR_RESPONSES = {
  invalid_request: [
    'The request is missing a required parameter, includes an',
    'invalid parameter value, includes a parameter more than',
    'once, or is otherwise malformed.',
  ].join(' '),
  invalid_client: [
    'Client authentication failed (e.g., unknown client, no',
    'client authentication included, or unsupported',
    'authentication method).',
  ].join(' '),
  invalid_grant: [
    'The provided authorization grant (e.g., authorization',
    'code, resource owner credentials) or refresh token is',
    'invalid, expired, revoked, does not match the redirection',
    'URI used in the authorization request, or was issued to',
    'another client.',
  ].join(' '),
  unauthorized_client: [
    'The client is not authorized to request an authorization',
    'code using this method.',
  ].join(' '),
  unsupported_grant_type: [
    'The authorization grant type is not supported by the',
    'authorization server.',
  ].join(' '),
  access_denied: ['The resource owner or authorization server denied the request.'].join(' '),
  unsupported_response_type: [
    'The authorization server does not support obtaining',
    'an authorization code using this method.',
  ].join(' '),
  invalid_scope: ['The requested scope is invalid, unknown, or malformed.'].join(' '),
  server_error: [
    'The authorization server encountered an unexpected',
    'condition that prevented it from fulfilling the request.',
    '(This error code is needed because a 500 Internal Server',
    'Error HTTP status code cannot be returned to the client',
    'via an HTTP redirect.)',
  ].join(' '),
  temporarily_unavailable: [
    'The authorization server is currently unable to handle',
    'the request due to a temporary overloading or maintenance',
    'of the server.',
  ].join(' '),
};

type OAuth2RequestOptions = {
  url: string;
  body: ParsedUrlQueryInput;
  query: ParsedUrlQueryInput;
  headers: HeadersInit;
  method: string;
};

type ClientOAuth2Options = Partial<OAuth2RequestOptions> & {
  clientId: string;
  clientSecret: string;
  accessTokenUri: string;
  scopes: string[];
};

type Data = {
  [key: string]: string;
};

export class OAuth2Error extends Error {
  status?: number;
  body?: any;
  code?: string;

  constructor(message: string) {
    super(message);
  }
}

export class OAuth2Token {
  public client: ClientOAuth2;
  public data: Data;
  public tokenType: string;
  public accessToken: string;
  public refreshToken: string;
  public expires: Date | undefined;

  /**
   * General purpose client token generator.
   */
  constructor(client: ClientOAuth2, data: Data) {
    this.client = client;
    this.data = data;
    this.tokenType = data.token_type && data.token_type.toLowerCase();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;

    this.expiresIn(Number(data.expires_in));
  }

  /**
   * Expire the token after some time.
   */
  expiresIn(duration: number | Date): Date {
    if (typeof duration === 'number') {
      this.expires = new Date();
      this.expires.setSeconds(this.expires.getSeconds() + duration);
    } else if (duration instanceof Date) {
      this.expires = new Date(duration.getTime());
    } else {
      throw new TypeError('Unknown duration: ' + duration);
    }

    return this.expires;
  }

  /**
   * Refresh a user access token with the supplied token.
   */
  async refresh(opts?: ClientOAuth2Options): Promise<OAuth2Token> {
    const options = opts ? { ...this.client.options, ...opts } : this.client.options;

    if (!this.refreshToken) {
      return Promise.reject(new Error('No refresh token'));
    }

    const reqOptions = this.client.requestOptions(
      {
        url: options.accessTokenUri,
        method: 'POST',
        headers: DEFAULT_HEADERS,
        body: {
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
          client_id: options.clientId,
          client_secret: options.clientSecret,
        },
      },
      options
    );

    const data: Data = await this.client.request(reqOptions);

    return this.client.createToken({ ...this.data, ...data });
  }

  /**
   * Check whether the token has expired.
   */
  expired(): boolean {
    return !!this.expires && Date.now() > this.expires.getTime();
  }
}

export class ClientOAuth2 {
  public options: ClientOAuth2Options;

  /**
   * Construct an object that can handle the credentials OAuth 2.0 flow.
   */
  constructor(options: ClientOAuth2Options) {
    this.options = options;
  }

  /**
   * Sanitize the scopes option to be a string.
   */
  sanitizeScope(scopes: string[]): string {
    return Array.isArray(scopes) ? scopes.join(' ') : '';
  }

  /**
   * Request an access token using the client credentials.
   */
  async getToken(opts?: ClientOAuth2Options): Promise<OAuth2Token> {
    const options = opts ? { ...this.options, ...opts } : this.options;

    const body: any = {
      grant_type: 'client_credentials',
      client_id: options.clientId,
      client_secret: options.clientSecret,
      resource: 'oath2_token',
    };

    if (options.scopes !== undefined) {
      body.scope = this.sanitizeScope(options.scopes);
    }

    const reqOptions = this.requestOptions(
      {
        url: options.accessTokenUri,
        method: 'POST',
        headers: DEFAULT_HEADERS,
        body,
      },
      options
    );

    const data: Data = await this.request(reqOptions);

    return this.createToken(data);
  }

  /**
   * Create a new token from existing data.
   */
  createToken(data: Data): OAuth2Token {
    return new OAuth2Token(this, data);
  }

  /**
   * Pull an authentication error from the response data.
   */
  getAuthError(body: any): OAuth2Error | undefined {
    const message = body.error in ERROR_RESPONSES ? body.error : body.error_description;

    if (message) {
      const err = new OAuth2Error(message);

      err.body = body;
      err.code = 'EAUTH';

      return err;
    }
  }

  /**
   * Merge request options from an options object.
   */
  requestOptions(
    requestOptions: Partial<OAuth2RequestOptions>,
    options: Partial<OAuth2RequestOptions>
  ): OAuth2RequestOptions {
    if (!requestOptions.url) {
      throw new Error('Url was not supplied!');
    }

    return {
      url: requestOptions.url,
      method: requestOptions.method || 'GET',
      body: { ...requestOptions.body, ...options.body },
      query: { ...requestOptions.query, ...options.query },
      headers: { ...requestOptions.headers, ...options.headers },
    };
  }

  /**
   * Using the node-fetch request method, we'll automatically attempt to parse
   * the response.
   */
  async request(options: OAuth2RequestOptions): Promise<Data> {
    let url = options.url;
    const body = Querystring.stringify(options.body);
    const query = Querystring.stringify(options.query);

    if (query) {
      url += (url.indexOf('?') === -1 ? '?' : '&') + query;
    }

    const res = await fetch(url, {
      method: options.method,
      body,
      headers: options.headers,
    });
    const data = await res.json();
    const authErr = this.getAuthError(data);

    if (authErr) {
      return Promise.reject(authErr);
    }

    if (res.status < 200 || res.status >= 399) {
      const statusErr = new OAuth2Error('HTTP status ' + res.status);

      statusErr.status = res.status;
      statusErr.body = res.body;
      statusErr.code = 'ESTATUS';
      throw statusErr;
    }

    return data;
  }
}
