import { Controller, Get, Param, Req, UseGuards, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { requireAcademyRole } from './academy.policy';

@Controller('academy')
@UseGuards(AuthGuard)
export class AcademyController {
  constructor(private readonly db: DataSource) {}

  private async authorize(req: AuthenticatedRequest): Promise<string> {
    requireAcademyRole(req.user.role);
    const [db] = await this.db.query('SELECT current_database() AS name');
    if (db?.name !== 'kora_test') throw new ServiceUnavailableException('Academy pilot requires kora_test');
    return req.user.role;
  }

  @Get('categories')
  async categories(@Req() req: AuthenticatedRequest) {
    await this.authorize(req);
    return this.db.query('SELECT id, code, name, sort_order FROM academy_categories ORDER BY sort_order, id');
  }

  @Get('processes')
  async processes(@Req() req: AuthenticatedRequest) {
    const role = await this.authorize(req);
    return this.db.query(`SELECT p.code,p.slug,p.category_id,v.id AS version_id,v.version,v.title,v.summary
      FROM academy_processes p
      JOIN LATERAL (SELECT * FROM academy_process_versions x WHERE x.process_id=p.id
        AND x.published_at IS NOT NULL ORDER BY x.version DESC LIMIT 1) v ON true
      WHERE p.archived_at IS NULL AND $1=ANY(v.allowed_roles)
      ORDER BY v.title`, [role]);
  }

  @Get('processes/:slug')
  async process(@Req() req: AuthenticatedRequest, @Param('slug') slug: string) {
    const role = await this.authorize(req);
    const [lesson] = await this.db.query(`SELECT p.code,p.slug,p.category_id,v.id AS version_id,v.version,
      v.title,v.summary,v.trigger,v.prerequisites,v.warnings,v.success_criteria,v.video_url,v.published_at
      FROM academy_processes p
      JOIN LATERAL (SELECT * FROM academy_process_versions x WHERE x.process_id=p.id
        AND x.published_at IS NOT NULL ORDER BY x.version DESC LIMIT 1) v ON true
      WHERE p.archived_at IS NULL AND p.slug=$1 AND $2=ANY(v.allowed_roles)`, [slug, role]);
    if (!lesson) throw new NotFoundException('Published procedure not found');
    const steps = await this.db.query('SELECT id,position,title,instructions,app_route,evidence FROM academy_steps WHERE version_id=$1 ORDER BY position', [lesson.version_id]);
    return { ...lesson, steps };
  }
}
