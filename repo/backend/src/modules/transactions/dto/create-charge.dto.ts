import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateChargeDto {
  @IsString()
  @IsUUID()
  storyVersionId!: string;

  @IsString()
  @IsIn(["prepaid_balance", "invoice_credit", "purchase_order_settlement"])
  channel!: "prepaid_balance" | "invoice_credit" | "purchase_order_settlement";

  @IsOptional()
  @IsInt()
  @Min(1)
  bundleCount?: number;
}
