import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Geração de PDF com pdf-lib (puro JS, sem browser): suficiente para o certificado
// e roda em qualquer ambiente (a spec sugere Puppeteer, que exige Chromium —
// overkill aqui; o layout segue o mesmo conteúdo: nome, curso, data e URL pública
// de verificação, que é o que dá credibilidade ao documento).
export async function generateCertificatePdf(opts: {
  studentName: string;
  courseTitle: string;
  issuedAt: Date;
  verificationHash: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const purple = rgb(0.43, 0.31, 0.78); // #6D4FC7
  const dark = rgb(0.09, 0.09, 0.11);
  const gray = rgb(0.42, 0.41, 0.38);

  const center = (text: string, f = font, size = 12) => f.widthOfTextAtSize(text, size);

  // Moldura
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: purple, borderWidth: 2 });

  let y = height - 120;
  const title = "CERTIFICADO DE CONCLUSÃO";
  page.drawText(title, { x: (width - center(title, bold, 20)) / 2, y, font: bold, size: 20, color: gray });

  y -= 60;
  const pre = "Certificamos que";
  page.drawText(pre, { x: (width - center(pre, font, 16)) / 2, y, font, size: 16, color: gray });

  y -= 56;
  page.drawText(opts.studentName, { x: (width - center(opts.studentName, bold, 34)) / 2, y, font: bold, size: 34, color: dark });

  y -= 44;
  const mid = "concluiu com êxito o curso";
  page.drawText(mid, { x: (width - center(mid, font, 16)) / 2, y, font, size: 16, color: gray });

  y -= 52;
  page.drawText(opts.courseTitle, { x: (width - center(opts.courseTitle, bold, 26)) / 2, y, font: bold, size: 26, color: purple });

  y = 90;
  const issued = `Emitido em ${opts.issuedAt.toLocaleDateString("pt-BR")}`;
  page.drawText(issued, { x: (width - center(issued, font, 11)) / 2, y, font, size: 11, color: gray });

  y -= 22;
  const verify = `Verifique a autenticidade em: ${process.env.APP_URL}/certificados/verificar/${opts.verificationHash}`;
  page.drawText(verify, { x: (width - center(verify, font, 10)) / 2, y, font, size: 10, color: gray });

  return doc.save();
}
