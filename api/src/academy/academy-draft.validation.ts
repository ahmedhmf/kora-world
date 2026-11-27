import { BadRequestException } from '@nestjs/common';
import { validateAcademyRoute } from './academy.policy';

function fail(field: string): never { throw new BadRequestException('Invalid ' + field); }
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(field);
  return value as Record<string, unknown>;
}
function str(value: unknown, field: string, max: number, required = false): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) return fail(field);
  return value.trim();
}
export function parseIdentity(body: unknown) {
  const b = object(body, 'procedure');
  const code = str(b.code, 'code', 40, true);
  const slug = str(b.slug, 'slug', 120, true);
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)) fail('code');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail('slug');
  if (typeof b.categoryId !== 'number' || !Number.isSafeInteger(b.categoryId) || b.categoryId <= 0) return fail('categoryId');
  return { code, slug, categoryId: b.categoryId };
}
export function parseDraft(body: unknown) {
  const b = object(body, 'draft');
  const roles = b.allowedRoles === undefined ? ['admin','employee'] : b.allowedRoles;
  if (!Array.isArray(roles) || roles.length === 0 || roles.some(r => r !== 'admin' && r !== 'employee')) return fail('allowedRoles');
  // Pilot: video links are disabled until a company-controlled provider is selected.
  if (b.videoUrl !== undefined && b.videoUrl !== null && b.videoUrl !== '') return fail('videoUrl (not enabled)');
  if (!Array.isArray(b.steps) || b.steps.length > 100) return fail('steps');
  const steps = b.steps.map((raw, index) => {
    const s = object(raw, 'step');
    const route = str(s.appRoute, 'appRoute', 200);
    return {
      position: index + 1, title: str(s.title, 'step title', 180, true),
      instructions: str(s.instructions, 'instructions', 10000, true),
      appRoute: route ? validateAcademyRoute(route) : null,
      evidence: str(s.evidence, 'evidence', 2000),
    };
  });
  return {
    title: str(b.title, 'title', 180, true), summary: str(b.summary, 'summary', 2000),
    trigger: str(b.trigger, 'trigger', 4000), prerequisites: str(b.prerequisites, 'prerequisites', 8000),
    warnings: str(b.warnings, 'warnings', 8000), successCriteria: str(b.successCriteria, 'successCriteria', 8000),
    allowedRoles: [...new Set(roles as string[])], steps,
  };
}
