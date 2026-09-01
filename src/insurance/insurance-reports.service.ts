import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import * as PDFDocument from 'pdfkit';
import * as xlsx from 'xlsx';
import { Response } from 'express';

@Injectable()
export class InsuranceReportsService {
  constructor(private prisma: PrismaService) {}

  async generateMonthlySummary(insuranceId: string, res: Response) {
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="monthly-summary.pdf"');
    doc.pipe(res);
    
    doc.fontSize(20).text('Monthly Claims Summary', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated for Insurance Provider: ${insuranceId}`);
    
    doc.end();
  }

  async generatePayoutRegister(insuranceId: string, res: Response) {
    const data = [
      { claimId: '1', pharmacy: 'Pharma A', amount: 1000 },
      { claimId: '2', pharmacy: 'Pharma B', amount: 2000 }
    ]; 

    const worksheet = xlsx.utils.json_to_sheet(data);
    const csv = xlsx.utils.sheet_to_csv(worksheet);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payout-register.csv"');
    res.send(csv);
  }
}
