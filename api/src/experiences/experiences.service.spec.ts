import { ExperiencesService } from './experiences.service';
import { KoraExperience } from './experience.entity';

describe('ExperiencesService packing list generation', () => {
  const templates: Partial<KoraExperience>[] = [
    { id: 1, name: 'Shooting', items: [
      { name: 'Footballs', quantity: 5, unit: 'pcs', category: 'Sport', mode: 'sum' },
      { name: 'Generator', quantity: 1, unit: 'pcs', category: 'Power', mode: 'shared' },
    ] },
    { id: 2, name: 'Skills', items: [
      { name: 'footballs', quantity: 3, unit: 'pcs', category: 'Sport', mode: 'sum' },
      { name: 'Generator', quantity: 1, unit: 'pcs', category: 'Power', mode: 'shared' },
    ] },
  ];

  function setup(existing: any[] = []) {
    const events = { exists: jest.fn().mockResolvedValue(true) };
    const experiences = { find: jest.fn(), findBy: jest.fn().mockResolvedValue(templates) };
    const assignments = { find: jest.fn().mockResolvedValue([{ experienceId: 1 }, { experienceId: 2 }]) };
    const checklists = {
      findOneBy: jest.fn().mockResolvedValue(existing.length ? { eventId: 10, items: existing } : null),
      create: jest.fn().mockImplementation(data => data),
      save: jest.fn().mockImplementation(async data => data),
    };
    const service = new ExperiencesService(events as any, experiences as any, assignments as any, checklists as any, {} as any);
    return { service, checklists };
  }

  it('adds consumable quantities and shares common equipment', async () => {
    const { service, checklists } = setup();
    const rows = await service.generate(10);
    expect(rows.find(x => x.name === 'Footballs')?.quantity).toBe(8);
    expect(rows.find(x => x.name === 'Generator')?.quantity).toBe(1);
    expect(rows.find(x => x.name === 'Generator')?.sources).toEqual(['Shooting', 'Skills']);
    expect(checklists.save).toHaveBeenCalled();
  });

  it('keeps packing progress and event-only entries when regenerated', async () => {
    const existing = [
      { name: 'Footballs', key: 'footballs|pcs', quantity: 8, unit: 'pcs', category: 'Sport', mode: 'sum', packed: true, sources: ['Shooting'] },
      { name: 'Water', key: 'water|bottles', quantity: 20, unit: 'bottles', category: 'Food', mode: 'sum', packed: false, sources: ['Event-only'] },
    ];
    const { service } = setup(existing);
    const rows = await service.generate(10);
    expect(rows.find(x => x.key === 'footballs|pcs')?.packed).toBe(true);
    expect(rows.find(x => x.key === 'water|bottles')?.quantity).toBe(20);
  });

  it('rejects invalid experience requirements', async () => {
    const { service } = setup();
    await expect(service.create({ name: 'Example', items: [
      { name: 'Balls', quantity: -1, unit: 'pcs', category: 'Sport', mode: 'sum' },
    ] })).rejects.toThrow();
  });
});
