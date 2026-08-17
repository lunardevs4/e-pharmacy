import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { InsuranceDashboardService } from './insurance-dashboard.service';
import { InsurancePharmaciesService } from './insurance-pharmacies.service';
import { InsuranceTariffsService } from './insurance-tariffs.service';
import { InsuranceClaimsService } from './insurance-claims.service';
import { InsuredPatientsService } from './insured-patients.service';
import { Roles } from '../common/guards/roles.decorator';
import { UserRole } from '../generated/prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateInsuranceProviderDto,
  UpdateInsuranceProviderDto,
  CreatePharmacyAgreementDto,
  UpdatePharmacyAgreementDto,
  SetMedicineTariffDto,
  BatchUpdateTariffDto,
  CreateInsuranceClaimDto,
  UpdateClaimStatusDto,
  BatchPayClaimsDto,
  RegisterInsuredPatientDto,
  VerifyPolicyDto,
  InsuranceDashboardQueryDto,
} from './dto/insurance.dto';

@ApiTags('Insurance')
@Controller('api/v1/insurance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InsuranceDashboardController {
  constructor(
    private dashboardService: InsuranceDashboardService,
    private pharmaciesService: InsurancePharmaciesService,
    private tariffsService: InsuranceTariffsService,
    private claimsService: InsuranceClaimsService,
    private patientsService: InsuredPatientsService,
  ) {}

  // Dashboard Summary
  @Get('summary')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get insurance dashboard summary' })
  @ApiQuery({ name: 'insuranceId', required: false })
  async getSummary(@Query('insuranceId') insuranceId?: string) {
    return this.dashboardService.getSummary(insuranceId);
  }

  // Claims Endpoints
  @Get('claims')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get insurance claims with filtering' })
  @ApiQuery({ name: 'insuranceId', required: false })
  @ApiQuery({ name: 'pharmacyId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getClaims(
    @Query('insuranceId') insuranceId?: string,
    @Query('pharmacyId') pharmacyId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.claimsService.getClaims(
      insuranceId,
      pharmacyId,
      status,
      startDate,
      endDate,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('claims/:id')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get claim by ID' })
  @ApiParam({ name: 'id', description: 'Claim ID' })
  async getClaimById(@Param('id') id: string) {
    return this.claimsService.getClaimById(id);
  }

  @Post('claims')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create new insurance claim' })
  async createClaim(@Body() dto: CreateInsuranceClaimDto) {
    return this.claimsService.createClaim(dto);
  }

  @Patch('claims/:id/status')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update claim status' })
  @ApiParam({ name: 'id', description: 'Claim ID' })
  async updateClaimStatus(@Param('id') id: string, @Body() dto: UpdateClaimStatusDto) {
    return this.claimsService.updateClaimStatus(id, dto);
  }

  @Post('claims/batch-pay')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Batch pay approved claims' })
  async batchPayClaims(@Body() dto: BatchPayClaimsDto) {
    return this.claimsService.batchPayClaims(dto);
  }

  @Get('claims/outstanding')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get outstanding payments' })
  @ApiQuery({ name: 'pharmacyId', required: false })
  async getOutstandingPayments(@Query('pharmacyId') pharmacyId?: string) {
    return this.claimsService.getOutstandingPayments(pharmacyId);
  }

  // Pharmacy Agreements Endpoints
  @Get('pharmacies')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get pharmacy agreements' })
  @ApiQuery({ name: 'insuranceId', required: false })
  @ApiQuery({ name: 'pharmacyId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async getAgreements(
    @Query('insuranceId') insuranceId?: string,
    @Query('pharmacyId') pharmacyId?: string,
    @Query('status') status?: string,
  ) {
    return this.pharmaciesService.getAgreements(insuranceId, pharmacyId, status);
  }

  @Get('pharmacies/agreements/:id')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get agreement by ID' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async getAgreementById(@Param('id') id: string) {
    return this.pharmaciesService.getAgreementById(id);
  }

  @Post('pharmacies/agreement')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create pharmacy agreement' })
  async createAgreement(@Body() dto: CreatePharmacyAgreementDto) {
    return this.pharmaciesService.createAgreement(dto);
  }

  @Patch('pharmacies/agreements/:id')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update pharmacy agreement' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async updateAgreement(@Param('id') id: string, @Body() dto: UpdatePharmacyAgreementDto) {
    return this.pharmaciesService.updateAgreement(id, dto);
  }

  @Get('pharmacies/:pharmacyId/claims-summary')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get pharmacy claims summary' })
  @ApiParam({ name: 'pharmacyId', description: 'Pharmacy ID' })
  async getPharmacyClaimsSummary(@Param('pharmacyId') pharmacyId: string) {
    return this.pharmaciesService.getPharmacyClaimsSummary(pharmacyId);
  }

  @Post('pharmacies/sync-tariffs/:insuranceId')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Sync tariff updates to pharmacies' })
  @ApiParam({ name: 'insuranceId', description: 'Insurance ID' })
  async syncTariffUpdates(@Param('insuranceId') insuranceId: string) {
    return this.pharmaciesService.syncTariffUpdates(insuranceId);
  }

  // Tariffs Endpoints
  @Get('tariffs')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get medicine tariffs' })
  @ApiQuery({ name: 'insuranceId', required: false })
  @ApiQuery({ name: 'medicineId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async getTariffs(
    @Query('insuranceId') insuranceId?: string,
    @Query('medicineId') medicineId?: string,
    @Query('status') status?: string,
  ) {
    return this.tariffsService.getTariffs(insuranceId, medicineId, status);
  }

  @Get('tariffs/:id')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get tariff by ID' })
  @ApiParam({ name: 'id', description: 'Tariff ID' })
  async getTariffById(@Param('id') id: string) {
    return this.tariffsService.getTariffById(id);
  }

  @Post('tariffs')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Set medicine tariff' })
  async setTariff(@Body() dto: SetMedicineTariffDto) {
    return this.tariffsService.setTariff(dto);
  }

  @Post('tariffs/batch')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Batch update tariffs' })
  async batchUpdateTariffs(@Body() dto: BatchUpdateTariffDto) {
    return this.tariffsService.batchUpdateTariffs(dto);
  }

  @Patch('tariffs/:id')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update tariff' })
  @ApiParam({ name: 'id', description: 'Tariff ID' })
  async updateTariff(@Param('id') id: string, @Body() dto: Partial<SetMedicineTariffDto>) {
    return this.tariffsService.updateTariff(id, dto);
  }

  @Get('tariffs/calculate-copay')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Calculate copay for medicine' })
  @ApiQuery({ name: 'insuranceId', required: true })
  @ApiQuery({ name: 'medicineId', required: true })
  @ApiQuery({ name: 'retailPrice', required: true, type: Number })
  async calculateCopay(
    @Query('insuranceId') insuranceId: string,
    @Query('medicineId') medicineId: string,
    @Query('retailPrice') retailPrice: string,
  ) {
    return this.tariffsService.calculateCopay(insuranceId, medicineId, parseFloat(retailPrice));
  }

  // Insured Patients Endpoints
  @Get('patients')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get insured patients' })
  @ApiQuery({ name: 'insuranceId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPatients(
    @Query('insuranceId') insuranceId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.patientsService.getPatients(
      insuranceId,
      status,
      search,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  @Get('patients/:id')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get insured patient by ID' })
  @ApiParam({ name: 'id', description: 'Patient ID' })
  async getPatientById(@Param('id') id: string) {
    return this.patientsService.getPatientById(id);
  }

  @Post('patients')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Register insured patient' })
  async registerPatient(@Body() dto: RegisterInsuredPatientDto) {
    return this.patientsService.registerPatient(dto);
  }

  @Patch('patients/:id')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update insured patient' })
  @ApiParam({ name: 'id', description: 'Patient ID' })
  async updatePatient(@Param('id') id: string, @Body() dto: Partial<RegisterInsuredPatientDto>) {
    return this.patientsService.updatePatient(id, dto);
  }

  @Get('patients/verify/:identifier')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Verify patient policy' })
  @ApiParam({ name: 'identifier', description: 'Policy number or national ID' })
  async verifyPolicy(@Param('identifier') identifier: string) {
    return this.patientsService.verifyPolicy({ policyNumber: identifier });
  }

  @Post('patients/verify')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Verify patient policy with details' })
  async verifyPolicyWithDetails(@Body() dto: VerifyPolicyDto) {
    return this.patientsService.verifyPolicy(dto);
  }

  @Get('patients/search/national-id/:nationalId')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Search patients by national ID' })
  @ApiParam({ name: 'nationalId', description: 'National ID' })
  async searchByNationalId(@Param('nationalId') nationalId: string) {
    return this.patientsService.searchByNationalId(nationalId);
  }

  // Insurance Providers Endpoints
  @Get('providers')
  @Roles(UserRole.INSURANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get insurance providers' })
  async getProviders() {
    // This would be implemented in a separate InsuranceProvidersService
    return { message: 'Insurance providers endpoint - to be implemented' };
  }
}
