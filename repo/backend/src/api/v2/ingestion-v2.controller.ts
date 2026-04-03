import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Version
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { UrlBatchDto } from "../../modules/ingestion/dto/url-batch.dto";
import { IngestionParserService } from "../../modules/ingestion/ingestion-parser.service";
import { IngestionService } from "../../modules/ingestion/ingestion.service";
import { CsrfGuard } from "../../security/csrf/csrf.guard";

@ApiTags("ingestion-v2")
@Controller("ingestion")
@UseGuards(SessionGuard, PermissionGuard)
@Permissions("stories.review")
export class IngestionV2Controller {
  constructor(
    private readonly parserService: IngestionParserService,
    private readonly ingestionService: IngestionService
  ) {}

  @Post("upload")
  @Version("2")
  @UseGuards(CsrfGuard)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        source: { type: "string" },
        file: { type: "string", format: "binary" }
      },
      required: ["source", "file"]
    }
  })
  async upload(
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
    @Body("source") source: string,
    @Req() request: Request & { auth?: { userId: string } }
  ) {
    if (!file) {
      throw new BadRequestException("File is required");
    }
    const rows = this.parserService.parseFile(file.originalname, file.buffer, source);
    const result = await this.ingestionService.ingest(rows, source, request.auth?.userId);
    return {
      ...result,
      thresholds: {
        simhashMaxHamming: Number(process.env.SIMHASH_MAX_HAMMING ?? 8),
        minhashMinSimilarity: Number(process.env.MINHASH_MIN_SIMILARITY ?? 0.82)
      }
    };
  }

  @Post("url-batch")
  @Version("2")
  @UseGuards(CsrfGuard)
  async ingestUrls(
    @Body() payload: UrlBatchDto,
    @Req() request: Request & { auth?: { userId: string } }
  ) {
    const rows = this.parserService.parseUrlBatch(payload.urls, payload.source);
    const result = await this.ingestionService.ingest(rows, payload.source, request.auth?.userId);
    return {
      ...result,
      thresholds: {
        simhashMaxHamming: Number(process.env.SIMHASH_MAX_HAMMING ?? 8),
        minhashMinSimilarity: Number(process.env.MINHASH_MIN_SIMILARITY ?? 0.82)
      }
    };
  }
}
