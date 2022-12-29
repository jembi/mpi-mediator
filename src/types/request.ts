import { HeaderInit } from 'node-fetch';

export interface RequestDetails {
  protocol: string;
  host: string;
  port: number | string;
  path: string;
  method: string;
  headers: HeaderInit;
  data?: string;
}

export interface RequestOptions {
  username: string;
  password: string;
  apiURL: string;
  trustSelfSigned: boolean;
  urn: string;
}
