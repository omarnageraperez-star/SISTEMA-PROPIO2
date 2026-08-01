import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, Power, Package, Truck, Trash2, Tag, Percent, Edit3, DollarSign, ListFilter } from 'lucide-react';

const BulkEditModal = ({ onClose, onExecute, selectedCount }) => {
  const [selectedAction, setSelectedAction] = useState(null);
  const [modifierType, setModifierType] = useState('value');
  const [editValue, setEditValue] = useState('');

  const actions = [
    {
      id: 'price_buy',
      title: 'Modificar precio de Costo',
      icon: <TrendingDown className="w-8 h-8 text-blue-500 mb-2" />,
      modifiers: ['value', 'fixed', 'percent', 'formula']
    },
    {
      id: 'price_sell',
      title: 'Modificar precio de Venta',
      icon: <TrendingUp className="w-8 h-8 text-green-500 mb-2" />,
      modifiers: ['value', 'fixed', 'percent', 'formula']
    },
    {
      id: 'is_active',
      title: 'Activarlos/Desactivarlos',
      icon: <Power className="w-8 h-8 text-red-500 mb-2" />,
      modifiers: ['toggle']
    },
    {
      id: 'min_stock',
      title: 'Modificar stock mínimo',
      icon: <Package className="w-8 h-8 text-gray-500 mb-2" />,
      modifiers: ['value', 'fixed']
    },
    {
      id: 'max_stock',
      title: 'Modificar stock máximo',
      icon: <Package className="w-8 h-8 text-indigo-500 mb-2" />,
      modifiers: ['value', 'fixed']
    },
    {
      id: 'category',
      title: 'Cambiar Categoría',
      icon: <ListFilter className="w-8 h-8 text-yellow-500 mb-2" />,
      modifiers: ['fixed']
    },
    {
      id: 'provider',
      title: 'Cambiar Proveedor',
      icon: <Truck className="w-8 h-8 text-teal-500 mb-2" />,
      modifiers: ['fixed']
    },
    {
      id: 'delete',
      title: 'Eliminarlos',
      icon: <Trash2 className="w-8 h-8 text-red-600 mb-2" />,
      modifiers: []
    }
  ];

  const handleActionClick = (actionId) => {
    setSelectedAction(actionId);
    const actionObj = actions.find(a => a.id === actionId);
    if (actionObj && actionObj.modifiers.length > 0) {
      setModifierType(actionObj.modifiers[0]);
    }
  };

  const execute = () => {
    if (!selectedAction) return;
    onExecute({ action: selectedAction, modifier_type: modifierType, value: editValue });
  };

  const getModifierLabel = (mod) => {
    switch(mod) {
      case 'value': return 'Por valor (+/-)';
      case 'fixed': return 'Por valor fijo';
      case 'percent': return 'Por %';
      case 'formula': return 'Por fórmula';
      case 'toggle': return 'Estado';
      default: return mod;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-[900px] max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
          <h2 className="text-lg font-semibold text-gray-700">Cantidad de registros a modificar: {selectedCount} registros</h2>
          <button onClick={onClose} className="p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 bg-gray-100">
          <div className="grid grid-cols-2 gap-4">
            {/* Top row (Prices) */}
            <div className="col-span-2 grid grid-cols-2 gap-4">
              {actions.slice(0, 2).map(action => (
                <div key={action.id} className={`bg-white border-2 rounded-lg p-0 cursor-pointer overflow-hidden ${selectedAction === action.id ? 'border-blue-500' : 'border-gray-200'}`}>
                  <div className="p-4 flex flex-col items-center justify-center h-24" onClick={() => handleActionClick(action.id)}>
                    {action.icon}
                    <span className="text-sm font-medium">{action.title}</span>
                  </div>
                  {selectedAction === action.id && (
                    <div className="flex border-t divide-x">
                      {action.modifiers.map(mod => (
                        <button key={mod} 
                          onClick={() => setModifierType(mod)}
                          className={`flex-1 py-2 text-xs font-medium ${modifierType === mod ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                          {getModifierLabel(mod)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Middle row */}
            <div className="col-span-2 grid grid-cols-3 gap-4">
              {actions.slice(2, 5).map(action => (
                <div key={action.id} className={`bg-white border-2 rounded-lg p-0 cursor-pointer overflow-hidden flex flex-col ${selectedAction === action.id ? 'border-blue-500' : 'border-gray-200'}`}>
                  <div className="p-4 flex flex-col items-center justify-center flex-1" onClick={() => handleActionClick(action.id)}>
                    {action.icon}
                    <span className="text-sm font-medium text-center">{action.title}</span>
                  </div>
                  {selectedAction === action.id && action.modifiers.length > 0 && action.id !== 'is_active' && (
                    <div className="flex border-t divide-x">
                      {action.modifiers.map(mod => (
                        <button key={mod} 
                          onClick={() => setModifierType(mod)}
                          className={`flex-1 py-2 text-xs font-medium ${modifierType === mod ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                          {getModifierLabel(mod)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom row */}
            <div className="col-span-2 grid grid-cols-3 gap-4">
              {actions.slice(5).map(action => (
                <div key={action.id} className={`bg-white border-2 rounded-lg p-0 cursor-pointer overflow-hidden flex flex-col ${selectedAction === action.id ? 'border-blue-500' : 'border-gray-200'}`}>
                  <div className="p-4 flex flex-col items-center justify-center flex-1" onClick={() => handleActionClick(action.id)}>
                    {action.icon}
                    <span className="text-sm font-medium text-center">{action.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {selectedAction && selectedAction !== 'delete' && (
            <div className="mt-6 p-4 bg-white rounded-lg border shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">Valor para aplicar:</label>
              {selectedAction === 'is_active' ? (
                <select className="w-full border p-2 rounded" value={editValue} onChange={e => setEditValue(e.target.value)}>
                  <option value="">Seleccione...</option>
                  <option value="true">Activar</option>
                  <option value="false">Desactivar</option>
                </select>
              ) : selectedAction === 'category' || selectedAction === 'provider' ? (
                <input type="number" placeholder="ID de la Categoría/Proveedor" className="w-full border p-2 rounded" value={editValue} onChange={e => setEditValue(e.target.value)} />
              ) : (
                <input type="number" placeholder="Ingrese el valor numérico" className="w-full border p-2 rounded" value={editValue} onChange={e => setEditValue(e.target.value)} />
              )}
            </div>
          )}
          
          {selectedAction === 'delete' && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <strong>Advertencia:</strong> Esta acción eliminará permanentemente los {selectedCount} registros seleccionados.
            </div>
          )}
        </div>
        
        <div className="p-4 border-t bg-gray-50 flex justify-end">
           <button onClick={onClose} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100 mr-2">Cancelar</button>
           <button onClick={execute} disabled={!selectedAction} className="px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50">
             Ejecutar Acción
           </button>
        </div>
      </div>
    </div>
  );
};

export default BulkEditModal;
