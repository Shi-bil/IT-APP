import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, HeadingLevel } from 'docx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export const exportService = {
  // Export data to Excel
  exportToExcel: (data, fileName = 'assets_export') => {
    try {
      // Convert data to worksheet format
      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // Create workbook and add the worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
      
      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      
      // Create blob and save file
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${fileName}.xlsx`);
      
      return { success: true };
    } catch (error) {
      console.error('Export to Excel error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Export data to DOCX
  exportToDocx: (data, fileName = 'assets_export', title = 'Assets Report') => {
    try {
      // Create document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: title,
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                text: `Generated on ${new Date().toLocaleDateString()}`,
                spacing: { after: 400 },
              }),
              createAssetsTable(data),
            ],
          },
        ],
      });
      
      // Generate document blob (browser compatible)
      Packer.toBlob(doc).then((blob) => {
        saveAs(blob, `${fileName}.docx`);
      });
      
      return { success: true };
    } catch (error) {
      console.error('Export to DOCX error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Export data to PDF
  exportToPdf: (data, fileName = 'assets_export', title = 'Assets Report') => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text(title, 14, 16);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 24);
      if (data && data.length > 0) {
        const headers = Object.keys(data[0]);
        const rows = data.map(item => headers.map(h => item[h] || ''));
        doc.autoTable({
          startY: 30,
          head: [headers.map(formatHeader)],
          body: rows,
        });
      } else {
        doc.text('No data available.', 14, 40);
      }
      doc.save(`${fileName}.pdf`);
      return { success: true };
    } catch (error) {
      console.error('Export to PDF error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Export HTML to DOCX (Word)
  exportHtmlToDocx: (html, fileName = 'assets_export') => {
    try {
      const docx = htmlDocx.asBlob(html, { orientation: 'portrait', margins: { top: 720 } });
      saveAs(docx, `${fileName}.docx`);
      return { success: true };
    } catch (error) {
      console.error('Export HTML to DOCX error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Export DOCX from template using docxtemplater
  exportDocxFromTemplate: async (data, templatePath, fileName = 'handover_export') => {
    try {
      // Fetch the template as binary
      const response = await fetch(templatePath);
      const arrayBuffer = await response.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.setData(data);
      try {
        doc.render();
      } catch (error) {
        console.error('Docxtemplater render error:', error);
        throw error;
      }
      const out = doc.getZip().generate({ type: 'blob' });
      saveAs(out, `${fileName}.docx`);
      return { success: true };
    } catch (error) {
      console.error('Export DOCX from template error:', error);
      return { success: false, error: error.message };
    }
  }
};

// Helper function to create table for DOCX
function createAssetsTable(data) {
  if (!data || data.length === 0) {
    return new Paragraph({ text: "No data available." });
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create table rows
  const rows = [
    // Header row
    new TableRow({
      children: headers.map(header => 
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: formatHeader(header), bold: true })],
          })],
          shading: { fill: "EEEEEE" },
        })
      ),
    }),
    // Data rows
    ...data.map(item => 
      new TableRow({
        children: headers.map(header => 
          new TableCell({
            children: [new Paragraph(String(item[header] || 'N/A'))],
          })
        ),
      })
    ),
  ];
  
  // Create table
  return new Table({
    rows,
  });
}

// Format header text (convert camelCase to Title Case)
function formatHeader(header) {
  return header
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
} 