export interface Headers {
  authToken?: string;
  contentType?: string;
}
export interface RequestDetails {
  protocol: string;
  host: string;
  port: number | string;
  path: string;
  method: string;
  headers: Headers;
  data?: string;
}

export interface RequestOptions {
  username: string;
  password: string;
  apiURL: string;
  trustSelfSigned: boolean;
  urn: string;
}
