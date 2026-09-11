import { IsString, MinLength } from 'class-validator';

export class ClassifyTicketDto {
  @IsString()
  @MinLength(1)
  message!: string;
}
