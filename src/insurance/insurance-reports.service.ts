import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import PDFDocument = require('pdfkit');
import * as xlsx from 'xlsx';
import { Response } from 'express';

@Injectable()
export class InsuranceReportsService {
  constructor(private prismaService: PrismaService) {}

  async generateMonthlySummary(insuranceId: string, res: Response) {
    const prisma = this.prismaService.prisma;

    const provider = await prisma.insuranceProvider.findUnique({
      where: { id: insuranceId },
    });

    if (!provider) {
      throw new NotFoundException('Insurance provider not found');
    }

    const claims = await prisma.insuranceClaim.findMany({
      where: { insuranceId },
      include: {
        pharmacy: { select: { name: true } },
        medicine: { select: { tradeName: true, genericName: true } },
      },
      orderBy: { claimedAt: 'desc' },
      take: 100,
    });

    const totalClaims = claims.length;
    const totalAmount = claims.reduce(
      (sum, c) => sum + Number(c.totalAmount || 0),
      0,
    );
    const insuranceAmount = claims.reduce(
      (sum, c) => sum + Number(c.insuranceAmount || 0),
      0,
    );
    const patientAmount = claims.reduce(
      (sum, c) => sum + Number(c.patientAmount || 0),
      0,
    );

    const approvedCount = claims.filter((c) => c.status === 'APPROVED').length;
    const pendingCount = claims.filter((c) => c.status === 'PENDING').length;
    const rejectedCount = claims.filter((c) => c.status === 'REJECTED').length;
    const paidCount = claims.filter((c) => c.status === 'PAID').length;

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${provider.code}_monthly_summary.pdf"`,
    );
    doc.pipe(res);

    // Header
    doc
      .fontSize(20)
      .fillColor('#064e3b')
      .text(`${provider.name} (${provider.code})`, { align: 'center' });
    doc
      .fontSize(14)
      .fillColor('#374151')
      .text('Monthly Claims & Co-Pay Summary Report', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor('#6b7280')
      .text(`Generated Date: ${new Date().toLocaleDateString()}`, {
        align: 'center',
      });
    doc.moveDown(1.5);

    // Summary Box
    doc.fontSize(12).fillColor('#111827').text('Overview Statistics', {
      underline: true,
    });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor('#374151')
      .text(`Total Processed Claims: ${totalClaims}`)
      .text(`Total Claims Value: RWF ${totalAmount.toLocaleString()}`)
      .text(`Insurance Contribution: RWF ${insuranceAmount.toLocaleString()}`)
      .text(`Patient Contribution (Co-Pay): RWF ${patientAmount.toLocaleString()}`)
      .moveDown(0.5)
      .text(
        `Status Breakdown: Approved (${approvedCount}) | Paid (${paidCount}) | Pending (${pendingCount}) | Rejected (${rejectedCount})`,
      );

    doc.moveDown(1.5);

    // Table Header
    doc.fontSize(11).fillColor('#111827').text('Recent Claims Breakdown', {
      underline: true,
    });
    doc.moveDown(0.5);

    doc.fontSize(9).fillColor('#4b5563');
    doc.text(
      'Claim #             Pharmacy                    Medicine                        Amount (RWF)   Status',
    );
    doc
      .strokeColor('#d1d5db')
      .moveTo(40, doc.y + 2)
      .lineTo(550, doc.y + 2)
      .stroke();
    doc.moveDown(0.5);

    claims.slice(0, 25).forEach((claim) => {
      const claimNo = (claim.claimNumber || '').padEnd(18);
      const pharmacy = (claim.pharmacy?.name || 'Unknown').slice(0, 22).padEnd(25);
      const medicine = (
        claim.medicine?.tradeName ||
        claim.medicine?.genericName ||
        'Unknown'
      )
        .slice(0, 25)
        .padEnd(28);
      const amount = Number(claim.insuranceAmount || 0)
        .toLocaleString()
        .padStart(12);
      const status = claim.status;

      doc
        .fontSize(8)
        .fillColor('#1f2937')
        .text(`${claimNo}${pharmacy}${medicine}${amount}   ${status}`);
    });

    doc.end();
  }

