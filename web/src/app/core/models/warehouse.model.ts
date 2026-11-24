export interface WarehouseSite { id: number; code: string; name: string; address: string | null; is_active: boolean; }
export interface WarehouseLocation { id: number; warehouse_id: number; code: string; name: string; is_active: boolean; }
export interface WarehouseStock { locationId: number; locationCode: string; productId: number; articleNumber: string; productName: string; quantity: number; }
export interface WarehouseMovement { id: string; locationId: number; productId: number; quantityChange: number; type: string; reference: string | null; notes: string | null; performedById: number | null; createdAt: string; }
export type WarehouseAction = 'receipts' | 'issues' | 'returns' | 'adjustments' | 'transfers';
export interface WarehouseStockInput { locationId: number; productId: number; quantity: number; reference?: string; notes?: string; }
export interface WarehouseTransferInput { fromLocationId: number; toLocationId: number; productId: number; quantity: number; notes?: string; }
