import { Body, Controller, Get, Param, Post, Req, UseGuards, Version } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { FreezeTransactionDto } from "../../modules/freezes/dto/freeze-transaction.dto";
import { ReleaseFreezeDto } from "../../modules/freezes/dto/release-freeze.dto";
import { FreezesService } from "../../modules/freezes/freezes.service";
import { CreateRefundDto } from "../../modules/refunds/dto/create-refund.dto";
import { RefundsService } from "../../modules/refunds/refunds.service";
import { ApproveChargeDto } from "../../modules/transactions/dto/approve-charge.dto";
import { CreateChargeDto } from "../../modules/transactions/dto/create-charge.dto";
import { TransactionsService } from "../../modules/transactions/transactions.service";
import { CsrfGuard } from "../../security/csrf/csrf.guard";

@ApiTags("transactions-v2")
@Controller("transactions")
@UseGuards(SessionGuard, PermissionGuard)
export class TransactionsV2Controller {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly refundsService: RefundsService,
    private readonly freezesService: FreezesService
  ) {}

  @Get()
  @Version("2")
  @Permissions("transactions.read")
  async list(@Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } }) {
    const data = await this.transactionsService.list(request.auth);
    return {
      ...data,
      config: {
        licensedStoryBundleCents: Number(process.env.LICENSED_STORY_BUNDLE_CENTS ?? 2500)
      }
    };
  }

  @Get("story-versions")
  @Version("2")
  @Permissions("transactions.read")
  async storyVersions() {
    return this.transactionsService.listStoryVersionOptions();
  }

  @Get(":id/history")
  @Version("2")
  @Permissions("transactions.read")
  async history(
    @Param("id") transactionId: string,
    @Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } }
  ) {
    return this.transactionsService.history(request.auth, transactionId);
  }

  @Post("charges")
  @Version("2")
  @UseGuards(CsrfGuard)
  @Permissions("finance.review")
  async createCharge(
    @Body() payload: CreateChargeDto,
    @Req() request: Request & { auth?: { userId: string } }
  ) {
    return this.transactionsService.createCharge(request.auth?.userId, payload);
  }

  @Post(":id/approve")
  @Version("2")
  @UseGuards(CsrfGuard)
  @Permissions("finance.review")
  async approveCharge(
    @Param("id") transactionId: string,
    @Body() payload: ApproveChargeDto,
    @Req() request: Request & { auth?: { userId: string } }
  ) {
    return this.transactionsService.approveCharge(request.auth?.userId, transactionId, payload);
  }

  @Post(":id/refunds")
  @Version("2")
  @UseGuards(CsrfGuard)
  @Permissions("finance.refund")
  async refund(
    @Param("id") transactionId: string,
    @Body() payload: CreateRefundDto,
    @Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } }
  ) {
    return this.refundsService.refund(request.auth, transactionId, payload);
  }

  @Post(":id/freeze")
  @Version("2")
  @UseGuards(CsrfGuard)
  @Permissions("finance.freeze")
  async freeze(
    @Param("id") transactionId: string,
    @Body() payload: FreezeTransactionDto,
    @Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } }
  ) {
    return this.freezesService.freeze(request.auth, transactionId, payload);
  }

  @Post(":id/release")
  @Version("2")
  @UseGuards(CsrfGuard)
  @Permissions("auditor.release_freeze")
  async release(
    @Param("id") transactionId: string,
    @Body() payload: ReleaseFreezeDto,
    @Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } }
  ) {
    return this.freezesService.release(request.auth, transactionId, payload);
  }
}
