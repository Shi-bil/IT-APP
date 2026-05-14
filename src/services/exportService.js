import { saveAs } from 'file-saver';

// Lazy-load heavy libraries only when needed
let XLSX = null;
let docxModule = null;
let jsPDF = null;
let PizZip = null;
let Docxtemplater = null;

const loadXLSX = async () => {
  if (!XLSX) {
    XLSX = await import('xlsx');
  }
  return XLSX;
};

const loadDocx = async () => {
  if (!docxModule) {
    docxModule = await import('docx');
  }
  return docxModule;
};

const loadJsPDF = async () => {
  if (!jsPDF) {
    const [jsPDFModule] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    jsPDF = jsPDFModule.default;
  }
  return jsPDF;
};

const loadDocxTemplater = async () => {
  if (!PizZip || !Docxtemplater) {
    const [pizzipModule, docxtemplaterModule] = await Promise.all([
      import('pizzip'),
      import('docxtemplater')
    ]);
    PizZip = pizzipModule.default;
    Docxtemplater = docxtemplaterModule.default;
  }
  return { PizZip, Docxtemplater };
};

export const exportService = {
  // Export data to Excel
  exportToExcel: async (data, fileName = 'assets_export') => {
    try {
      const xlsx = await loadXLSX();
      
      // Convert data to worksheet format
      const worksheet = xlsx.utils.json_to_sheet(data);
      
      // Create workbook and add the worksheet
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Assets');
      
      // Generate Excel file
      const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
      
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
  exportToDocx: async (data, fileName = 'assets_export', title = 'Assets Report') => {
    try {
      const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, HeadingLevel } = await loadDocx();
      
      // Helper function to create table for DOCX
      function createAssetsTable(data) {
        if (!data || data.length === 0) {
          return new Paragraph({ text: "No data available." });
        }

        const headers = Object.keys(data[0]);
        
        const rows = [
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
        
        return new Table({ rows });
      }
      
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
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${fileName}.docx`);
      
      return { success: true };
    } catch (error) {
      console.error('Export to DOCX error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Export data to PDF
  exportToPdf: async (data, fileName = 'assets_export', title = 'Assets Report') => {
    try {
      const JsPDF = await loadJsPDF();
      const doc = new JsPDF();
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
  
  // Export DOCX from template using docxtemplater
  exportDocxFromTemplate: async (data, templatePath, fileName = 'handover_export') => {
    try {
      const { PizZip: PZ, Docxtemplater: DT } = await loadDocxTemplater();
      
      // Fetch the template as binary
      const response = await fetch(templatePath);
      const arrayBuffer = await response.arrayBuffer();
      const zip = new PZ(arrayBuffer);
      const doc = new DT(zip, { paragraphLoop: true, linebreaks: true });
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

// Format header text (convert camelCase to Title Case)
function formatHeader(header) {
  return header
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}
