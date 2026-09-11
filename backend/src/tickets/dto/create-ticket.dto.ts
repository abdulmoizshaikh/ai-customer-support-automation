import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  message!: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}
