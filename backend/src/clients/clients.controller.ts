import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClientsService } from './clients.service';
import { ContractParserService } from './contract-parser.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

class CreateClientDto {
  @IsString() @MaxLength(255) name!: string;
  @IsEnum(['ooo', 'ip', 'self_employed', 'individual']) legalForm!: 'ooo' | 'ip' | 'self_employed' | 'individual';
  @IsOptional() @IsString() inn?: string;
  @IsOptional() @IsString() ogrn?: string;
  @IsOptional() @IsString() legalAddress?: string;
  @IsOptional() contactEmail?: string;
  @IsOptional() contactPhone?: string;
}

class ParseContractDto {
  // Принимаем либо ссылку на Google Docs, либо в будущем raw-текст (для file upload).
  // Пока MVP — только gdocUrl; file upload добавим когда появится endpoint приёма multipart.
  @IsOptional() @IsString() @MaxLength(1000) gdocUrl?: string;
  @IsOptional() @IsString() @MaxLength(120_000) text?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly contractParser: ContractParserService,
  ) {}

  // Парсинг договора — первый шаг CreateClientWizard. Принимает ссылку на
  // Google Docs (или, в будущем, raw-текст) и возвращает реквизиты Заказчика +
  // warnings[] для пустых полей. Доступно chip_admin И tracker — tracker тоже
  // заводит клиентов в операционке. Marketer/owner — нет, они не создают клиентов.
  @Roles('chip_admin', 'tracker')
  @Post('parse-contract')
  async parseContract(@Body() dto: ParseContractDto) {
    if (dto.gdocUrl) return this.contractParser.parseFromGoogleDocs(dto.gdocUrl);
    if (dto.text) return this.contractParser.parseFromText(dto.text);
    throw new BadRequestException('Нужен gdocUrl или text');
  }

  // tracker видит список клиентов (ему нужно знать, на каком клиенте сидит проект),
  // но НЕ создаёт/редактирует юрлица — это делает Чиркова (chip_admin).
  @Roles('chip_admin', 'tracker')
  @Get()
  list() {
    return this.clients.list();
  }

  // Detail для /admin/clients/:id. Возвращаем клиента + nested projects → roles → user
  // одним запросом. Фронт использует это для рендера «собственник X, маркетолог Y»
  // без дополнительных round-trip'ов.
  @Roles('chip_admin', 'tracker')
  @Get(':id')
  async get(@Param('id') id: string) {
    const detail = await this.clients.getDetail(id);
    if (!detail) throw new NotFoundException('Клиент не найден');
    return detail;
  }

  @Roles('chip_admin')
  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clients.create(dto);
  }

  @Roles('chip_admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateClientDto>) {
    return this.clients.update(id, dto);
  }

  // Удаление клиента — только chip_admin (tracker не может сносить юрлица).
  // Сервис делает транзакционный каскад: проекты + их required-дети удаляются,
  // prompt_runs/audit_events/invoices — SET NULL (финансовая и observability-история
  // сохраняется). Повторный CJM-прогон после этого начинается с чистого листа.
  @Roles('chip_admin')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.clients.remove(id);
  }
}
