export interface Response {
  status: number;
  body: object;
  timestamp: string;
  headers: HeadersInit;
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

export interface MpiTransformResult {
  patient?: object;
  managingOrganization?: object;
  extension?: [object];
}
