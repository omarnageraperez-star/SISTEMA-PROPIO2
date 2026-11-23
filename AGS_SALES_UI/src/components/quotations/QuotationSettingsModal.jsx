import React, { useState, useEffect } from 'react';
import { X, Save, Sliders, Shield, Clock, Hash, Plus, Trash2, CheckCircle } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import Swal from 'sweetalert2';

export default function QuotationSettingsModal({ config, token, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    consecutive_prefix: 'COT-',
    consecutive_include_year: true,
    default_validity_days: 15,
    enable_stock_reservation: true,
    default_reservation_days: 3,
    allow_manual_items: true,
    allow_zero_stock_quotation: true,
    max_discount_cashier: 10.0,
    default_terms: '',
    default_notes: '',
    pdf_primary_color: '#2563eb',
    custom_fields_schema: []
  });

  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');

  const baseUrl = config?.apiUrl?.replace(/\/$/, '') || '';

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`${baseUrl}/quotations/configuration/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setForm({
          consecutive_prefix: data.consecutive_prefix || 'COT-',
          consecutive_include_year: Boolean(data.consecutive_include_year),
          default_validity_days: data.default_validity_days || 15,
          enable_stock_reservation: Boolean(data.enable_stock_reservation),
          default_reservation_days: data.default_reservation_days || 3,
          allow_manual_items: Boolean(data.allow_manual_items),
          allow_zero_stock_quotation: Boolean(data.allow_zero_stock_quotation),
          max_discount_cashier: parseFloat(data.max_discount_cashier || 10.0),
          default_terms: data.default_terms || '',
          default_notes: data.default_notes || '',
          pdf_primary_color: data.pdf_primary_color || '#2563eb',
          custom_fields_schema: Array.isArray(data.custom_fields_schema) ? data.custom_fields_schema : []
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiRequest(`${baseUrl}/quotations/configuration/`, {
        method: 'POST',
        body: JSON.stringify(form)
      }, token);

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Configuración guardada',
          text: 'Los parámetros de cotizaciones han sido actualizados.',
          timer: 2000,
          showConfirmButton: false
        });
        if (onSaved) onSaved();
        onClose();
      } else {
        const err = await res.json();
        Swal.fire('Error', JSON.stringify(err), 'error');
      }
    } catch (e) {
      Swal.fire('Error', 'No se pudo guardar la configuración.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addCustomField = () => {
    if (!newFieldLabel.trim()) return;
    const nameKey = newFieldName.trim() || newFieldLabel.trim().toLowerCase().replace(/\s+/g, '_');
    const existing = form.custom_fields_schema || [];
    if (existing.some(f => f.name === nameKey)) {
      Swal.fire('Atención', 'Ya existe un campo con ese identificador.', 'warning');
      return;
    }
    const updated = [...existing, { name: nameKey, label: newFieldLabel.trim(), type: newFieldType }];
    setForm({ ...form, custom_fields_schema: updated });
    setNewFieldName('');
    setNewFieldLabel('');
    setNewFieldType('text');
  };

  const removeCustomField = (index) => {
    const updated = form.custom_fields_schema.filter((_, idx) => idx !== index);
    setForm({ ...form, custom_fields_schema: updated });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Ajustes del Módulo de Cotizaciones</h3>
              <p className="text-xs text-slate-400">Personaliza consecutivos, reservas, vigencias y campos dinámicos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Cargando configuración...</div>
        ) : (
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* General & Consecutivos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Prefijo de Consecutivo</label>
                <input
                  type="text"
                  value={form.consecutive_prefix}
                  onChange={(e) => setForm({ ...form, consecutive_prefix: e.target.value })}
                  placeholder="COT-"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <span className="text-[11px] text-slate-400">Ejemplo: COT-, PRES-, COTIZ-</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Días de Vigencia Predeterminados</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.default_validity_days}
                  onChange={(e) => setForm({ ...form, default_validity_days: parseInt(e.target.value) || 15 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <span className="text-[11px] text-slate-400">Días que tiene validez la cotización</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-150">
              <input
                type="checkbox"
                id="includeYearCheck"
                checked={form.consecutive_include_year}
                onChange={(e) => setForm({ ...form, consecutive_include_year: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <label htmlFor="includeYearCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
                Incluir año en el consecutivo (ej. <span className="font-bold text-indigo-600">COT-2026-0001</span> en vez de <span className="font-bold">COT-0001</span>)
              </label>
            </div>

            {/* Reglas de Descuento y Stock */}
            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100/70 space-y-4">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                <Shield size={16} /> Reglas de Autorización y Reserva de Inventario
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Descuento Máximo Cajero/Vendedor (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={form.max_discount_cashier}
                    onChange={(e) => setForm({ ...form, max_discount_cashier: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <span className="text-[11px] text-slate-500">Descuentos mayores requieren usuario Administrador</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Días de Reserva de Stock</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={form.default_reservation_days}
                    onChange={(e) => setForm({ ...form, default_reservation_days: parseInt(e.target.value) || 3 })}
                    disabled={!form.enable_stock_reservation}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50"
                  />
                  <span className="text-[11px] text-slate-500">Tiempo de bloqueo antes de liberar</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.enable_stock_reservation}
                    onChange={(e) => setForm({ ...form, enable_stock_reservation: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  Permitir reservar stock al aprobar cotización
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.allow_zero_stock_quotation}
                    onChange={(e) => setForm({ ...form, allow_zero_stock_quotation: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  Permitir cotizar productos sin stock físico
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.allow_manual_items}
                    onChange={(e) => setForm({ ...form, allow_manual_items: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  Permitir ítems libres / servicios manuales
                </label>
              </div>
            </div>

            {/* Adaptabilidad: Campos Personalizados para cualquier tipo de negocio */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Campos Personalizados (Adaptabilidad por Negocio)</h4>
                  <p className="text-[11px] text-slate-500">Agrega campos que apliquen a tu rubro (ej. Fecha de evento, Obra, Placa, Personas)</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-end pt-1">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre / Etiqueta Visible</label>
                  <input
                    type="text"
                    placeholder="Ej. Fecha de evento"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipo</label>
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="text">Texto</option>
                    <option value="date">Fecha</option>
                    <option value="number">Número</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addCustomField}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>

              {form.custom_fields_schema && form.custom_fields_schema.length > 0 && (
                <div className="divide-y divide-slate-100 bg-white rounded-xl border border-slate-150 overflow-hidden">
                  {form.custom_fields_schema.map((field, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{field.label}</span>
                        <span className="ml-2 text-slate-400">({field.name} • {field.type})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomField(idx)}
                        className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Términos y Notas por Defecto */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Términos y Condiciones Predeterminados</label>
                <textarea
                  rows="3"
                  value={form.default_terms}
                  onChange={(e) => setForm({ ...form, default_terms: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notas al Pie Predeterminadas</label>
                <textarea
                  rows="2"
                  value={form.default_notes}
                  onChange={(e) => setForm({ ...form, default_notes: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save size={15} /> {saving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
