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

@ApiTags("editor-queue-v2")
@Controller("editor-queue")
@UseGuards(SessionGuard, PermissionGuard)
@Permissions("stories.review")
export class EditorQueueV2Controller {
  constructor(private readonly mergeService: MergeService) {}

  @Get()
  @Version("2")
  async getQueue() {
    const queue = await this.mergeService.getQueue();
    return {
      ...queue,
      mergeStrategies: ["replace", "append", "keep_both"]
    };
  }

  @Get(":storyId/diff")
  @Version("2")
  async getDiff(
    @Param("storyId") storyId: string,
    @Query("leftVersionId") leftVersionId: string,
    @Query("rightVersionId") rightVersionId: string,
    @Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } }
  ) {
    return this.mergeService.getDiff(request.auth, storyId, leftVersionId, rightVersionId);
  }

  @Post("merge")
  @Version("2")
  @UseGuards(CsrfGuard)
  async merge(
    @Body() payload: MergeRequestDto,
    @Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } }
  ) {
    return this.mergeService.merge(request.auth, payload);
  }

  @Post("repair/:versionId")
  @Version("2")
  @UseGuards(CsrfGuard)
  async repair(
    @Param("versionId") versionId: string,
    @Body() payload: RepairRequestDto,
    @Req() request: Request & { auth?: { userId: string; roles: string[]; permissions: string[] } }
  ) {
    return this.mergeService.repairVersion(request.auth, versionId, payload);
  }
}
