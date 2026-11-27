import { AcademyController } from './academy.controller';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import type { DataSource } from 'typeorm';

const req = {user:{sub:42,role:'employee'}} as AuthenticatedRequest;
function setup(responses:unknown[][]) {
 const query=jest.fn();
 for(const response of responses)query.mockResolvedValueOnce(response);
 const tx={query};
 const db={query:jest.fn().mockResolvedValue([{name:'kora_test'}]),transaction:jest.fn(async (fn:(value:typeof tx)=>unknown)=>fn(tx))};
 return {controller:new AcademyController(db as unknown as DataSource),query};
}
describe('Academy training completion',()=>{
 it('records exact step acknowledgements for authenticated employee',async()=>{
  const {controller,query}=setup([[{id:5}],[{id:10},{id:11}],[]]);
  await expect(controller.complete(req,5,{stepIds:[10,11]})).resolves.toEqual({completed:true});
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining('ON CONFLICT DO NOTHING'),[42,5]);
 });
 it('rejects partial or unrelated steps',async()=>{
  const {controller,query}=setup([[{id:5}],[{id:10},{id:11}]]);
  await expect(controller.complete(req,5,{stepIds:[10,99]})).rejects.toThrow('Acknowledge every step');
  expect(query).toHaveBeenCalledTimes(2);
 });
 it('rejects invisible or superseded versions',async()=>{
  const {controller,query}=setup([[]]);
  await expect(controller.complete(req,5,{stepIds:[10]})).rejects.toThrow('Current published procedure not found');
  expect(query).toHaveBeenCalledTimes(1);
 });
 it('rejects invalid acknowledgements',async()=>{
  const {controller,query}=setup([]);
  await expect(controller.complete(req,5,{stepIds:['10']})).rejects.toThrow('Invalid step acknowledgements');
  expect(query).not.toHaveBeenCalled();
 });
});
