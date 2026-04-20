import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { WizardService } from './wizard.service';
import { Stage1Service } from './stages/stage-1.service';
import { Stage2Service } from './stages/stage-2.service';
import { Stage3Service } from './stages/stage-3.service';
import { Stage4Service } from './stages/stage-4.service';
import { FeedbackService, ClientFeedbackVerdict } from './feedback.service';
import { ApprovalService } from './approval.service';
import { ApprovalArtifact } from './approval.entity';
import { SheetNumber } from './row.entity';
import { WizardStepEvent } from '../observability/wizard-step-event.entity';

class Stage1InterviewDto {
  @IsUUID() projectId!: string;
  @IsString() transcript!: string;
}

class Stage1ClarifyDto {
  @IsUUID() projectId!: string;
  @IsObject() state!: Record<string, any>;
}

class Stage1FinalizeDto {
  @IsUUID() projectId!: string;
}

class OwnerTextDto {
  @IsUUID() projectId!: string;
  @IsString() text!: string;
}

class PositioningDto {
  @IsUUID() projectId!: string;
  @IsObject() inputs!: Record<string, any>;
}

class MessageTextDto {
  @IsUUID() projectId!: string;
  @IsString() text!: string;
}

class FeedbackDto {
  @IsUUID() projectId!: string;
  @IsString() artifact!: string;
  @IsIn(['reject', 'revise', 'accept']) verdict!: ClientFeedbackVerdict;
  @IsString() rejectedText!: string;
  @IsString() reasonText!: string;
  @IsOptional() @IsString() reformulationHint?: string;
  @IsOptional() @IsUUID() originalDraftId?: string;
}

class ApproveDto {
  @IsUUID() projectId!: string;
  @IsEnum(['legend', 'values', 'mission', 'vision', 'archetype_and_positioning', 'brand_message', 'final_document'])
  artifact!: ApprovalArtifact;
  @IsObject() snapshot!: Record<string, any>;
  @IsOptional() @IsString() generatedBy?: string | null;
  @IsOptional() @IsUUID() modifiedBy?: string | null;
  @IsOptional() isSelfApproval?: boolean;
}

class WizardEventDto {
  @IsUUID() projectId!: string;
  @IsIn([1, 2, 3, 4]) stage!: 1 | 2 | 3 | 4;
  @IsString() event!: WizardStepEvent;
  @IsOptional() @IsString() stepKey?: string;
  @IsOptional() @IsObject() meta?: Record<string, any>;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('wizard')
export class WizardController {
  constructor(
    private readonly wizard: WizardService,
    private readonly stage1: Stage1Service,
    private readonly stage2: Stage2Service,
    private readonly stage3: Stage3Service,
    private readonly stage4: Stage4Service,
    private readonly feedback: FeedbackService,
    private readonly approval: ApprovalService,
  ) {}

  // ----- Rows -----
  @Roles('chip_admin', 'tracker', 'marketer', 'owner_viewer')
  @Get('projects/:projectId/rows')
  listRows(@Param('projectId') projectId: string, @Query('sheet') sheet?: string) {
    return this.wizard.listRows(projectId, sheet ? (Number(sheet) as SheetNumber) : undefined);
  }

  @Roles('chip_admin', 'tracker', 'marketer')
  @Get('drafts/:rowId')
  listDrafts(@Param('rowId') rowId: string) {
    return this.wizard.listDraftsByRow(rowId);
  }

  // ----- Stage 1 -----
  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('stage-1/interview-patterns')
  stage1Interview(@Body() dto: Stage1InterviewDto, @CurrentUser() u: AuthenticatedUser) {
    return this.stage1.runInterviewPatterns(dto.projectId, u.id, dto.transcript);
  }

  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('stage-1/clarify-15q')
  stage1Clarify(@Body() dto: Stage1ClarifyDto, @CurrentUser() u: AuthenticatedUser) {
    return this.stage1.askClarifications(dto.projectId, u.id, dto.state);
  }

  /**
   * «Утвердить и перейти к Стадии 2». Маркетолог закрывает черновик паттернов
   * (не полный owner-approval — это маркёр окончания стадии 1, открывающий стадию 2).
   * Owner-approval Customer Portrait будет позже в рамках `final_document` на Стадии 4.
   */
  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('stage-1/finalize')
  stage1Finalize(@Body() dto: Stage1FinalizeDto) {
    return this.stage1.finalizeStage1(dto.projectId);
  }

