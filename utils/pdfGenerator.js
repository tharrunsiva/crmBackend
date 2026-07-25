import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export const generatePayslipPDF = (payrollData, employeeData, outputPath) => {
   return new Promise((resolve, reject) => {
      try {
         // Ensure the output directory exists
         const dir = path.dirname(outputPath);
         if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
         }

         // Initialize document with clean margins
         const doc = new PDFDocument({ margin: 40, size: 'A4' });
         const writeStream = fs.createWriteStream(outputPath);

         doc.pipe(writeStream);

         // --- New UI Theme Colors (Deep Teal & Slate) ---
         const colors = {
            primary: '#0F766E',     // Deep Teal
            darkText: '#1F2937',    // Slate 800 (Nearly black for readability)
            lightText: '#6B7280',   // Slate 500 (For labels and footer)
            surface: '#F9FAFB',     // Very light gray for subtle backgrounds
            border: '#E5E7EB',      // Soft border line
            accent: '#F0FDFA'       // Extremely faint teal for row striping
         };

         // Helper function for Indian currency formatting
         const formatCurrency = (amount) => {
            return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
         };

         // ==========================================
         // 1. MINIMALIST HEADER SECTION
         // ==========================================

         // Modern side-accent line instead of a heavy top bar
         doc.rect(40, 30, 4, 60).fill(colors.primary);

         const logoPath = path.join(path.resolve(), 'uploads', 'logo.png');
         const hasCustomLogo = fs.existsSync(logoPath);

         if (hasCustomLogo) {
            // Render custom company logo
            doc.image(logoPath, 55, 30, { height: 40 });

            // Address under logo
            doc.fillColor(colors.lightText)
               .fontSize(9)
               .font('Helvetica')
               .text('148, Gopalasamy Koil St, Ganapathy', 55, 75)
               .text('Coimbatore, Tamil Nadu - 641006', 55, 88);
         } else {
            // Fallback placeholder if logo is missing
            doc.fillColor(colors.darkText)
               .fontSize(20)
               .font('Helvetica-Bold')
               .text('COMPANY LOGO', 55, 35);

            doc.fillColor(colors.lightText)
               .fontSize(9)
               .font('Helvetica')
               .text('148, Gopalasamy Koil St, Ganapathy', 55, 60)
               .text('Coimbatore, Tamil Nadu - 641006', 55, 73);
         }

         // Payslip Title and Date on Right Side
         doc.fillColor(colors.primary)
            .fontSize(22)
            .font('Helvetica-Bold')
            .text('PAYSLIP', 350, 35, { align: 'right' });

         doc.fillColor(colors.darkText)
            .fontSize(11)
            .font('Helvetica')
            .text(`${getMonthName(payrollData.month)} ${payrollData.year}`, 350, 62, { align: 'right' });

         // Subtle divider
         doc.moveTo(40, 120).lineTo(555, 120).stroke(colors.border);

         // ==========================================
         // 2. EMPLOYEE DETAILS SECTION (Clean Card)
         // ==========================================
         doc.y = 140;

         // Soft background for employee details
         doc.roundedRect(40, 140, 515, 80, 6).fill(colors.surface).stroke(colors.border);

         doc.fillColor(colors.primary)
            .fontSize(9)
            .font('Helvetica-Bold')
            .text('EMPLOYEE SUMMARY', 55, 152);

         // Details Grid
         doc.fillColor(colors.lightText).fontSize(10)
            .font('Helvetica').text('Employee ID:', 55, 175)
            .fillColor(colors.darkText).font('Helvetica-Bold').text(employeeData.employeeId || 'N/A', 130, 175)

            .fillColor(colors.lightText).font('Helvetica').text('Full Name:', 55, 195)
            .fillColor(colors.darkText).font('Helvetica-Bold').text(employeeData.name || 'N/A', 130, 195);

         doc.fillColor(colors.lightText).font('Helvetica').text('Department:', 255, 175)
            .fillColor(colors.darkText).font('Helvetica-Bold').text(employeeData.department || 'N/A', 330, 175)

            .fillColor(colors.lightText).font('Helvetica').text('Designation:', 255, 195)
            .fillColor(colors.darkText).font('Helvetica-Bold').text(employeeData.designation || 'N/A', 330, 195);

         doc.fillColor(colors.lightText).font('Helvetica').text('Pay Date:', 420, 175)
            .fillColor(colors.darkText).font('Helvetica-Bold').text(payrollData.paymentDate ? new Date(payrollData.paymentDate).toLocaleDateString('en-IN') : 'N/A', 475, 175)

            .fillColor(colors.lightText).font('Helvetica').text('Status:', 420, 195)
            .fillColor(colors.primary).font('Helvetica-Bold').text((payrollData.status || 'Processed').toUpperCase(), 475, 195);

         // ==========================================
         // 3. EARNINGS & DEDUCTIONS TABLES
         // ==========================================
         const tableTop = 250;

         // Outer border for both tables
         doc.roundedRect(40, tableTop, 250, 170, 6).stroke(colors.border);
         doc.roundedRect(305, tableTop, 250, 170, 6).stroke(colors.border);

         // Minimalist Header underlines instead of filled boxes
         doc.moveTo(40, tableTop + 30).lineTo(290, tableTop + 30).stroke(colors.border);
         doc.moveTo(305, tableTop + 30).lineTo(555, tableTop + 30).stroke(colors.border);

         doc.fillColor(colors.primary).fontSize(10).font('Helvetica-Bold')
            .text('EARNINGS', 55, tableTop + 12)
            .text('AMOUNT', 190, tableTop + 12, { width: 85, align: 'right' })
            .text('DEDUCTIONS', 320, tableTop + 12)
            .text('AMOUNT', 455, tableTop + 12, { width: 85, align: 'right' });

         // Row Drawer
         const drawRow = (y, isStripe, label1, val1, label2, val2) => {
            if (isStripe) {
               doc.rect(41, y - 6, 248, 24).fill(colors.accent);
               doc.rect(306, y - 6, 248, 24).fill(colors.accent);
            }
            doc.fillColor(colors.lightText).fontSize(10).font('Helvetica')
               .text(label1, 55, y)
               .fillColor(colors.darkText)
               .text(val1, 175, y, { width: 100, align: 'right' })

               .fillColor(colors.lightText)
               .text(label2, 320, y)
               .fillColor(colors.darkText)
               .text(val2, 440, y, { width: 100, align: 'right' });
         };

         // Table Data
         let rowY = tableTop + 42;
         drawRow(rowY, false, 'Basic Salary', formatCurrency(payrollData.basicSalary), 'Standard Deductions', formatCurrency(payrollData.deductions));
         rowY += 28;
         drawRow(rowY, true, 'Allowances', formatCurrency(payrollData.allowances), 'Provident Fund (PF)', formatCurrency(0));
         rowY += 28;
         drawRow(rowY, false, 'Bonus Payments', formatCurrency(payrollData.bonus), 'Tax Withholding', formatCurrency(0));

         // Divider before totals
         doc.moveTo(40, tableTop + 130).lineTo(290, tableTop + 130).stroke(colors.border);
         doc.moveTo(305, tableTop + 130).lineTo(555, tableTop + 130).stroke(colors.border);

         const grossEarnings = payrollData.basicSalary + payrollData.allowances + payrollData.bonus;
         const totalDeductions = payrollData.deductions;

         // Totals
         doc.fillColor(colors.darkText).font('Helvetica-Bold')
            .text('Gross Earnings', 55, tableTop + 145)
            .fillColor(colors.primary)
            .text(formatCurrency(grossEarnings), 175, tableTop + 145, { width: 100, align: 'right' })

            .fillColor(colors.darkText)
            .text('Total Deductions', 320, tableTop + 145)
            .fillColor(colors.primary)
            .text(formatCurrency(totalDeductions), 440, tableTop + 145, { width: 100, align: 'right' });

         // ==========================================
         // 4. NET PAYOUT HIGHLIGHT BOX
         // ==========================================
         const netPayY = 445;

         // Solid Teal Box
         doc.roundedRect(40, netPayY, 515, 65, 8).fill(colors.primary);

         doc.fillColor('#FFFFFF')
            .fontSize(11)
            .font('Helvetica')
            .text('NET SALARY PAYOUT', 65, netPayY + 28);

         doc.fontSize(22)
            .font('Helvetica-Bold')
            .text(formatCurrency(payrollData.netSalary), 300, netPayY + 22, { align: 'right', width: 230 });

         // ==========================================
         // 5. FOOTER SECTION
         // ==========================================

         doc.moveTo(40, 750).lineTo(555, 750).stroke(colors.border);

         doc.fillColor(colors.lightText)
            .fontSize(8)
            .font('Helvetica')
            .text('Note: This is a system-generated document and does not require a physical signature.', 40, 765, { align: 'center' });

         doc.end();

         writeStream.on('finish', () => resolve(outputPath));
         writeStream.on('error', (err) => reject(err));

      } catch (error) {
         reject(error);
      }
   });
};

const getMonthName = (monthNumber) => {
   const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
   ];
   return months[monthNumber - 1] || '';
};