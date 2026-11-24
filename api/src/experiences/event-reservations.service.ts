import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

type Item = {key:string;name:string;quantity:number;inventoryKind?:'product'|'equipment';inventoryId?:number};
type ReservedRow={id:number;warehouse_id:number;location_id:number;product_id:number|null;equipment_id:number|null;quantity:number;status:string;starts_at:Date;ends_at:Date};
type ReconcileLine={reservationId:number;returned:number;damaged:number;missing:number;consumed:number;notes:string};
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
  private async lockEvent(m:EntityManager,eventId:number) {
    const [event]=await m.query('SELECT id,start_date,end_date FROM events WHERE id=$1 FOR UPDATE',[eventId]);
    if(!event)throw new NotFoundException('Event not found');
    return event;
  }
  private async rows(m:EntityManager,eventId:number,status:string):Promise<ReservedRow[]> {
    return m.query('SELECT * FROM event_stock_reservations WHERE event_id=$1 AND status=$2 ORDER BY (product_id IS NOT NULL), COALESCE(product_id,equipment_id),location_id,id FOR UPDATE',[eventId,status]);
  }
  private async stockChange(m:EntityManager,r:ReservedRow,delta:number,userId:number,reference:string,notes:string) {
    if(!delta)return;
    const product=r.product_id!==null;
    const stock=product?'warehouse_stock':'warehouse_equipment_stock';
    const movements=product?'warehouse_movements':'warehouse_equipment_movements';
    const column=product?'product_id':'equipment_id';
    const item=r.product_id??r.equipment_id;
    const [location]=await m.query('SELECT l.id FROM warehouse_locations l JOIN warehouse_sites w ON w.id=l.warehouse_id WHERE l.id=$1 AND w.id=$2 AND l.is_active AND w.is_active',[r.location_id,r.warehouse_id]);
    if(!location)throw new BadRequestException('Reservation location is inactive');
    await m.query(`INSERT INTO ${stock}(location_id,${column},quantity) VALUES($1,$2,0) ON CONFLICT DO NOTHING`,[r.location_id,item]);
    const [balance]=await m.query(`SELECT quantity FROM ${stock} WHERE location_id=$1 AND ${column}=$2 FOR UPDATE`,[r.location_id,item]);
    if(balance.quantity+delta<0)throw new BadRequestException('Insufficient physical stock for reservation #'+r.id);
    if(delta<0){
      const [peak]=await m.query("SELECT warehouse_reserved_peak($1,$2,$3,NOW(),'infinity'::timestamptz,NULL) AS quantity",[r.location_id,r.product_id,r.equipment_id]);
      if(balance.quantity+delta<Number(peak.quantity))throw new BadRequestException('Dispatch would leave insufficient physical stock for another event. Review future reservations first.');
    }
    await m.query(`UPDATE ${stock} SET quantity=quantity+$3 WHERE location_id=$1 AND ${column}=$2`,[r.location_id,item,delta]);
    await m.query(`INSERT INTO ${movements}(warehouse_id,location_id,${column},quantity_change,movement_type,reference,notes,performed_by_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[r.warehouse_id,r.location_id,item,delta,delta<0?'issue':'return',reference,notes,userId]);
  }
  async dispatch(eventId:number,userId:number){
    return this.db.transaction(async m=>{
      const event=await this.lockEvent(m,eventId);
      const rows=await this.rows(m,eventId,'active');
      if(!rows.length){
        const [posted]=await m.query("SELECT id FROM event_stock_reservations WHERE event_id=$1 AND status IN ('dispatched','reconciled') LIMIT 1",[eventId]);
        if(posted)return {duplicate:true};
        throw new BadRequestException('No active reservation to dispatch');
      }
      const now=Date.now();
      if(rows.some(r=>now<+new Date(r.starts_at)||now>=+new Date(r.ends_at)||+new Date(r.starts_at)>+new Date(event.start_date)||+new Date(r.ends_at)<+new Date(event.end_date||event.start_date)))throw new BadRequestException('Reservation dates must cover the event and current dispatch time');
      const [checklist]=await m.query('SELECT items FROM event_kora_checklists WHERE event_id=$1 FOR UPDATE',[eventId]);
      if(!checklist||!checklist.items.every((i:{packed:boolean})=>i.packed))throw new BadRequestException('Mark all checklist items packed before dispatch');
      const linked=new Map<string,number>();
      for(const i of checklist.items as Item[])if(i.inventoryKind&&i.inventoryId){const key=i.inventoryKind+':'+i.inventoryId;linked.set(key,(linked.get(key)||0)+i.quantity);}
      if(linked.size!==rows.length||rows.some(r=>linked.get((r.product_id!==null?'product:'+r.product_id:'equipment:'+r.equipment_id))!==r.quantity))throw new BadRequestException('Checklist changed; cancel and regenerate reservation');
      await m.query("UPDATE event_stock_reservations SET status='dispatched',dispatched_at=NOW(),dispatched_by_id=$2 WHERE event_id=$1 AND status='active'",[eventId,userId]);
      for(const r of rows)await this.stockChange(m,r,-r.quantity,userId,'EV-'+eventId+'-R'+r.id,'Event dispatch');
      return {dispatched:rows.length};
    });
  }
  async reconcile(eventId:number,dto:{lines:ReconcileLine[]},userId:number){
    if(!Array.isArray(dto?.lines)||!dto.lines.length||dto.lines.length>20000||new Set(dto.lines.map(l=>l?.reservationId)).size!==dto.lines.length||
      dto.lines.some(l=>!l||!Number.isSafeInteger(l.reservationId)||l.reservationId<1||
        ![l.returned,l.damaged,l.missing,l.consumed].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=2147483647)||
        typeof l.notes!=='string'||l.notes.length>2000||((l.damaged||l.missing||l.consumed)&&!l.notes.trim())))throw new BadRequestException('Enter valid reconciliation quantities and explanations for exceptions');
    return this.db.transaction(async m=>{
      await this.lockEvent(m,eventId);
      const rows=await this.rows(m,eventId,'dispatched');
      if(!rows.length){
        const old: Array<{reservation_id:number;returned:number;damaged:number;missing:number;consumed:number;notes:string}>=await m.query("SELECT c.* FROM event_stock_reconciliations c JOIN event_stock_reservations r ON r.id=c.reservation_id WHERE r.event_id=$1",[eventId]);
        if(old.length===dto.lines.length&&old.every(o=>dto.lines.some(l=>l.reservationId===o.reservation_id&&l.returned===o.returned&&l.damaged===o.damaged&&l.missing===o.missing&&l.consumed===o.consumed&&l.notes.trim()===o.notes)))return {duplicate:true};
        throw new BadRequestException('No open dispatch to reconcile');
      }
      if(rows.length!==dto.lines.length)throw new BadRequestException('Reconcile all dispatched items together');
      for(const r of rows){
        const l=dto.lines.find(x=>x.reservationId===r.id);
        if(!l||l.returned+l.damaged+l.missing+l.consumed!==r.quantity)throw new BadRequestException('Quantities must equal dispatched quantity for reservation #'+r.id);
        if(r.equipment_id!==null&&l.consumed)throw new BadRequestException('Reusable equipment cannot be marked consumed');
        await this.stockChange(m,r,l.returned,userId,'EV-'+eventId+'-R'+r.id,'Serviceable event return');
        await m.query('INSERT INTO event_stock_reconciliations(reservation_id,returned,damaged,missing,consumed,notes,performed_by_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[r.id,l.returned,l.damaged,l.missing,l.consumed,l.notes.trim(),userId]);
      }
      await m.query("UPDATE event_stock_reservations SET status='reconciled' WHERE event_id=$1 AND status='dispatched'",[eventId]);
      return {reconciled:rows.length};
    });
  }
  list(eventId:number) {
    return this.db.query(`SELECT r.id,r.status,r.quantity,r.starts_at AS "startsAt",r.ends_at AS "endsAt",r.warehouse_id AS "warehouseId",r.location_id AS "locationId",
      CASE WHEN r.product_id IS NOT NULL THEN 'product' ELSE 'equipment' END AS "inventoryKind",COALESCE(r.product_id,r.equipment_id) AS "inventoryId",
      COALESCE(p.name,e.name) AS name,w.name AS "warehouseName",l.code AS "locationCode",r.dispatched_at AS "dispatchedAt",c.returned,c.damaged,c.missing,c.consumed,c.notes AS "reconciliationNotes",c.created_at AS "reconciledAt"
      FROM event_stock_reservations r LEFT JOIN products p ON p.id=r.product_id LEFT JOIN warehouse_equipment e ON e.id=r.equipment_id
      JOIN warehouse_sites w ON w.id=r.warehouse_id JOIN warehouse_locations l ON l.id=r.location_id LEFT JOIN event_stock_reconciliations c ON c.reservation_id=r.id
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
      const [active]=await m.query("SELECT id FROM event_stock_reservations WHERE event_id=$1 AND status IN ('active','dispatched','reconciled') LIMIT 1",[eventId]);
      if(active) throw new BadRequestException('Event already reserved or dispatched; only active reservations can be cancelled');
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
