import { Controller, Get, Post, Body, Param, ParseIntPipe, Req, UseGuards, BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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
    const [completion] = await this.db.query('SELECT 1 FROM academy_training_completions WHERE user_id=$1 AND version_id=$2', [req.user.sub, lesson.version_id]);
    return { ...lesson, steps, completed: !!completion };
  }

  @Post('training/:versionId/complete')
  async complete(@Req() req: AuthenticatedRequest, @Param('versionId', ParseIntPipe) versionId: number, @Body() body: unknown) {
    const role = await this.authorize(req);
    const ids = (body as {stepIds?: unknown} | null)?.stepIds;
    if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
      throw new BadRequestException('Invalid step acknowledgements');
    }
    return this.db.transaction(async tx => {
      const [version] = await tx.query(`SELECT v.id FROM academy_process_versions v
        JOIN academy_processes p ON p.id=v.process_id
        WHERE v.id=$1 AND p.archived_at IS NULL AND v.published_at IS NOT NULL
        AND $2=ANY(v.allowed_roles)
        AND NOT EXISTS (SELECT 1 FROM academy_process_versions newer WHERE newer.process_id=p.id
          AND newer.published_at IS NOT NULL AND newer.version>v.version)`, [versionId,role]);
      if (!version) throw new NotFoundException('Current published procedure not found');
      const steps: {id:number}[] = await tx.query('SELECT id FROM academy_steps WHERE version_id=$1', [versionId]);
      const acknowledged = new Set(ids);
      if (!steps.length || acknowledged.size !== steps.length || steps.some(s=>!acknowledged.has(s.id))) {
        throw new BadRequestException('Acknowledge every step of this version');
      }
      await tx.query('INSERT INTO academy_training_completions(user_id,version_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.sub,versionId]);
      return {completed:true};
    });
  }
}
