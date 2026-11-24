import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class EquipmentService {
  constructor(private readonly db: DataSource) {}
  catalogue() { return this.db.query('SELECT * FROM warehouse_equipment ORDER BY name,id'); }
  async create(dto: {code:string;name:string;category?:string;description?:string}) {
    if (typeof dto?.code!=='string'||!/^[A-Za-z0-9_-]{2,40}$/.test(dto.code)||typeof dto.name!=='string'||!dto.name.trim()||dto.name.length>160||
      (dto.category!==undefined&&(typeof dto.category!=='string'||dto.category.length>100))||
      (dto.description!==undefined&&(typeof dto.description!=='string'||dto.description.length>2000)))
      throw new BadRequestException('Enter valid equipment code and name');
    const [r]=await this.db.query('INSERT INTO warehouse_equipment(code,name,category,description) VALUES($1,$2,$3,$4) RETURNING *',[dto.code.toUpperCase(),dto.name.trim(),dto.category?.trim()||null,dto.description?.trim()||null]);
    return r;
  }
  stock(id:number) { return this.db.query(`SELECT s.equipment_id AS "equipmentId", e.code,e.name,e.category,s.location_id AS "locationId",l.code AS "locationCode",s.quantity
    FROM warehouse_equipment_stock s JOIN warehouse_equipment e ON e.id=s.equipment_id JOIN warehouse_locations l ON l.id=s.location_id WHERE l.warehouse_id=$1 ORDER BY e.code,l.code`,[id]); }
  movements(id:number) { return this.db.query(`SELECT m.id::text,e.code,e.name,l.code AS "locationCode",m.quantity_change AS "quantityChange",m.movement_type AS type,m.reference,m.notes,m.created_at AS "createdAt",m.performed_by_id AS "performedById"
    FROM warehouse_equipment_movements m JOIN warehouse_equipment e ON e.id=m.equipment_id JOIN warehouse_locations l ON l.id=m.location_id WHERE m.warehouse_id=$1 ORDER BY m.id DESC LIMIT 500`,[id]); }
  async record(id:number,dto:{equipmentId:number;locationId:number;toLocationId?:number;quantity:number;action:string;reference?:string;notes?:string},userId:number) {
    const positive=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0&&n<=2147483647;
    if (![id,dto?.equipmentId,dto?.locationId,userId].every(positive)||!['receipt','issue','return','adjustment','transfer'].includes(dto.action)||
      !Number.isSafeInteger(dto.quantity)||!dto.quantity||Math.abs(dto.quantity)>100000||(dto.action!=='adjustment'&&dto.quantity<0)||
      (dto.notes!==undefined&&(typeof dto.notes!=='string'||dto.notes.length>2000))||
      (dto.reference!==undefined&&(typeof dto.reference!=='string'||dto.reference.length>160))||
      (dto.action==='adjustment'&&!dto.notes?.trim())||
      (dto.action==='transfer'&&(!positive(dto.toLocationId)||dto.toLocationId===dto.locationId)))
      throw new BadRequestException('Invalid equipment movement; adjustments require a reason');
    const changes=dto.action==='transfer'?[{location:dto.locationId,delta:-dto.quantity,type:'transfer_out'},{location:dto.toLocationId!,delta:dto.quantity,type:'transfer_in'}]:
      [{location:dto.locationId,delta:dto.action==='issue'?-dto.quantity:dto.quantity,type:dto.action}];
    changes.sort((a,b)=>a.location-b.location);
    return this.db.transaction(async m=>{
      const [equipment]=await m.query('SELECT id FROM warehouse_equipment WHERE id=$1',[dto.equipmentId]);
      if (!equipment) throw new BadRequestException('Equipment not found');
      for (const c of changes) {
        const [l]=await m.query('SELECT l.id FROM warehouse_locations l JOIN warehouse_sites w ON w.id=l.warehouse_id WHERE w.id=$1 AND l.id=$2 AND w.is_active AND l.is_active',[id,c.location]);
        if (!l) throw new BadRequestException('Select an active location in this warehouse');
        await m.query('INSERT INTO warehouse_equipment_stock(equipment_id,location_id,quantity) VALUES($1,$2,0) ON CONFLICT DO NOTHING',[dto.equipmentId,c.location]);
        const [s]=await m.query('SELECT quantity FROM warehouse_equipment_stock WHERE equipment_id=$1 AND location_id=$2 FOR UPDATE',[dto.equipmentId,c.location]);
        if (s.quantity+c.delta<0) throw new BadRequestException('Insufficient equipment stock');
        await m.query('UPDATE warehouse_equipment_stock SET quantity=quantity+$3 WHERE equipment_id=$1 AND location_id=$2',[dto.equipmentId,c.location,c.delta]);
        await m.query(`INSERT INTO warehouse_equipment_movements(equipment_id,warehouse_id,location_id,quantity_change,movement_type,reference,notes,performed_by_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[dto.equipmentId,id,c.location,c.delta,c.type,dto.reference?.trim()||null,dto.notes?.trim()||null,userId]);
      }
      return {success:true};
    });
  }
}
