import { IsString, MinLength } from 'class-validator';

export class IngestDocumentDto {
  @IsString()
  @MinLength(1)
  filename!: string;

  @IsString()
  @MinLength(1)
  content!: string;
}
