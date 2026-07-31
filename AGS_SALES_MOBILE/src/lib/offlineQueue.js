const OFFLINE_KEY = 'ags_sales_offline_queue';

// Generate a simple unique ID for pending sales
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function saveSaleOffline(saleBody, totalAmount, invoiceNumber = null) {
  try {
    const queue = getOfflineSales();
    const pendingSale = {
      id: generateId(),
      timestamp: Date.now(),
      body: saleBody,
      total: totalAmount,
      mockInvoice: invoiceNumber || `OFFLINE-${Math.floor(Math.random() * 10000)}`
    };
    queue.push(pendingSale);
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
    return pendingSale;
  } catch (e) {
    console.error("Error saving offline sale", e);
    return null;
  }
}

export function getOfflineSales() {
  try {
    const data = localStorage.getItem(OFFLINE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function removeOfflineSale(id) {
  try {
    let queue = getOfflineSales();
    queue = queue.filter(s => s.id !== id);
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("Error removing offline sale", e);
  }
}

export async function syncOfflineSales(auth, apiRequest, apiUrl) {
  const queue = getOfflineSales();
  if (queue.length === 0) return 0;
  
  let synced = 0;
  for (const sale of queue) {
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, 'sales/sales/'), {
        method: 'POST',
        body: JSON.stringify(sale.body),
      }, auth.token);
      
      if (res.ok) {
        removeOfflineSale(sale.id);
        synced++;
      } else {
        const errorText = await res.text();
        console.error("Failed to sync offline sale", sale.id, errorText);
        // If it's a 400 error (e.g. invalid data), we might want to remove it anyway to prevent blockage.
        if (res.status >= 400 && res.status < 500) {
          removeOfflineSale(sale.id);
        }
      }
    } catch (e) {
      console.warn("Network error while syncing, will retry later.", e);
      break; // Stop syncing if network is down
    }
  }
  return synced;
}
