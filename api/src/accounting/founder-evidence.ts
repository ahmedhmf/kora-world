import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export interface EvidenceUpload { originalname:string; mimetype:string; buffer:Buffer; size:number; }
export function validateFounderEvidence(file:EvidenceUpload) {
 if(!file||!Buffer.isBuffer(file.buffer)||!file.buffer.length||file.buffer.length>10*1024*1024)throw new BadRequestException('Choose a file up to 10 MB');
 const filename=file.originalname.split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f]/g,'').trim()||'';
 if(!filename||filename.length>200)throw new BadRequestException('Invalid filename');
 const b=file.buffer, ext=filename.split('.').pop()?.toLowerCase();
 const pdf=ext==='pdf'&&b.subarray(0,5).toString()==='%PDF-';
 const png=ext==='png'&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg=(ext==='jpg'||ext==='jpeg')&&b[0]===255&&b[1]===216&&b[2]===255;
 const mime=pdf?'application/pdf':png?'image/png':jpeg?'image/jpeg':null;
 if(!mime||mime!==file.mimetype)throw new BadRequestException('Only PDF, JPG and PNG files are accepted');
 return {filename,mime,content:b,hash:createHash('sha256').update(b).digest('hex')};
}
