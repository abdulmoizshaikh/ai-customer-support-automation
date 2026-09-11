import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApprovalActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(400)
  reason?: string;
}
