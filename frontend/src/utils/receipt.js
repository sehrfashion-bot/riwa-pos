/**
 * Receipt Utility for RIWA POS
 * Supports 80mm thermal printers (Sunmi NT310 / Foodics Cloud Printer)
 * Works with USB, Ethernet, and Cloud printing via browser print dialog
 * ESC/POS compatible with cash drawer kick
 */

// Restaurant Info
const RESTAURANT_NAME_EN = 'Al-Katem & Al-Bukhari';
const RESTAURANT_NAME_AR = 'الكاتم والبخاري';
const RESTAURANT_SUBTITLE = 'Maboos Grills';
const POWERED_BY = 'RIWA POS';
const CONTACT_NUMBER = '98964488 - 24740958';

/**
 * Generate sequential bill number in format XXX-YYYY
 * Stored in localStorage to persist across sessions
 */
export const generateBillNumber = () => {
  const storageKey = 'riwa_pos_bill_counter';
  let counter = JSON.parse(localStorage.getItem(storageKey) || '{"prefix": 1, "number": 0}');
  
  counter.number++;
  
  // Reset to next prefix when reaching 999
  if (counter.number > 999) {
    counter.prefix++;
    counter.number = 1;
  }
  
  localStorage.setItem(storageKey, JSON.stringify(counter));
  
  const prefix = counter.prefix.toString().padStart(3, '0');
  const number = counter.number.toString().padStart(3, '0');
  
  return `${prefix}-${number}`;
};

/**
 * Get order source display name
 */
const getOrderSourceName = (source) => {
  const sources = {
    'walkin': 'Walk In',
    'website': 'Website',
    'talabat': 'Talabat',
    'cari': 'Cari',
    'jahez': 'Jahez',
    'katch': 'Katch',
    'other': 'Other'
  };
  return sources[source] || source || 'Walk In';
};

/**
 * Generate receipt HTML for 80mm thermal printer
 * @param {Object} order - Order data
 * @param {string} cashierName - Name of the cashier
 * @param {string} billNumber - The bill number (XXX-YYY format)
 * @returns {string} HTML string for receipt
 */
export const generateReceiptHTML = (order, cashierName = 'Cashier', billNumber = null) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  }).toLowerCase();

  // Use provided bill number or generate new one
  const billNo = billNumber || order.bill_number || generateBillNumber();
  const payMode = order.payment_method === 'cash' ? 'Cash' : 'Card';
  const orderSource = getOrderSourceName(order.order_source);

  // Calculate totals (no tax)
  let totalQty = 0;
  let itemsHTML = '';
  
  (order.items || []).forEach(item => {
    const qty = item.quantity || 1;
    const rate = (item.unit_price || 0).toFixed(3);
    const total = (item.total_price || item.unit_price * qty || 0).toFixed(3);
    totalQty += qty;
    
    itemsHTML += `
      <tr>
        <td class="item-name">
          ${item.name || item.item_name || 'Item'}
          ${item.name_ar ? `<br><span class="arabic">${item.name_ar}</span>` : ''}
        </td>
        <td class="qty">${qty}</td>
        <td class="rate">${rate}</td>
        <td class="total">${total}</td>
      </tr>
    `;
  });

  // Grand total (no tax)
  const grandTotal = (order.total || order.total_amount || order.subtotal || 0).toFixed(3);

  return `
<!DOCTYPE html>
<html dir="ltr">
<head>
  <meta charset="UTF-8">
  <title>Receipt #${billNo}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      body {
        width: 80mm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print {
        display: none !important;
      }
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 80mm;
      max-width: 80mm;
      padding: 5mm;
      background: white;
      color: black;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid black;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .restaurant-name {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 2px;
    }
    .restaurant-subtitle {
      font-size: 11px;
      color: #333;
    }
    .arabic {
      font-family: 'Arial', sans-serif;
      direction: rtl;
    }
    .date-time {
      font-size: 11px;
      margin-top: 4px;
    }
    .bill-info {
      text-align: center;
      margin: 10px 0;
    }
    .bill-number {
      font-size: 18px;
      font-weight: bold;
      margin: 4px 0;
    }
    .dashed {
      border-top: 1px dashed black;
      margin: 8px 0;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      margin: 4px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
    }
    th {
      text-align: left;
      font-size: 10px;
      border-bottom: 1px dashed black;
      padding: 4px 2px;
    }
    th.qty, th.rate, th.total {
      text-align: right;
    }
    td {
      padding: 4px 2px;
      vertical-align: top;
      font-size: 11px;
    }
    td.item-name {
      max-width: 100px;
    }
    td.qty, td.rate, td.total {
      text-align: right;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      margin: 4px 0;
      font-size: 12px;
    }
    .grand-total {
      background: #f0f0f0;
      padding: 10px;
      margin: 10px 0;
      text-align: center;
    }
    .grand-total-label {
      font-size: 14px;
      font-weight: bold;
    }
    .grand-total-arabic {
      font-family: 'Arial', sans-serif;
      direction: rtl;
      font-size: 12px;
      color: #333;
    }
    .grand-total-amount {
      font-size: 22px;
      font-weight: bold;
      margin-top: 5px;
    }
    .footer {
      text-align: center;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed black;
    }
    .thank-you {
      font-size: 11px;
      font-weight: bold;
    }
    .thank-you-ar {
      font-family: 'Arial', sans-serif;
      direction: rtl;
      font-size: 11px;
      margin-top: 4px;
    }
    .powered-by {
      font-size: 10px;
      color: #666;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="arabic restaurant-name">${RESTAURANT_NAME_AR}</div>
    <div class="date-time">${dateStr} at ${timeStr}</div>
  </div>

  <div class="bill-info">
    <div class="bill-number">Bill No: ${billNo}</div>
  </div>

  <div class="dashed"></div>

  <div class="meta-row">
    <span>Source: ${orderSource}</span>
    <span>User: ${cashierName}</span>
  </div>
  <div class="meta-row">
    <span>Pay Mode: ${payMode}</span>
    <span></span>
  </div>

  <div class="dashed"></div>

  <table>
    <thead>
      <tr>
        <th>Item / <span class="arabic">غرض</span></th>
        <th class="qty">Qty / <span class="arabic">الكمية</span></th>
        <th class="rate">Rate / <span class="arabic">السعر</span></th>
        <th class="total">Total / <span class="arabic">الإجمالي</span></th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <div class="dashed"></div>

  <div class="totals-row">
    <span>Total:</span>
    <span>${totalQty}</span>
    <span></span>
    <span>د.ك ${grandTotal}</span>
  </div>

  <div class="grand-total">
    <div class="grand-total-label">Grand Total</div>
    <div class="grand-total-arabic">المجموع الإجمالي</div>
    <div class="grand-total-amount">د.ك ${grandTotal}</div>
  </div>

  <div class="footer">
    <div class="thank-you">Thank you for choosing</div>
    <div class="thank-you">${RESTAURANT_NAME_EN}!</div>
    <div class="thank-you-ar">شكراً لاختياركم ${RESTAURANT_NAME_AR}</div>
    <div class="powered-by">Contact: ${CONTACT_NUMBER}</div>
    <div class="powered-by">Powered by ${POWERED_BY}</div>
  </div>
</body>
</html>
  `;
};

