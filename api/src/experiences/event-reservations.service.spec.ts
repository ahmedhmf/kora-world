import { EventReservationsService } from './event-reservations.service';
import { DataSource } from 'typeorm';

describe('Event logistics validation',()=>{
  const transaction=jest.fn();
  const service=new EventReservationsService({transaction} as unknown as DataSource);
  beforeEach(()=>transaction.mockReset());
  it('rejects duplicate reconciliation lines before opening a transaction',async()=>{
    const line={reservationId:1,returned:1,damaged:0,missing:0,consumed:0,notes:''};
    await expect(service.reconcile(1,{lines:[line,line]},1)).rejects.toThrow('valid reconciliation');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('requires explanation for damaged, missing or consumed items',async()=>{
    await expect(service.reconcile(1,{lines:[{reservationId:1,returned:0,damaged:1,missing:0,consumed:0,notes:''}]},1)).rejects.toThrow('explanations');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects negative and fractional quantities',async()=>{
    for(const returned of [-1,0.5])await expect(service.reconcile(1,{lines:[{reservationId:1,returned,damaged:0,missing:0,consumed:0,notes:''}]},1)).rejects.toThrow('valid reconciliation');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects dispatch if no active reservation exists',async()=>{
    const query=jest.fn().mockResolvedValueOnce([{id:1}]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    transaction.mockImplementation(fn=>fn({query}));
    await expect(service.dispatch(1,1)).rejects.toThrow('No active reservation');
  });
  it('does not repost previously dispatched stock',async()=>{
    const query=jest.fn().mockResolvedValueOnce([{id:1}]).mockResolvedValueOnce([]).mockResolvedValueOnce([{id:1}]);
    transaction.mockImplementation(fn=>fn({query}));
    await expect(service.dispatch(1,1)).resolves.toEqual({duplicate:true});
    expect(query).toHaveBeenCalledTimes(3);
  });
});
