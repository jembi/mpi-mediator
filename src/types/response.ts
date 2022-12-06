export interface Headers {
  'content-type': string;
}

export interface Response {
  status: number;
  body: object;
  timestamp: string;
  headers: Headers;
}

export interface OpenHimResponseObject {
  'x-mediator-urn': string;
  status: string;
  response: Response;
}

export interface ResponseObject {
  status: number;
  body: object;
}

export interface MpiMediatorResponseObject {
  body: OpenHimResponseObject;
  status: number;
}
