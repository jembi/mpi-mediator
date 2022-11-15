export interface Resource {
  resourceType: string;
  id: string;
}

export interface Entry {
  resource: Resource;
  fullUrl: string;
}

export interface Bundle {
  resourceType: string;
  id: string;
  type: string;
  entry: Entry[];
}
