/**
 * Network Printer Service for RIWA POS
 * Supports ESC/POS printers via TCP (Sunmi NT310, Foodics Cloud Printer)
 * Provides fallback to server-side printing when client-side fails
 */

// Get API URL from environment
const getApiUrl = () => {
  return process.env.REACT_APP_BACKEND_URL || 'https://fastpos-riwa.preview.emergentagent.com/api';
};

/**
 * Get configured printers from the API
 */
export const getPrinters = async () => {
  try {
    const response = await fetch(`${getApiUrl()}/printers`);
    if (!response.ok) throw new Error('Failed to fetch printers');
    const data = await response.json();
    return data.printers || [];
  } catch (error) {
    console.error('Get printers error:', error);
    return [];
  }
};

/**
 * Get default printer for a channel
 * @param {string} channel - 'pos' or 'kds'
 */
export const getDefaultPrinter = async (channel = 'pos') => {
  const printers = await getPrinters();
  return printers.find(p => 
    p.enabled && 
    (p.default_for_channel === channel || p.default_for_channel === 'both')
  );
};

/**
 * Test printer connection
 * @param {string} ipAddress - Printer IP address
 * @param {number} port - Printer port (default 9100)
 */
export const testPrinter = async (ipAddress, port = 9100) => {
  try {
    const response = await fetch(`${getApiUrl()}/printers/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip_address: ipAddress, port })
    });
    return await response.json();
  } catch (error) {
    console.error('Test printer error:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Print receipt via server-side TCP printing
 * @param {string} printerId - Printer ID from config
 * @param {Object} orderData - Order data to print
 * @param {boolean} openDrawer - Whether to open cash drawer
 */
export const printViaServer = async (printerId, orderData, openDrawer = false) => {
  try {
    const response = await fetch(`${getApiUrl()}/prints/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer_id: printerId,
        order_id: orderData.id || orderData.order_id || 'unknown',
        print_type: 'receipt',
        open_drawer: openDrawer,
        receipt_data: orderData
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Server print error:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Queue print job for background processing
 * @param {string} printerId - Printer ID from config
 * @param {Object} orderData - Order data to print
 * @param {boolean} openDrawer - Whether to open cash drawer
 */
export const queuePrintJob = async (printerId, orderData, openDrawer = false) => {
  try {
    const response = await fetch(`${getApiUrl()}/prints/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer_id: printerId,
        order_id: orderData.id || orderData.order_id || 'unknown',
        print_type: 'receipt',
        open_drawer: openDrawer,
        receipt_data: orderData
      })
    });
    return await response.json();
  } catch (error) {
    console.error('Queue print job error:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Auto-print receipt - tries server-side printing first, then queues as fallback
 * @param {Object} orderData - Order data to print
 * @param {boolean} isCashPayment - Whether this is a cash payment (to open drawer)
 */
export const autoPrintReceipt = async (orderData, isCashPayment = false) => {
  try {
    // Get default POS printer
    const printer = await getDefaultPrinter('pos');
    
    if (!printer) {
      console.log('No printer configured - skipping network print');
      return { success: false, message: 'No printer configured' };
    }

    // Determine if we should open drawer
    const openDrawer = isCashPayment && printer.open_drawer_after;

    // Try direct server-side print first
    console.log(`Printing to ${printer.name} (${printer.ip_address}:${printer.port})`);
    const result = await printViaServer(printer.id, orderData, openDrawer);
    
    if (result.success) {
      console.log('Receipt printed successfully');
      return result;
    }

    // If direct print failed, queue the job for retry
    console.log('Direct print failed, queueing job...');
    return await queuePrintJob(printer.id, orderData, openDrawer);
    
  } catch (error) {
    console.error('Auto print error:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Print KDS ticket for kitchen display
 * @param {Object} itemData - KDS item data
 */
export const printKDSTicket = async (itemData) => {
  try {
    const printer = await getDefaultPrinter('kds');
    
    if (!printer) {
      console.log('No KDS printer configured');
      return { success: false, message: 'No KDS printer configured' };
    }

    return await printViaServer(printer.id, {
      ...itemData,
      print_type: 'kds_ticket'
    }, false);
    
  } catch (error) {
    console.error('KDS print error:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Open cash drawer without printing
 * @param {string} printerId - Printer ID (optional, uses default)
 */
export const openCashDrawer = async (printerId = null) => {
  try {
    let printer;
    
    if (printerId) {
      const printers = await getPrinters();
      printer = printers.find(p => p.id === printerId);
    } else {
      printer = await getDefaultPrinter('pos');
    }
    
    if (!printer) {
      return { success: false, message: 'No printer configured' };
    }

    // Send drawer kick command via print job
    return await printViaServer(printer.id, {
      drawer_only: true,
      order_number: 'DRAWER-OPEN'
    }, true);
    
  } catch (error) {
    console.error('Open drawer error:', error);
    return { success: false, message: error.message };
  }
};

export default {
  getPrinters,
  getDefaultPrinter,
  testPrinter,
  printViaServer,
  queuePrintJob,
  autoPrintReceipt,
  printKDSTicket,
  openCashDrawer
};
