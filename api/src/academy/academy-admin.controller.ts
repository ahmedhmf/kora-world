import { Body, Controller, Get, Post, Put, Param, ParseIntPipe, Req, UseGuards, BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { requireAcademyRole } from './academy.policy';
import { parseIdentity, parseDraft } from './academy-draft.validation';

@Controller('academy/admin/processes')
@UseGuards(AuthGuard)
export class AcademyAdminController {
  constructor(private readonly db: DataSource) {}

  private async authorize(req: AuthenticatedRequest) {
    requireAcademyRole(req.user.role, true);
    const [db] = await this.db.query('SELECT current_database() AS name');
    if (db?.name !== 'kora_test') throw new ServiceUnavailableException('Academy pilot requires kora_test');
    return req.user.sub;
  }

  private async lockProcess(tx: EntityManager, id: number) {
    const [p] = await tx.query('SELECT * FROM academy_processes WHERE id=$1 AND archived_at IS NULL FOR UPDATE', [id]);
    if (!p) throw new NotFoundException('Active procedure not found');
  }

  private async writeDraft(tx: EntityManager, id: number, actor: number, d: ReturnType<typeof parseDraft>) {
    const [draft] = await tx.query('SELECT id, version FROM academy_process_versions WHERE process_id=$1 AND published_at IS NULL ORDER BY version DESC LIMIT 1', [id]);
    const params = [d.title,d.summary,d.trigger,d.prerequisites,d.warnings,d.successCriteria,d.allowedRoles];
    let versionId: number;
    let version: number;
    if (draft) {
      versionId = draft.id; version = draft.version;
      await tx.query('UPDATE academy_process_versions SET title=$1,summary=$2,trigger=$3,prerequisites=$4,warnings=$5,success_criteria=$6,allowed_roles=$7 WHERE id=$8 AND published_at IS NULL', [...params,versionId]);
      await tx.query('DELETE FROM academy_steps WHERE version_id=$1', [versionId]);
    } else {
      const [v] = await tx.query(`INSERT INTO academy_process_versions
        (title,summary,trigger,prerequisites,warnings,success_criteria,allowed_roles,process_id,created_by,version)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,(SELECT COALESCE(MAX(version),0)+1 FROM academy_process_versions WHERE process_id=$8))
        RETURNING id,version`, [...params,id,actor]);
      versionId = v.id; version = v.version;
    }
    for (const s of d.steps) {
      await tx.query('INSERT INTO academy_steps(version_id,position,title,instructions,app_route,evidence) VALUES ($1,$2,$3,$4,$5,$6)', [versionId,s.position,s.title,s.instructions,s.appRoute,s.evidence]);
    }
    return { id, versionId, version, status: 'draft' };
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    await this.authorize(req);
    return this.db.query(`SELECT p.*,v.id AS version_id,v.version,v.title,v.published_at
      FROM academy_processes p LEFT JOIN LATERAL
      (SELECT * FROM academy_process_versions WHERE process_id=p.id ORDER BY version DESC LIMIT 1) v ON true
      ORDER BY p.code`);
  }

  @Get(':id')
  async detail(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number) {
    await this.authorize(req);
    const [process] = await this.db.query('SELECT * FROM academy_processes WHERE id=$1', [id]);
    if (!process) throw new NotFoundException('Procedure not found');
    const versions = await this.db.query('SELECT * FROM academy_process_versions WHERE process_id=$1 ORDER BY version DESC', [id]);
    const latest = versions[0];
    const steps = latest ? await this.db.query('SELECT * FROM academy_steps WHERE version_id=$1 ORDER BY position', [latest.id]) : [];
    return { process, versions, steps };
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const actor = await this.authorize(req);
    const identity = parseIdentity(body);
    const draft = parseDraft(body);
    return this.db.transaction(async tx => {
      const [category] = await tx.query('SELECT id FROM academy_categories WHERE id=$1', [identity.categoryId]);
      if (!category) throw new BadRequestException('Unknown category');
      const rows = await tx.query('INSERT INTO academy_processes(code,slug,category_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id', [identity.code,identity.slug,identity.categoryId]);
      if (!rows.length) throw new ConflictException('Code or slug already exists');
      return this.writeDraft(tx, rows[0].id, actor, draft);
    });
  }

  @Put(':id/draft')
  async save(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const actor = await this.authorize(req);
    const draft = parseDraft(body);
    return this.db.transaction(async tx => {
      await this.lockProcess(tx,id);
      return this.writeDraft(tx,id,actor,draft);
    });
  }

  @Post(':id/publish/:versionId')
  async publish(@Req() req: AuthenticatedRequest, @Param('id', ParseIntPipe) id: number, @Param('versionId', ParseIntPipe) versionId: number) {
    const actor = await this.authorize(req);
    return this.db.transaction(async tx => {
      await this.lockProcess(tx,id);
      const [v] = await tx.query('SELECT id,version,published_at,success_criteria FROM academy_process_versions WHERE process_id=$1 ORDER BY version DESC LIMIT 1', [id]);
      if (!v || v.id !== versionId || v.published_at) throw new ConflictException('Only the current unpublished draft can be published');
      const [step] = await tx.query('SELECT id FROM academy_steps WHERE version_id=$1 LIMIT 1', [versionId]);
      if (!step || !v.success_criteria.trim()) throw new BadRequestException('Publishing requires steps and success criteria');
      await tx.query('UPDATE academy_process_versions SET published_at=now(),published_by=$1 WHERE id=$2 AND published_at IS NULL', [actor,versionId]);
      return { id,versionId,version:v.version,status:'published' };
    });
  }
}
