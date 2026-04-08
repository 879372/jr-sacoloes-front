import { useState, FormEvent } from 'react';
import api from '../../../lib/api';

interface ContaFormProps {
  tipo: 'PAGAR' | 'RECEBER';
  onSave: () => void;
  onClose: () => void;
}

export default function ContaForm({ tipo, onSave, onClose }: ContaFormProps) {
  const [form, setForm] = useState({ 
    descricao: '', 
    valor: '', 
    vencimento: '', 
    status: 'PENDENTE', 
    observacoes: '', 
    fornecedor_ou_cliente: '' 
  });

  const handleChange = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      vencimento: form.vencimento,
      status: form.status,
      observacoes: form.observacoes,
      ...(tipo === 'PAGAR' ? { fornecedor: form.fornecedor_ou_cliente } : { cliente_nome: form.fornecedor_ou_cliente }),
    };
    
    try {
      const endpoint = tipo === 'PAGAR' ? '/financeiro/contas-pagar/' : '/financeiro/contas-receber/';
      await api.post(endpoint, payload);
      onSave();
    } catch (err) {
      console.error('Erro ao salvar conta:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Descrição *</label>
        <input 
          className="input" 
          required 
          value={form.descricao} 
          onChange={e => handleChange('descricao', e.target.value)} 
          placeholder="Ex: Aluguel, Fornecedor Atacado..." 
        />
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label">{tipo === 'PAGAR' ? 'Fornecedor' : 'Cliente'}</label>
          <input 
            className="input" 
            value={form.fornecedor_ou_cliente} 
            onChange={e => handleChange('fornecedor_ou_cliente', e.target.value)} 
            placeholder="Nome" 
          />
        </div>
        <div className="form-group">
          <label className="form-label">Valor (R$) *</label>
          <input 
            className="input" 
            type="number" 
            step="0.01" 
            required 
            value={form.valor} 
            onChange={e => handleChange('valor', e.target.value)} 
            placeholder="0,00" 
          />
        </div>
        <div className="form-group">
          <label className="form-label">Vencimento *</label>
          <input 
            className="input" 
            type="date" 
            required 
            value={form.vencimento} 
            onChange={e => handleChange('vencimento', e.target.value)} 
          />
        </div>
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label">Status Inicial</label>
          <select 
            className="select" 
            value={form.status} 
            onChange={e => handleChange('status', e.target.value)}
          >
            <option value="PENDENTE">Pendente</option>
            <option value={tipo === 'PAGAR' ? 'PAGO' : 'RECEBIDO'}>{tipo === 'PAGAR' ? 'Efetuado' : 'Recebido'}</option>
            <option value="VENCIDO">Vencido</option>
          </select>
        </div>
      </div>
      
      <div className="form-group">
        <label className="form-label">Observações</label>
        <input 
          className="input" 
          value={form.observacoes} 
          onChange={e => handleChange('observacoes', e.target.value)} 
          placeholder="Opcional" 
        />
      </div>
      
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
          Confirmar Lançamento
        </button>
      </div>
    </form>
  );
}