  async generatePayoutRegister(insuranceId: string, res: Response) {
    const prisma = this.prismaService.prisma;

    const provider = await prisma.insuranceProvider.findUnique({
      where: { id: insuranceId },
    });

    const claims = await prisma.insuranceClaim.findMany({
      where: {
        insuranceId,
        status: { in: ['APPROVED', 'PAID'] },
      },
      include: {
        pharmacy: { select: { name: true, phone: true } },
        medicine: { select: { tradeName: true, genericName: true } },
      },
      orderBy: { claimedAt: 'desc' },
    });

    const data = claims.map((c) => ({
      Claim_ID: c.claimNumber,
      Pharmacy_Name: c.pharmacy?.name || 'Unknown',
      Pharmacy_Phone: c.pharmacy?.phone || '',
      Medicine: c.medicine?.tradeName || c.medicine?.genericName || '',
      Quantity: c.quantity,
      Unit_Price_RWF: Number(c.unitPrice),
      Total_Claim_Amount_RWF: Number(c.totalAmount),
      Insurance_Payout_RWF: Number(c.insuranceAmount),
      Patient_Copay_RWF: Number(c.patientAmount),
      Claim_Status: c.status,
      Claimed_At: new Date(c.claimedAt).toISOString().split('T')[0],
      Paid_At: c.paidAt ? new Date(c.paidAt).toISOString().split('T')[0] : 'UNPAID',
    }));

    const worksheet = xlsx.utils.json_to_sheet(
      data.length > 0
        ? data
        : [
            {
              Claim_ID: 'N/A',
              Pharmacy_Name: 'No approved claims',
              Pharmacy_Phone: '',
              Medicine: '',
              Quantity: 0,
              Unit_Price_RWF: 0,
              Total_Claim_Amount_RWF: 0,
              Insurance_Payout_RWF: 0,
              Patient_Copay_RWF: 0,
              Claim_Status: 'NONE',
              Claimed_At: '',
              Paid_At: '',
            },
          ],
    );
    const csv = xlsx.utils.sheet_to_csv(worksheet);

    const filename = `${provider?.code || 'insurance'}_payout_register.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  }

  async generateRejectionAnalysis(insuranceId: string, res: Response) {
    const prisma = this.prismaService.prisma;

    const provider = await prisma.insuranceProvider.findUnique({
      where: { id: insuranceId },
    });

    const rejectedClaims = await prisma.insuranceClaim.findMany({
      where: {
        insuranceId,
        status: 'REJECTED',
      },
      include: {
        pharmacy: { select: { name: true } },
        medicine: { select: { tradeName: true, genericName: true } },
      },
      orderBy: { claimedAt: 'desc' },
    });

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${provider?.code || 'insurance'}_rejection_analysis.pdf"`,
    );
    doc.pipe(res);

    doc
      .fontSize(18)
      .fillColor('#991b1b')
      .text(`${provider?.name || 'Insurance'} - Claims Rejection Analysis`, {
        align: 'center',
      });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor('#6b7280')
      .text(
        `Total Rejected Claims: ${rejectedClaims.length} | Generated: ${new Date().toLocaleDateString()}`,
        { align: 'center' },
      );
    doc.moveDown(1.5);

    if (rejectedClaims.length === 0) {
      doc
        .fontSize(12)
        .fillColor('#166534')
        .text('No rejected claims found for this provider.', {
          align: 'center',
        });
    } else {
      rejectedClaims.forEach((c, index) => {
        doc
          .fontSize(10)
          .fillColor('#111827')
          .text(`${index + 1}. Claim #${c.claimNumber} - ${c.pharmacy?.name || 'Pharmacy'}`);
        doc
          .fontSize(9)
          .fillColor('#374151')
          .text(
            `    Medicine: ${c.medicine?.tradeName || c.medicine?.genericName || 'N/A'} | Amount: RWF ${Number(c.totalAmount).toLocaleString()}`,
          )
          .text(
            `    Rejection Reason: ${c.rejectionReason || 'No reason provided'}`,
          )
          .text(
            `    Date: ${new Date(c.claimedAt).toLocaleDateString()}`,
          );
        doc.moveDown(0.8);
      });
    }

    doc.end();
  }

  async generateCoverageAudit(insuranceId: string, res: Response) {
    const prisma = this.prismaService.prisma;

    const provider = await prisma.insuranceProvider.findUnique({
      where: { id: insuranceId },
    });

    const patients = await prisma.insuredPatient.findMany({
      where: { insuranceId },
      orderBy: { createdAt: 'desc' },
    });

    const data = patients.map((p) => ({
      Policy_Number: p.policyNumber,
      National_ID: p.nationalId || 'N/A',
      Full_Name: p.fullName,
      Gender: p.gender || 'N/A',
      Phone: p.phone || 'N/A',
      Coverage_Percentage: Number(p.coveragePercentage || provider?.defaultCoveragePercentage || 85),
      Status: p.status,
      Start_Date: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : '',
      End_Date: p.endDate ? new Date(p.endDate).toISOString().split('T')[0] : 'NO EXPIRE',
    }));

    const worksheet = xlsx.utils.json_to_sheet(
      data.length > 0
        ? data
        : [
            {
              Policy_Number: 'N/A',
              National_ID: 'N/A',
              Full_Name: 'No insured patients',
              Gender: '',
              Phone: '',
              Coverage_Percentage: 0,
              Status: 'NONE',
              Start_Date: '',
              End_Date: '',
            },
          ],
    );
    const csv = xlsx.utils.sheet_to_csv(worksheet);

    const filename = `${provider?.code || 'insurance'}_coverage_audit.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  }
}

