import { HeaderInit } from "node-fetch";

export interface Response {
  status: number;
  body: string;
  timestamp: string;
  headers?: HeadersInit;
}

export interface Request {
  protocol?: string;
  host: string;
  port?: number | string;
  path?: string;
  method?: string;
  headers?: HeaderInit;
  body?: string;
  timestamp: string;
}
export interface Orchestration {
  name: string;
  request: Request;
  response: Response;
}
export interface OpenHimResponseObject {
  'x-mediator-urn': string;
  status: string;
  response: Response;
  orchestrations: Orchestration[]
}

export interface ResponseObject {
  status: number;
  body: object;
}

export interface MpiMediatorResponseObject {
  body: OpenHimResponseObject;
  status: number;
}

export interface MpiTransformResult {
  patient?: object;
  managingOrganization?: object;
  extension?: [object];
}
