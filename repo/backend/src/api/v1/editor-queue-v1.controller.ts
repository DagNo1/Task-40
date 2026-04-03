import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  Version
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { MergeRequestDto } from "../../modules/merge/dto/merge-request.dto";
import { RepairRequestDto } from "../../modules/merge/dto/repair-request.dto";
import { MergeService } from "../../modules/merge/merge.service";
import { CsrfGuard } from "../../security/csrf/csrf.guard";

@ApiTags("editor-queue-v1")
@Controller("editor-queue")
@UseGuards(SessionGuard, PermissionGuard)
@Permissions("stories.review")
export class EditorQueueV1Controller {
  constructor(private readonly mergeService: MergeService) {}

  @Get()
  @Version("1")
  async getQueue() {
    return this.mergeService.getQueue();
  }

  @Get(":storyId/diff")
  @Version("1")
  async getDiff(
    @Param("storyId") storyId: string,
    @Query("leftVersionId") leftVersionId: string,
    @Query("rightVersionId") rightVersionId: string,
    @Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } }
  ) {
    return this.mergeService.getDiff(request.auth, storyId, leftVersionId, rightVersionId);
  }

  @Post("merge")
  @Version("1")
  @UseGuards(CsrfGuard)
  @Permissions("stories.review")
  async merge(
    @Body() payload: MergeRequestDto,
    @Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } }
  ) {
    return this.mergeService.merge(request.auth, payload);
  }

  @Post("repair/:versionId")
  @Version("1")
  @UseGuards(CsrfGuard)
  @Permissions("stories.review")
  async repair(
    @Param("versionId") versionId: string,
    @Body() payload: RepairRequestDto,
    @Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } }
  ) {
    return this.mergeService.repairVersion(request.auth, versionId, payload);
  }
}
