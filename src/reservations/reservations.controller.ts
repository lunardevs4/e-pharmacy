import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiParam } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto, UpdateReservationStatusDto } from './dto/reservations.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { UserRole, ReservationStatus } from '@generated/prisma';

@ApiTags('Reservations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('api/v1')
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) { }

  @Post('reservations')
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'Create reservation (patient only)',
    description: 'Endpoint: POST /api/v1/reservations',
  })
  @ApiBody({
    type: CreateReservationDto,
    examples: {
      default: {
        value: {
          pharmacyId: '550e8400-e29b-41d4-a716-446655440000',
          medicineId: '550e8400-e29b-41d4-a716-446655440001',
          quantity: 2,
          expiresAt: '2025-08-01T18:00:00.000Z',
        },
      },
      bulkReservation: {
        value: {
          pharmacyId: '550e8400-e29b-41d4-a716-446655440000',
          medicineId: '550e8400-e29b-41d4-a716-446655440002',
          quantity: 5,
          expiresAt: '2025-07-28T12:00:00.000Z',
        },
      },
    },
  })
  create(@Req() req: any, @Body() createReservationDto: CreateReservationDto) {
    return this.reservationsService.create(req.user, createReservationDto);
  }

  @Get('reservations')
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'View my reservations (patient only)',
    description: 'Endpoint: GET /api/v1/reservations\n\nReturns all reservations for the currently authenticated patient.',
  })
  findByPatient(@Req() req: any) {
    return this.reservationsService.findByPatient(req.user);
  }

  @Patch('reservations/:id/cancel')
  @Roles(UserRole.PATIENT)
  @ApiOperation({
    summary: 'Cancel my reservation (patient only)',
    description: 'Endpoint: PATCH /api/v1/reservations/:id/cancel\n\nURL Parameters:\n- id (UUID): The unique identifier of the reservation',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Reservation UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  cancelPatient(@Param('id') id: string, @Req() req: any) {
    return this.reservationsService.cancelPatient(req.user, id);
  }

  @Get('pharmacies/:pharmacyId/reservations')
  @Roles(UserRole.PHARMACY_OWNER, UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'View pharmacy reservations',
    description: 'Endpoint: GET /api/v1/pharmacies/:pharmacyId/reservations\n\nURL Parameters:\n- pharmacyId (UUID): The unique identifier of the pharmacy',
  })
  @ApiParam({ name: 'pharmacyId', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  findByPharmacy(@Param('pharmacyId') pharmacyId: string, @Req() req: any) {
    return this.reservationsService.findByPharmacy(pharmacyId, req.user);
  }

  @Patch('pharmacies/:pharmacyId/reservations/:id')
  @Roles(UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'Confirm/manage reservation status (pharmacist only)',
    description: 'Endpoint: PATCH /api/v1/pharmacies/:pharmacyId/reservations/:id\n\nURL Parameters:\n- pharmacyId (UUID): The unique identifier of the pharmacy\n- id (UUID): The unique identifier of the reservation',
  })
  @ApiParam({ name: 'pharmacyId', type: 'string', description: 'Pharmacy UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiParam({ name: 'id', type: 'string', description: 'Reservation UUID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @ApiBody({
    type: UpdateReservationStatusDto,
    examples: {
      confirm: {
        value: {
          status: ReservationStatus.CONFIRMED,
        },
      },
      collected: {
        value: {
          status: ReservationStatus.COLLECTED,
        },
      },
      cancelled: {
        value: {
          status: ReservationStatus.CANCELLED,
        },
      },
      pending: {
        value: {
          status: ReservationStatus.PENDING,
        },
      },
    },
  })
  updatePharmacyStatus(
    @Param('pharmacyId') pharmacyId: string,
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateDto: UpdateReservationStatusDto,
  ) {
    return this.reservationsService.updatePharmacyStatus(pharmacyId, req.user, id, updateDto);
  }
}
