import { OrderStatus } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  id!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsISO8601()
  deliveredAt?: string;
}