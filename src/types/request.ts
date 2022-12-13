export interface RequestDetails {
  protocol: string;
  host: string;
  port: number | string;
  path: string;
  authToken?: string;
  method: string;
  data?: string;
  contentType?: string;
}

export interface RequestOptions {
  username: string;
  password: string;
  apiURL: string;
  trustSelfSigned: boolean;
  urn: string;
}
