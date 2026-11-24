import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

type Item = {key:string;name:string;quantity:number;inventoryKind?:'product'|'equipment';inventoryId?:number};
type Input = {warehouseId:number;locationId:number;startsAt:string;endsAt:string};

@Injectable()
export class EventReservationsService {
  constructor(private readonly db:DataSource) {}
  private async context(m:EntityManager,eventId:number,dto:Input,lock=false) {
    if (!dto || !Number.isSafeInteger(dto.warehouseId)||!Number.isSafeInteger(dto.locationId)||
      typeof dto.startsAt!=='string'||typeof dto.endsAt!=='string') throw new BadRequestException('Choose warehouse, location and reservation dates');
    const start=new Date(dto.startsAt),end=new Date(dto.endsAt);
    if (!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start||end<=new Date()) throw new BadRequestException('Invalid reservation period');
    const [event]=await m.query('SELECT start_date,end_date FROM events WHERE id=$1'+(lock?' FOR UPDATE':''),[eventId]);
    if (!event) throw new NotFoundException('Event not found');
    if (+start>+new Date(event.start_date)||+end<+new Date(event.end_date||event.start_date)) throw new BadRequestException('Reservation must cover the event dates');
    const [location]=await m.query('SELECT l.id FROM warehouse_locations l JOIN warehouse_sites w ON w.id=l.warehouse_id WHERE l.id=$1 AND w.id=$2 AND l.is_active AND w.is_active',[dto.locationId,dto.warehouseId]);
    if (!location) throw new BadRequestException('Select an active warehouse location');
    const [checklist]=await m.query('SELECT items FROM event_kora_checklists WHERE event_id=$1'+(lock?' FOR UPDATE':''),[eventId]);
    if (!checklist) throw new BadRequestException('Generate the event checklist first');
    const items:Item[]=checklist.items;
    const grouped=new Map<string,Item>();
    for(const item of items) {
      if (!item.inventoryKind||!item.inventoryId) continue;
      const key=item.inventoryKind+':'+item.inventoryId;
      const existing=grouped.get(key);
      if(existing) existing.quantity+=item.quantity;
      else grouped.set(key,{...item,key});
    }
    return {start,end,items:[...grouped.values()].sort((a,b)=>a.key.localeCompare(b.key)),manual:items.filter(i=>!i.inventoryKind||!i.inventoryId)};
  }
  private async availability(m:EntityManager,eventId:number,dto:Input,ctx:Awaited<ReturnType<EventReservationsService['context']>>,lock=false) {
    const result:Array<Item & {physical:number;reservedByOthers:number;available:number;missing:number}>=[];
    for(const item of ctx.items) {
      const product=item.inventoryKind==='product';
      const table=product?'warehouse_stock':'warehouse_equipment_stock',column=product?'product_id':'equipment_id';
      if(lock) await m.query(`INSERT INTO ${table}(location_id,${column},quantity) VALUES($1,$2,0) ON CONFLICT DO NOTHING`,[dto.locationId,item.inventoryId]);
      const [stock]=await m.query(`SELECT quantity FROM ${table} WHERE location_id=$1 AND ${column}=$2`+(lock?' FOR UPDATE':''),[dto.locationId,item.inventoryId]);
      const [peak]=await m.query('SELECT warehouse_reserved_peak($1,$2,$3,$4,$5,$6) AS quantity',[dto.locationId,product?item.inventoryId:null,product?null:item.inventoryId,ctx.start,ctx.end,eventId]);
      const physical=stock?.quantity??0,reservedByOthers=Number(peak.quantity),available=Math.max(0,physical-reservedByOthers);
      result.push({...item,physical,reservedByOthers,available,missing:Math.max(0,item.quantity-available)});
    }
    return result;
  }
  list(eventId:number) {
    return this.db.query(`SELECT r.id,r.status,r.quantity,r.starts_at AS "startsAt",r.ends_at AS "endsAt",r.warehouse_id AS "warehouseId",r.location_id AS "locationId",
      CASE WHEN r.product_id IS NOT NULL THEN 'product' ELSE 'equipment' END AS "inventoryKind",COALESCE(r.product_id,r.equipment_id) AS "inventoryId",
      COALESCE(p.name,e.name) AS name,w.name AS "warehouseName",l.code AS "locationCode"
      FROM event_stock_reservations r LEFT JOIN products p ON p.id=r.product_id LEFT JOIN warehouse_equipment e ON e.id=r.equipment_id
      JOIN warehouse_sites w ON w.id=r.warehouse_id JOIN warehouse_locations l ON l.id=r.location_id
      WHERE r.event_id=$1 ORDER BY r.id DESC`,[eventId]);
  }
  preview(eventId:number,dto:Input) {
    return this.db.transaction('REPEATABLE READ',async m=>{
      const ctx=await this.context(m,eventId,dto);
      return {items:await this.availability(m,eventId,dto,ctx),manual:ctx.manual};
    });
  }
  reserve(eventId:number,dto:Input,userId:number) {
    return this.db.transaction(async m=>{
      const ctx=await this.context(m,eventId,dto,true);
      const [active]=await m.query("SELECT id FROM event_stock_reservations WHERE event_id=$1 AND status='active' LIMIT 1",[eventId]);
      if(active) throw new BadRequestException('Cancel the existing reservation before replacing it');
      if(!ctx.items.length) throw new BadRequestException('Link checklist items to inventory first');
      const items=await this.availability(m,eventId,dto,ctx,true);
      const missing=items.filter(i=>i.missing>0);
      if(missing.length) throw new BadRequestException('Insufficient available stock: '+missing.map(i=>i.name+' (missing '+i.missing+')').join(', '));
      for(const item of items) await m.query(`INSERT INTO event_stock_reservations(event_id,warehouse_id,location_id,product_id,equipment_id,quantity,starts_at,ends_at,created_by_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[eventId,dto.warehouseId,dto.locationId,item.inventoryKind==='product'?item.inventoryId:null,item.inventoryKind==='equipment'?item.inventoryId:null,item.quantity,ctx.start,ctx.end,userId]);
      return {reserved:items.length};
    });
  }
  cancel(eventId:number,userId:number) {
    return this.db.transaction(async m=>{
      const [event]=await m.query('SELECT id FROM events WHERE id=$1 FOR UPDATE',[eventId]);
      if(!event) throw new NotFoundException('Event not found');
      await m.query("UPDATE event_stock_reservations SET status='cancelled',cancelled_at=NOW(),cancelled_by_id=$2 WHERE event_id=$1 AND status='active'",[eventId,userId]);
      return {cancelled:true};
    });
  }
}
