import { Module } from '@nestjs/common';
import { InsuranceDashboardController } from './insurance-dashboard.controller';
import { InsuranceDashboardService } from './insurance-dashboard.service';
import { InsurancePharmaciesService } from './insurance-pharmacies.service';
import { InsuranceTariffsService } from './insurance-tariffs.service';
import { InsuranceClaimsService } from './insurance-claims.service';
import { InsuredPatientsService } from './insured-patients.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InsuranceDashboardController],
  providers: [
    InsuranceDashboardService,
    InsurancePharmaciesService,
    InsuranceTariffsService,
    InsuranceClaimsService,
    InsuredPatientsService,
  ],
  exports: [
    InsuranceDashboardService,
    InsurancePharmaciesService,
    InsuranceTariffsService,
    InsuranceClaimsService,
    InsuredPatientsService,
  ],
})
export class InsuranceDashboardModule {}
