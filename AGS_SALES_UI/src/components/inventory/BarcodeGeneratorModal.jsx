import React, { useState, useRef } from 'react';
import { X, Printer, Image as ImageIcon, CheckSquare } from 'lucide-react';
import Barcode from 'react-barcode';
import { QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const BarcodeGeneratorModal = ({ onClose, products = [], onGenerateBackend }) => {
  const [barcodeType, setBarcodeType] = useState('CODE128');
  const [format, setFormat] = useState('PDF');
  const [dpi, setDpi] = useState(300);
  const [pageWidth, setPageWidth] = useState(25.40);
  const [pageHeight, setPageHeight] = useState(25.40);
  const [margin, setMargin] = useState(2.00);
  const [imageWidth, setImageWidth] = useState(20.00);
  const [imageHeight, setImageHeight] = useState(20.00);
  const [fontSize, setFontSize] = useState(20);
  const [includeCode, setIncludeCode] = useState(true);
  
  const previewRef = useRef(null);

  const handleGeneratePDF = async () => {
    if (!previewRef.current) return;
    try {
      const canvas = await html2canvas(previewRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pageWidth, pageHeight]
      });
      pdf.addImage(imgData, 'PNG', margin, margin, imageWidth, imageHeight);
      pdf.save('etiquetas.pdf');
    } catch (error) {
      console.error("Error generating PDF", error);
      alert("Error al generar PDF");
    }
  };

  const handleGenerateImage = async () => {
    if (!previewRef.current) return;
    try {
      const canvas = await html2canvas(previewRef.current, { scale: 2 });
      const link = document.createElement('a');
      link.download = 'etiqueta.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error("Error generating Image", error);
      alert("Error al generar Imagen");
    }
  };
  
  const handleBackendGeneration = () => {
    if (onGenerateBackend) {
      onGenerateBackend(products.map(p => p.id));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-lg w-[1000px] max-h-[90vh] flex flex-col border border-gray-200">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Generar Códigos de Barras</h2>
            <p className="text-xs text-gray-500">Configuración y previsualización de etiquetas</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Settings Panel */}
          <div className="w-1/2 p-6 border-r border-gray-200 overflow-y-auto bg-gray-50">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de código de barras</label>
              <select className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" value={barcodeType} onChange={e => setBarcodeType(e.target.value)}>
                <option value="CODE128">Code128</option>
                <option value="QR">QR Code</option>
              </select>
            </div>
            
            <div className="mb-4">
               <label className="block text-sm font-medium text-gray-700 mb-1.5">Códigos de productos compatibles</label>
               <div className="border border-gray-200 rounded-lg bg-white overflow-y-auto max-h-40">
                 <table className="w-full text-xs text-left">
                   <thead className="bg-gray-100 border-b">
                     <tr>
                       <th className="p-2">Cantidad</th>
                       <th className="p-2">Código</th>
                       <th className="p-2">Nombre del producto</th>
                     </tr>
                   </thead>
                   <tbody>
                     {products.length > 0 ? products.map(p => (
                       <tr key={p.id} className="border-b">
                         <td className="p-2">1</td>
                         <td className="p-2">{p.barcode || p.internal_code || 'SIN CÓDIGO'}</td>
                         <td className="p-2 truncate max-w-[120px]">{p.name}</td>
                       </tr>
                     )) : (
                       <tr><td colSpan="3" className="p-2 text-center text-gray-500">Ningún producto seleccionado</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
               <button onClick={handleBackendGeneration} className="mt-2 text-xs text-blue-600 hover:underline">
                 ¿Generar códigos para productos sin código (Backend)?
               </button>
            </div>
            
            <div className="mb-4 border-b border-gray-200 pb-4">
               <label className="block text-sm font-medium text-gray-700 mb-1.5">Formato</label>
               <div className="flex space-x-4">
                 <label className="flex items-center space-x-2">
                   <input type="radio" name="format" checked={format === 'PDF'} onChange={() => setFormat('PDF')} className="text-blue-600" />
                   <span className="text-sm text-gray-700">Generar PDF</span>
                 </label>
                 <label className="flex items-center space-x-2">
                   <input type="radio" name="format" checked={format === 'IMAGE'} onChange={() => setFormat('IMAGE')} className="text-blue-600" />
                   <span className="text-sm text-gray-700">Generar Imagen</span>
                 </label>
               </div>
               
               <label className="flex items-center space-x-2 mt-4 cursor-pointer">
                  <input type="checkbox" checked={includeCode} onChange={e => setIncludeCode(e.target.checked)} className="text-blue-600" />
                  <span className="text-sm text-gray-700">¿Agregar código del producto al código de barras?</span>
               </label>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block text-xs font-medium text-gray-700 mb-1">DPI</label>
                 <input type="number" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" value={dpi} onChange={e => setDpi(e.target.value)} />
               </div>
               <div>
                 <label className="block text-xs font-medium text-gray-700 mb-1">Tamaño de Fuente</label>
                 <input type="number" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" value={fontSize} onChange={e => setFontSize(e.target.value)} />
               </div>
               <div>
                 <label className="block text-xs font-medium text-gray-700 mb-1">Ancho Hoja (mm)</label>
                 <input type="number" step="0.1" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" value={pageWidth} onChange={e => setPageWidth(e.target.value)} />
               </div>
               <div>
                 <label className="block text-xs font-medium text-gray-700 mb-1">Alto Hoja (mm)</label>
                 <input type="number" step="0.1" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" value={pageHeight} onChange={e => setPageHeight(e.target.value)} />
               </div>
               <div>
                 <label className="block text-xs font-medium text-gray-700 mb-1">Ancho imagen (mm)</label>
                 <input type="number" step="0.1" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" value={imageWidth} onChange={e => setImageWidth(e.target.value)} />
               </div>
               <div>
                 <label className="block text-xs font-medium text-gray-700 mb-1">Alto Imagen (mm)</label>
                 <input type="number" step="0.1" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" value={imageHeight} onChange={e => setImageHeight(e.target.value)} />
               </div>
               <div>
                 <label className="block text-xs font-medium text-gray-700 mb-1">Margen (mm)</label>
                 <input type="number" step="0.1" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" value={margin} onChange={e => setMargin(e.target.value)} />
               </div>
            </div>
            
            <button className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors flex items-center justify-center" onClick={format === 'PDF' ? handleGeneratePDF : handleGenerateImage}>
               <CheckSquare className="w-4 h-4 mr-2" />
               Generar código de barras
            </button>
          </div>
          
          {/* Preview Panel */}
          <div className="w-1/2 p-6 flex flex-col bg-gray-100">
<h3 className="text-sm font-medium text-gray-700 mb-3">Previsualización</h3>
             <div className="bg-white rounded-lg p-4 mb-4 shadow-sm border border-gray-200">
                <p className="text-sm text-gray-600 mb-3">Escoge la opción a previsualizar :</p>
                <div className="flex space-x-2">
                   <button onClick={handleGeneratePDF} className="flex-1 border border-gray-300 p-2.5 rounded-lg flex items-center justify-center hover:bg-gray-50 text-sm font-medium transition-colors">
                     <Printer className="w-4 h-4 mr-2 text-red-600" /> Generar PDF
                   </button>
                   <button onClick={handleGenerateImage} className="flex-1 border border-gray-300 p-2.5 rounded-lg flex items-center justify-center hover:bg-gray-50 text-sm font-medium transition-colors">
                     <ImageIcon className="w-4 h-4 mr-2 text-green-600" /> Generar Imagen
                   </button>
                </div>
             </div>
             
             <div className="flex-1 bg-white border border-dashed border-gray-400 rounded flex items-center justify-center overflow-auto p-4">
                {products.length > 0 ? (
                  <div 
                    ref={previewRef}
                    className="flex flex-col items-center bg-white" 
                    style={{ 
                      width: `${pageWidth}mm`, 
                      height: `${pageHeight}mm`,
                      padding: `${margin}mm`,
                      boxSizing: 'border-box',
                      border: '1px solid #eee'
                    }}>
                    
                    {barcodeType === 'CODE128' ? (
                      <Barcode 
                        value={products[0].barcode || products[0].internal_code || '00000'} 
                        width={1.5}
                        height={40}
                        fontSize={includeCode ? fontSize : 0}
                        displayValue={includeCode}
                        margin={0}
                      />
                    ) : (
                      <div className="flex flex-col items-center">
                        <QRCodeCanvas value={products[0].barcode || products[0].internal_code || '00000'} size={60} />
                        {includeCode && <span style={{ fontSize: `${fontSize}px` }} className="mt-1 font-mono">{products[0].barcode || products[0].internal_code}</span>}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400">Seleccione un producto para previsualizar</p>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeGeneratorModal;
