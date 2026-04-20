import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './project.entity';
import { ProjectRole } from './project-role.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectRole]),
    ObservabilityModule,
  ],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService, TypeOrmModule],
})
export class ProjectsModule {}