  // ----- Stage 2 -----
  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('stage-2/challenge-owner')
  stage2Challenge(@Body() dto: OwnerTextDto, @CurrentUser() u: AuthenticatedUser) {
    return this.stage2.challengeOwnerResponse(dto.projectId, u.id, dto.text);
  }

  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('stage-2/legend-draft')
  stage2Legend(@Body() dto: OwnerTextDto, @CurrentUser() u: AuthenticatedUser) {
    return this.stage2.draftLegend(dto.projectId, u.id, dto.text);
  }

  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('stage-2/values-draft')
  stage2Values(@Body() dto: OwnerTextDto, @CurrentUser() u: AuthenticatedUser) {
    return this.stage2.draftValues(dto.projectId, u.id, dto.text);
  }

  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('stage-2/mission-variants')
  stage2Mission(@Body() dto: OwnerTextDto, @CurrentUser() u: AuthenticatedUser) {
    return this.stage2.missionVariants(dto.projectId, u.id, dto.text);
  }

  // ----- Stage 3 -----
  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('stage-3/positioning-draft')
  stage3Positioning(@Body() dto: PositioningDto, @CurrentUser() u: AuthenticatedUser) {
    return this.stage3.positioningDraft(dto.projectId, u.id, dto.inputs);
  }

  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('stage-3/message-variants')
  stage3Messages(@Body() dto: PositioningDto, @CurrentUser() u: AuthenticatedUser) {
    return this.stage3.messageVariants(dto.projectId, u.id, dto.inputs);
  }

  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('stage-3/critique')
  stage3Critique(@Body() dto: MessageTextDto, @CurrentUser() u: AuthenticatedUser) {
    return this.stage3.critiqueMessage(dto.projectId, u.id, dto.text);
  }

  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('stage-3/borderline')
  stage3Borderline(@Body() dto: MessageTextDto, @CurrentUser() u: AuthenticatedUser) {
    return this.stage3.borderlineClassify(dto.projectId, u.id, dto.text);
  }

  // ----- Stage 4 -----
  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('stage-4/tests')
  stage4Tests(@Body() dto: MessageTextDto, @CurrentUser() u: AuthenticatedUser) {
    return this.stage4.runAllTests(dto.projectId, u.id, dto.text);
  }

  // ----- Feedback -----
  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('feedback')
  submitFeedback(@Body() dto: FeedbackDto, @CurrentUser() u: AuthenticatedUser) {
    return this.feedback.submit({
      projectId: dto.projectId,
      userId: u.id,
      artifact: dto.artifact,
      verdict: dto.verdict,
      rejectedText: dto.rejectedText,
      reasonText: dto.reasonText,
      reformulationHint: dto.reformulationHint,
      originalDraftId: dto.originalDraftId,
    });
  }

  // ----- Approval -----
  // Approval — методологический инвариант «owner подписывает»; tracker намеренно
  // здесь НЕ указан. chip_admin — эмерджентный ворот (isSelfApproval при отсутствии
  // собственника). Operational tracker заменять собственника не может.
  @Roles('chip_admin', 'owner_viewer')
  @Post('approvals')
  approve(@Body() dto: ApproveDto, @CurrentUser() u: AuthenticatedUser) {
    return this.approval.approve({
      projectId: dto.projectId,
      artifact: dto.artifact,
      snapshotContent: dto.snapshot,
      approvedBy: u.id,
      responsibleUserId: u.id,
      generatedBy: dto.generatedBy ?? null,
      modifiedBy: dto.modifiedBy ?? null,
      isSelfApproval: Boolean(dto.isSelfApproval),
    });
  }

  @Roles('chip_admin', 'tracker', 'marketer', 'owner_viewer')
  @Get('projects/:projectId/approvals')
  approvals(@Param('projectId') projectId: string) {
    return this.approval.listForProject(projectId);
  }

  // ----- UX telemetry -----
  @Roles('chip_admin', 'tracker', 'marketer', 'owner_viewer')
  @Post('events')
  recordEvent(@Body() dto: WizardEventDto, @CurrentUser() u: AuthenticatedUser) {
    return this.wizard.recordEvent(u.id, dto.projectId, dto.stage, dto.event, dto.stepKey, dto.meta);
  }
}
