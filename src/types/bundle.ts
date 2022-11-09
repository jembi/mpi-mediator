export interface Resource {
  resourceType: string;
  id: string;
};

export interface Request {
  method: string;
  url: string;
};

export interface Entry {
  resource: Resource;
  fullUrl: string;
  request?: Request
};

export interface Bundle {
  resourceType: string;
  id: string;
  type: string;
  entry: Entry[];
};
