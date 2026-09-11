import { IsEmail, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SeedTestOrderDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(3650)
  deliveredDaysAgo?: number;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;
}
