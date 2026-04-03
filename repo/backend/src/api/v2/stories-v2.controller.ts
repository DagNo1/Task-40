import { Controller, Get, Query, UseGuards, Version } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { StoriesService } from "../../modules/stories/stories.service";

@ApiTags("stories-v2")
@Controller("stories")
@UseGuards(SessionGuard, PermissionGuard)
@Permissions("stories.review")
export class StoriesV2Controller {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  @Version("2")
  async list(@Query("q") q?: string) {
    return this.storiesService.listStories(q);
  }
}
