import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { CleansingModule } from "../cleansing/cleansing.module";
import { DedupModule } from "../dedup/dedup.module";
import { StoriesModule } from "../stories/stories.module";
import { IngestionParserService } from "./ingestion-parser.service";
import { IngestionService } from "./ingestion.service";

@Module({
  imports: [CleansingModule, DedupModule, StoriesModule, AuditLogsModule],
  providers: [IngestionParserService, IngestionService],
  exports: [IngestionParserService, IngestionService]
})
export class IngestionModule {}
