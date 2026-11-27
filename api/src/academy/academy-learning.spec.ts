import { AcademyLearningController } from './academy-learning.controller';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import type { DataSource } from 'typeorm';
const req=(role:string)=>({user:{sub:42,role}} as AuthenticatedRequest);
function setup(responses:unknown[][]=[]){
 const query=jest.fn();for(const response of responses)query.mockResolvedValueOnce(response);
 const tx={query};
 const db={query:jest.fn().mockResolvedValue([{name:'kora_test'}]),transaction:jest.fn(async(fn:(value:typeof tx)=>unknown)=>fn(tx))};
 return {controller:new AcademyLearningController(db as unknown as DataSource),query,db};
}
describe('Academy learning safety',()=>{
 it('rejects non-admin training assignments',async()=>{
  const {controller,db}=setup();
  await expect(controller.assign(req('employee'),{})).rejects.toThrow('Academy access denied');
  expect(db.query).not.toHaveBeenCalled();
 });
 it('rejects foreign checklist steps before saving progress',async()=>{
  const {controller,query}=setup([[{id:7}],[{id:11}]]);
  await expect(controller.progress(req('employee'),7,{stepIds:[99]})).rejects.toThrow('Step does not belong');
  expect(query).toHaveBeenCalledTimes(2);
 });
 it('saves progress for the authenticated actor',async()=>{
  const {controller,query}=setup([[{id:7}],[{id:11}],[]]);
  await expect(controller.progress(req('employee'),7,{stepIds:[11]})).resolves.toEqual({stepIds:[11]});
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining('academy_training_progress'),[42,7,[11]]);
 });
 it('rejects checklist mutations when actor does not own run',async()=>{
  const {controller,query}=setup([[]]);
  await expect(controller.check(req('employee'),8,11,{checked:true})).rejects.toThrow('Open checklist not found');
  expect(query).toHaveBeenCalledWith(expect.stringContaining('actor_id=$2'),[8,42]);
 });
 it('rejects finishing partially checked operational tasks',async()=>{
  const {controller,query}=setup([[{id:8,version_id:7}],[{id:7}],[{total:2,checked:1}]]);
  await expect(controller.finish(req('employee'),8)).rejects.toThrow('Check all steps first');
  expect(query).toHaveBeenCalledTimes(3);
 });
});
