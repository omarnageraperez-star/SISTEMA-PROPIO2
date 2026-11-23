import React, { useState } from 'react';
import QuotationsList from './QuotationsList';
import QuotationEditor from './QuotationEditor';
import QuotationPreviewModal from './QuotationPreviewModal';
import QuotationSettingsModal from './QuotationSettingsModal';
import { apiRequest } from '../../lib/api';

export default function QuotationsModule({
  config,
  token,
  userProfile,
  systemSettings,
  onNavigateToPOS
}) {
  const [viewMode, setViewMode] = useState('LIST'); // 'LIST' | 'CREATE' | 'EDIT'
  const [editingQuotationId, setEditingQuotationId] = useState(null);
  const [previewQuotation, setPreviewQuotation] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const baseUrl = config?.apiUrl?.replace(/\/$/, '') || '';

  const handleNewQuotation = () => {
    setEditingQuotationId(null);
    setViewMode('CREATE');
  };

  const handleEditQuotation = (quotation) => {
    setEditingQuotationId(quotation.id);
    setViewMode('EDIT');
  };

  const handlePreviewQuotation = async (quotation) => {
    try {
      const res = await apiRequest(`${baseUrl}/quotations/quotations/${quotation.id}/`, {}, token);
      if (res.ok) {
        const fullData = await res.json();
        setPreviewQuotation(fullData);
      } else {
        setPreviewQuotation(quotation);
      }
    } catch (e) {
      setPreviewQuotation(quotation);
    }
  };

  const handleCloseEditor = () => {
    setViewMode('LIST');
    setEditingQuotationId(null);
  };

  const handleSaved = () => {
    setViewMode('LIST');
    setEditingQuotationId(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleStatusChange = (updatedQuotation) => {
    setRefreshKey(prev => prev + 1);
    setPreviewQuotation(updatedQuotation);
  };

  const handleConvertToSale = (saleData) => {
    setRefreshKey(prev => prev + 1);
    if (onNavigateToPOS) {
      onNavigateToPOS(saleData);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {viewMode === 'LIST' && (
        <QuotationsList
          key={refreshKey}
          config={config}
          token={token}
          userProfile={userProfile}
          systemSettings={systemSettings}
          onNewQuotation={handleNewQuotation}
          onEditQuotation={handleEditQuotation}
          onPreviewQuotation={handlePreviewQuotation}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
      )}

      {(viewMode === 'CREATE' || viewMode === 'EDIT') && (
        <QuotationEditor
          config={config}
          token={token}
          userProfile={userProfile}
          systemSettings={systemSettings}
          quotationId={editingQuotationId}
          onClose={handleCloseEditor}
          onSaved={handleSaved}
        />
      )}

      {/* Modal Vista Previa / Detalle / PDF */}
      {previewQuotation && (
        <QuotationPreviewModal
          quotation={previewQuotation}
          systemSettings={systemSettings}
          userProfile={userProfile}
          config={config}
          token={token}
          onClose={() => setPreviewQuotation(null)}
          onStatusChange={handleStatusChange}
          onConvertToSale={handleConvertToSale}
        />
      )}

      {/* Modal Ajustes de Cotización */}
      {showSettingsModal && (
        <QuotationSettingsModal
          config={config}
          token={token}
          onClose={() => setShowSettingsModal(false)}
          onSaved={() => setRefreshKey(prev => prev + 1)}
        />
      )}
    </div>
  );
}
