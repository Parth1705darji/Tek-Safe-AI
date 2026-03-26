import type { Message } from '../types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeFilename(name: string): string {
  return (name ?? 'chat').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'chat-export';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildHtmlDocument(messages: Message[], title: string): string {
  const rows = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const role = m.role === 'user' ? 'You' : 'Tek-Safe AI';
      const content = escapeHtml(m.content).replace(/\n/g, '<br>');
      const time = new Date(m.created_at).toLocaleString();
      return `<div class="message ${m.role}">
  <div class="meta"><strong>${escapeHtml(role)}</strong> &mdash; <span>${time}</span></div>
  <div class="content">${content}</div>
</div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 820px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 1.5em; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 28px; }
  .message { margin-bottom: 20px; padding: 14px 18px; border-radius: 8px; }
  .user { background: #eff6ff; border-left: 4px solid #3b82f6; }
  .assistant { background: #f9fafb; border-left: 4px solid #10b981; }
  .meta { font-size: 0.78em; color: #6b7280; margin-bottom: 6px; }
  .meta strong { color: #374151; }
  .content { white-space: pre-wrap; word-wrap: break-word; }
  .footer { margin-top: 40px; font-size: 0.75em; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; text-align: center; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${rows}
<div class="footer">Exported from Tek-Safe AI &bull; ${new Date().toLocaleString()}</div>
</body>
</html>`;
}

export function exportAsHtml(messages: Message[], title: string): void {
  const html = buildHtmlDocument(messages, title);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${sanitizeFilename(title)}.html`);
}

export function exportAsPdf(messages: Message[], title: string): void {
  const html = buildHtmlDocument(messages, title);
  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site to export as PDF.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  // Brief delay so styles render before the print dialog opens
  setTimeout(() => win.print(), 600);
}

export function exportAsWord(messages: Message[], title: string): void {
  // Word can open HTML wrapped with its MIME type — no extra library needed
  const html = buildHtmlDocument(messages, title);
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  downloadBlob(blob, `${sanitizeFilename(title)}.doc`);
}

export function exportAsExcel(messages: Message[], title: string): void {
  const rows = messages.filter((m) => m.role !== 'system');

  const xmlRows = rows
    .map((m, i) => {
      const role = m.role === 'user' ? 'You' : 'Tek-Safe AI';
      const content = escapeHtml(m.content);
      const time = new Date(m.created_at).toLocaleString();
      return `      <Row ss:Index="${i + 2}">
        <Cell><Data ss:Type="Number">${i + 1}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeHtml(role)}</Data></Cell>
        <Cell><Data ss:Type="String">${content}</Data></Cell>
        <Cell><Data ss:Type="String">${time}</Data></Cell>
      </Row>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Chat Export">
    <Table>
      <Column ss:Width="40"/>
      <Column ss:Width="80"/>
      <Column ss:Width="500"/>
      <Column ss:Width="160"/>
      <Row ss:Index="1">
        <Cell ss:StyleID="header"><Data ss:Type="String">#</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Role</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Message</Data></Cell>
        <Cell ss:StyleID="header"><Data ss:Type="String">Timestamp</Data></Cell>
      </Row>
${xmlRows}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  downloadBlob(blob, `${sanitizeFilename(title)}.xls`);
}
