import { requireAcademyRole, validateAcademyRoute } from './academy.policy';

describe('Academy policy', () => {
  it('permits internal staff and denies suppliers and unknown roles', () => {
    expect(() => requireAcademyRole('admin')).not.toThrow();
    expect(() => requireAcademyRole('employee')).not.toThrow();
    expect(() => requireAcademyRole('supplier')).toThrow();
    expect(() => requireAcademyRole('unknown')).toThrow();
  });
  it('restricts authoring to administrators', () => {
    expect(() => requireAcademyRole('admin', true)).not.toThrow();
    expect(() => requireAcademyRole('employee', true)).toThrow();
  });
  it('only accepts known internal routes', () => {
    expect(validateAcademyRoute('/purchase-orders/new')).toBe('/purchase-orders/new');
    for (const route of ['//example.com','https://example.com','/users','/accounts/123']) {
      expect(() => validateAcademyRoute(route)).toThrow();
    }
  });
});
