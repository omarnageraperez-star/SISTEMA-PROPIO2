import React, { useState } from 'react';
import { X, Plus, Trash2, Check, Sparkles, Tag, Layers, Sliders, Box } from 'lucide-react';

export default function QuotationItemExtrasModal({
  item,
  symbol = '$',
  onClose,
  onSave,
  products = []
}) {
  const [extras, setExtras] = useState(() => {
    return Array.isArray(item.extras) ? JSON.parse(JSON.stringify(item.extras)) : [];
  });

  const [customizations, setCustomizations] = useState(() => {
    return Array.isArray(item.customizations) ? JSON.parse(JSON.stringify(item.customizations)) : [];
  });

  // State for new extra
  const [newExtra, setNewExtra] = useState({
    name: '',
    price_type: 'FIXED', // FIXED, PER_UNIT, PERCENTAGE
    rate: '',
    quantity: 1,
    product_id: '',
    deduct_stock: false
  });

  // State for new customization
  const [newCust, setNewCust] = useState({
    name: '',
    value: '',
    impact_type: 'NONE', // NONE, ADD, SUBTRACT, MULTIPLY
    impact_value: ''
  });

  const handleAddExtra = () => {
    if (!newExtra.name.trim()) return;
    const rateVal = parseFloat(newExtra.rate) || 0;
    const qtyVal = parseFloat(newExtra.quantity) || 1;
    
    // Calculate preview price
    let calcPrice = rateVal * qtyVal;
    if (newExtra.price_type === 'PER_UNIT') {
      calcPrice = rateVal * (parseFloat(item.quantity) || 1) * qtyVal;
    } else if (newExtra.price_type === 'PERCENTAGE') {
      const lineBase = (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0);
      calcPrice = (lineBase * (rateVal / 100)) * qtyVal;
    }

    setExtras([
      ...extras,
      {
        ...newExtra,
        rate: rateVal,
        quantity: qtyVal,
        total_price: calcPrice
      }
    ]);

    setNewExtra({
      name: '',
      price_type: 'FIXED',
      rate: '',
      quantity: 1,
      product_id: '',
      deduct_stock: false
    });
  };

  const handleRemoveExtra = (idx) => {
    setExtras(extras.filter((_, i) => i !== idx));
  };

  const handleAddCustomization = () => {
    if (!newCust.name.trim() || !newCust.value.trim()) return;
    setCustomizations([
      ...customizations,
      {
        ...newCust,
        impact_value: parseFloat(newCust.impact_value) || 0
      }
    ]);
    setNewCust({
      name: '',
      value: '',
      impact_type: 'NONE',
      impact_value: ''
    });
  };

  const handleRemoveCustomization = (idx) => {
    setCustomizations(customizations.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave({
      extras,
      customizations
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                Personalización & Adicionales
              </span>
              <h3 className="text-sm font-bold text-slate-800 truncate max-w-sm">{item.name}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Configura extras, garantías, opciones de diseño, medidas o insumos para esta línea
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECCIÓN 1: ADICIONALES / EXTRAS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Sparkles size={16} className="text-amber-500" />
                <span>Adicionales & Extras (Garantía, Instalación, Accesorios)</span>
              </div>
            </div>

            {/* Inputs para agregar nuevo adicional */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Ej. Garantía extendida 1 año, Instalación"
                    value={newExtra.name}
                    onChange={(e) => setNewExtra({ ...newExtra, name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
                <div>
                  <select
                    value={newExtra.price_type}
                    onChange={(e) => setNewExtra({ ...newExtra, price_type: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="FIXED">Monto Fijo Total ($)</option>
                    <option value="PER_UNIT">Por Unidad de Ítem ($/u)</option>
                    <option value="PERCENTAGE">Porcentaje de Línea (%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`Precio o %`}
                    value={newExtra.rate}
                    onChange={(e) => setNewExtra({ ...newExtra, rate: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    min="1"
                    placeholder="Cantidad"
                    value={newExtra.quantity}
                    onChange={(e) => setNewExtra({ ...newExtra, quantity: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newExtra.deduct_stock}
                      onChange={(e) => setNewExtra({ ...newExtra, deduct_stock: e.target.checked })}
                      className="w-3.5 h-3.5 text-indigo-600 rounded"
                    />
                    Descontar Stock
                  </label>
                  <button
                    type="button"
                    onClick={handleAddExtra}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} /> Agregar
                  </button>
                </div>
              </div>
            </div>

            {/* Listado de Adicionales configurados */}
            {extras.length > 0 ? (
              <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-150 overflow-hidden">
                {extras.map((ex, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50">
                    <div>
                      <span className="font-bold text-slate-800">{ex.name}</span>
                      <span className="ml-2 text-slate-400">
                        ({ex.price_type === 'PERCENTAGE' ? `${ex.rate}%` : `${symbol}${parseFloat(ex.rate).toLocaleString()}`} 
                        {ex.price_type === 'PER_UNIT' && ' por unid.'}
                        {ex.quantity > 1 && ` x ${ex.quantity}`})
                        {ex.deduct_stock && ' • Descuenta Stock'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600">
                        +{symbol}{parseFloat(ex.total_price || 0).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtra(idx)}
                        className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No hay adicionales configurados en esta línea.</p>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* SECCIÓN 2: PERSONALIZACIONES & ATRIBUTOS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Sliders size={16} className="text-blue-500" />
                <span>Personalizaciones & Opciones (Talla, Color, Medidas, Grabado)</span>
              </div>
            </div>

            {/* Formulario nueva personalización */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>
                  <input
                    type="text"
                    placeholder="Opción (ej. Color)"
                    value={newCust.name}
                    onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Valor (ej. Azul, XL)"
                    value={newCust.value}
                    onChange={(e) => setNewCust({ ...newCust, value: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <select
                    value={newCust.impact_type}
                    onChange={(e) => setNewCust({ ...newCust, impact_type: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="NONE">Sin impacto en precio</option>
                    <option value="ADD">Suma al precio ($)</option>
                    <option value="SUBTRACT">Resta al precio ($)</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Impacto $"
                    disabled={newCust.impact_type === 'NONE'}
                    value={newCust.impact_value}
                    onChange={(e) => setNewCust({ ...newCust, impact_value: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomization}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Listado de personalizaciones */}
            {customizations.length > 0 ? (
              <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-150 overflow-hidden">
                {customizations.map((c, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50">
                    <div>
                      <span className="font-bold text-slate-700">{c.name}:</span>
                      <span className="ml-1.5 text-slate-900 font-semibold">{c.value}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.impact_type !== 'NONE' && (
                        <span className={`font-bold ${c.impact_type === 'ADD' ? 'text-indigo-600' : 'text-amber-600'}`}>
                          {c.impact_type === 'ADD' ? '+' : '-'}{symbol}{parseFloat(c.impact_value || 0).toLocaleString()}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomization(idx)}
                        className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No hay personalizaciones configuradas en esta línea.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Check size={16} /> Aplicar a la Línea
          </button>
        </div>
      </div>
    </div>
  );
}
