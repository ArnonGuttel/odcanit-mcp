// Odcanit read-only export view types
// Source: vwExportToOuterSystems_Files
export interface Case {
  tikCounter: number;
  tikNumber: string;
  tikName: string;
  clientVisualID: string;
  clientName: string;
  statusName?: string;
  tikType?: string;
  tikOwner?: number;
  tsCreateDate?: Date;
  tsModifyDate?: Date;
}

// Source: vwExportToOuterSystems_Clients
export interface Client {
  sideCounter: number;
  visualID: string;
  clientName: string;
  fullAddress?: string;
  mobile?: string;
  email?: string;
  owner?: number;
  dateOpen?: Date;
  tsCreateDate?: Date;
  tsModifyDate?: Date;
}