/**
 * Print receipt with auto-print and cash drawer support
 * Works with Sunmi NT310 and other ESC/POS compatible printers
 * Supports USB, Ethernet, and Cloud printing via browser print dialog
 * 
 * @param {Object} order - Order data
 * @param {string} cashierName - Cashier name
 * @param {boolean} openDrawer - Whether to trigger cash drawer (handled by printer when printing)
 * @returns {string} The generated bill number
 */
export const printReceipt = (order, cashierName = 'Cashier', openDrawer = true) => {
  const billNumber = generateBillNumber();
  const receiptHTML = generateReceiptHTML(order, cashierName, billNumber);
  
  // Create print window
  const printWindow = window.open('', '_blank', 'width=320,height=600,menubar=no,toolbar=no,location=no,status=no');
  
  if (!printWindow) {
    console.error('Failed to open print window. Check popup blocker.');
    // Try using an iframe as fallback
    printViaIframe(receiptHTML);
    return billNumber;
  }

  printWindow.document.write(receiptHTML);
  printWindow.document.close();

  // Auto-print when content loads
  printWindow.onload = () => {
    // Small delay to ensure rendering is complete
    setTimeout(() => {
      try {
        // The browser print dialog will send to the default printer
        // For Sunmi NT310: ESC/POS drawer kick is sent via printer driver settings
        // Configure the Sunmi printer driver to kick drawer on print job
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.error('Print error:', e);
      }
      
      // Close window after print dialog
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 100);
  };

  return billNumber;
};

/**
 * Fallback print method using iframe
 */
const printViaIframe = (html) => {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:80mm;height:auto;';
  document.body.appendChild(iframe);
  
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 100);
  };
};

/**
 * Print KDS ticket (simpler format for kitchen)
 * @param {Object} item - KDS item data
 */
export const printKDSTicket = (item) => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>KDS Ticket</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    @media print {
      body { width: 80mm; }
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      width: 80mm;
      padding: 5mm;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid black;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }
    .order-num {
      font-size: 20px;
      font-weight: bold;
    }
    .item {
      margin: 15px 0;
    }
    .qty {
      font-size: 28px;
      font-weight: bold;
    }
    .item-name {
      font-size: 16px;
      font-weight: bold;
      margin-top: 5px;
    }
    .notes {
      font-size: 12px;
      color: #333;
      margin-top: 5px;
      font-style: italic;
    }
    .time {
      text-align: center;
      font-size: 11px;
      color: #666;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size: 12px;">KDS TICKET</div>
    <div class="order-num">#${item.order_number || item.order?.order_number || 'N/A'}</div>
    <div style="font-size: 11px;">${item.order?.order_type || 'qsr'}</div>
  </div>
  <div class="item">
    <div class="qty">x${item.quantity || 1}</div>
    <div class="item-name">${item.item_name || item.item_name_en || 'Item'}</div>
    ${item.item_name_ar ? `<div class="item-name" style="direction:rtl;">${item.item_name_ar}</div>` : ''}
    ${item.notes ? `<div class="notes">Note: ${item.notes}</div>` : ''}
  </div>
  <div class="time">${timeStr}</div>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank', 'width=320,height=400,menubar=no,toolbar=no');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        setTimeout(() => printWindow.close(), 1000);
      }, 100);
    };
  }
};

/**
 * Order source options for selection
 */
export const ORDER_SOURCES = [
  { value: 'walkin', label: 'Walk In', labelAr: 'زيارة مباشرة' },
  { value: 'website', label: 'Website', labelAr: 'الموقع' },
  { value: 'talabat', label: 'Talabat', labelAr: 'طلبات' },
  { value: 'cari', label: 'Cari', labelAr: 'كاري' },
  { value: 'jahez', label: 'Jahez', labelAr: 'جاهز' },
  { value: 'katch', label: 'Katch', labelAr: 'كاتش' },
  { value: 'other', label: 'Other', labelAr: 'أخرى' },
];

export default {
  generateReceiptHTML,
  generateBillNumber,
  printReceipt,
  printKDSTicket,
  ORDER_SOURCES
};
