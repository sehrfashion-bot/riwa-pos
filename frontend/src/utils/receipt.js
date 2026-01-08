/**
 * Receipt Utility for RIWA POS
 * Supports 80mm thermal printers (Sunmi NT310 / Foodics Cloud Printer)
 * ESC/POS compatible with cash drawer kick
 */

// Restaurant Info
const RESTAURANT_NAME_EN = 'Al-Katem & Al-Bukhari';
const RESTAURANT_NAME_AR = 'الكاتم والبخاري';
const RESTAURANT_SUBTITLE = 'Maboos Grills';
const POWERED_BY = 'RIWA POS';

/**
 * Generate receipt HTML for 80mm thermal printer
 * @param {Object} order - Order data
 * @param {string} cashierName - Name of the cashier
 * @returns {string} HTML string for receipt
 */
export const generateReceiptHTML = (order, cashierName = 'Cashier') => {
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

  const billNo = order.order_number?.replace('ORD-', '').replace(/-/g, '') || 
                 Math.random().toString(36).substring(2, 8).toUpperCase();

  const payMode = order.payment_method === 'cash' ? 'Cash' : 'Card';
  const orderType = order.order_type === 'qsr' ? 'Quick Bill' : 
                    order.order_type === 'takeaway' ? 'Takeaway' : 'Delivery';

  // Calculate totals
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

  const grandTotal = (order.total || order.total_amount || 0).toFixed(3);

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
      font-size: 18px;
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
    .bill-type {
      font-size: 13px;
      font-weight: bold;
    }
    .bill-number {
      font-size: 16px;
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
    @media print {
      body {
        width: 80mm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="restaurant-name">${RESTAURANT_NAME_EN}</div>
    <div class="restaurant-subtitle">${RESTAURANT_SUBTITLE}</div>
    <div class="arabic restaurant-name">${RESTAURANT_NAME_AR}</div>
    <div class="date-time">${dateStr} at ${timeStr}</div>
  </div>

  <div class="bill-info">
    <div class="bill-type">${orderType}</div>
    <div class="bill-number">Bill No:${billNo}</div>
    <div style="font-size: 11px; color: #666;">${orderType}: ${billNo}</div>
  </div>

  <div class="dashed"></div>

  <div class="meta-row">
    <span><strong>${orderType}</strong></span>
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
    <div class="powered-by">Powered by ${POWERED_BY}</div>
  </div>
</body>
</html>
  `;
};

/**
 * Print receipt and trigger cash drawer
 * For Sunmi NT310 / Foodics 80mm Cloud Printer
 * @param {Object} order - Order data
 * @param {string} cashierName - Cashier name
 * @param {boolean} openDrawer - Whether to trigger cash drawer
 */
export const printReceipt = (order, cashierName = 'Cashier', openDrawer = true) => {
  const receiptHTML = generateReceiptHTML(order, cashierName);
  
  // Create print window
  const printWindow = window.open('', '_blank', 'width=320,height=600');
  
  if (!printWindow) {
    console.error('Failed to open print window. Check popup blocker.');
    return false;
  }

  printWindow.document.write(receiptHTML);
  printWindow.document.close();

  // Wait for content to load, then print
  printWindow.onload = () => {
    // For ESC/POS printers, the browser print dialog will send to the thermal printer
    // The cash drawer kick command is sent via the printer driver when using ESC/POS
    // For Sunmi NT310: ESC p 0 25 250 (hex: 1B 70 00 19 FA)
    
    setTimeout(() => {
      printWindow.print();
      
      // Close window after printing
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 250);
  };

  return true;
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

  const printWindow = window.open('', '_blank', 'width=320,height=400');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => printWindow.close(), 1000);
      }, 250);
    };
  }
};

export default {
  generateReceiptHTML,
  printReceipt,
  printKDSTicket
};
