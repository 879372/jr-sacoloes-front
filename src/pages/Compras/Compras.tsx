import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { 
  Plus, 
  FileText, 
  Truck, 
  Calendar, 
  DollarSign, 
  X,
  Info,
  Search,
  ExternalLink,
  Check,
  Package
} from 'lucide-react';
import { toast } from 'sonner';

interface NotaCompra {
  id: string;
  numero_nf: string;
  fornecedor: string;
  cnpj_fornecedor: string;
  data_emissao: string;
  data_entrada: string;
  valor_total: string;
  status: 'PENDENTE' | 'RECEBIDA' | 'CANCELADA';
  observacoes: string;
}

const STATUS_MAP: Record<string, { label: string, color: string }> = {
  PENDENTE: { label: 'Pendente', color: 'badge-yellow' },
  RECEBIDA: { label: 'Recebida', color: 'badge-green' },
  CANCELADA: { label: 'Cancelada', color: 'badge-red' },
};

export default function Compras() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ 
    numero_nf: '', 
    fornecedor: '', 
    cnpj_fornecedor: '', 
    data_emissao: '', 
    valor_total: '', 
    observacoes: '' 
  });

  const { data: notas = [], isLoading } = useQuery<NotaCompra[]>({
    queryKey: ['notas-compra'],
    queryFn: async () => {
      const resp = await api.get('/notas-compra/');
      return resp.data.results || resp.data;
    },
  });

  const mutation = useMutation({
    mutationFn: (newNota: any) => api.post('/notas-compra/', newNota),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-compra'] });
      setShowModal(false);
      setForm({ numero_nf: '', fornecedor: '', cnpj_fornecedor: '', data_emissao: '', valor_total: '', observacoes: '' });
      toast.success('Nota fiscal registrada com sucesso!');
    },
  });

  const receberMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notas-compra/${id}/receber/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-compra'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] }); // Para atualizar o estoque global se estiver em cache
      toast.success('Nota recebida! Estoque atualizado.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.erro || 'Erro ao receber nota.');
    }
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate({ 
      ...form, 
      valor_total: parseFloat(form.valor_total || '0') 
    });
  };

  const handleInputChange = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Gestão de Compras</h1>
          <p className="page-subtitle">Registro de Notas e Entradas de Mercadoria</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Registrar Nota Fiscal
        </button>
      </div>

      <div className="card" style={{ marginBottom: 24, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
        <Info size={18} className="text-accent" style={{ color: 'var(--accent)' }} />
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <strong>Próximo passo:</strong> Implementaremos a importação automática via XML/Sefaz. Por enquanto, utilize o lançamento manual.
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div className="loading" style={{ height: 300 }}>Carregando histórico de compras...</div>
        ) : notas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: '50%', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <FileText size={40} style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Nenhuma nota fiscal</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Comece registrando sua primeira compra de fornecedor.</p>
            <button className="btn btn-ghost" onClick={() => setShowModal(true)}>+ Nova NF</button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>NF Nº</th>
                  <th>Fornecedor</th>
                  <th>Data Emissão</th>
                  <th>Entrada</th>
                  <th>Valor Total</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {notas.map(n => (
                  <tr key={n.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{n.numero_nf || 'S/N'}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{n.fornecedor}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{n.cnpj_fornecedor || 'CNPJ não informado'}</div>
                    </td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={12} /> {n.data_emissao || '—'}</div></td>
                    <td>{new Date(n.data_entrada).toLocaleDateString('pt-BR')}</td>
                    <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                      R$ {Number(n.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_MAP[n.status]?.color || 'badge-blue'}`}>
                        {STATUS_MAP[n.status]?.label || n.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {n.status === 'PENDENTE' && (
                          <button 
                            className="btn btn-sm btn-primary" 
                            style={{ background: 'var(--accent-green)', padding: '4px 10px', fontSize: '0.75rem' }} 
                            onClick={() => receberMutation.mutate(n.id)}
                            disabled={receberMutation.isPending}
                          >
                            <Check size={14} />
                            Receber
                          </button>
                        )}
                        <button className="btn btn-sm btn-ghost" title="Ver detalhes">
                           <ExternalLink size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="card animate-in" style={{ width: '100%', maxWidth: 550, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 8, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 8, color: 'var(--accent)' }}>
                  <FileText size={20} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Novo Lançamento: NF Entrada</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="form-label">Número da NF</label>
                  <input className="input" value={form.numero_nf} onChange={e => handleInputChange('numero_nf', e.target.value)} placeholder="000123" />
                </div>
                <div>
                  <label className="form-label">Data de Emissão</label>
                  <input className="input" type="date" value={form.data_emissao} onChange={e => handleInputChange('data_emissao', e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Fornecedor / Razão Social *</label>
                  <div style={{ position: 'relative' }}>
                    <Truck size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                    <input className="input" style={{ paddingLeft: 36 }} required value={form.fornecedor} onChange={e => handleInputChange('fornecedor', e.target.value)} placeholder="Nome do fornecedor" />
                  </div>
                </div>
                <div>
                  <label className="form-label">CNPJ Fornecedor</label>
                  <input className="input" value={form.cnpj_fornecedor} onChange={e => handleInputChange('cnpj_fornecedor', e.target.value)} placeholder="00.000.000/0001-00" />
                </div>
                <div>
                  <label className="form-label">Valor Total (R$) *</label>
                  <div style={{ position: 'relative' }}>
                    <DollarSign size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                    <input className="input" style={{ paddingLeft: 36 }} type="number" step="0.01" required value={form.valor_total} onChange={e => handleInputChange('valor_total', e.target.value)} placeholder="0,00" />
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Conteúdo XML ou Observações</label>
                  <textarea className="input" rows={4} style={{ resize: 'vertical' }} value={form.observacoes} onChange={e => handleInputChange('observacoes', e.target.value)} placeholder="Cole o conteúdo do XML da nota fiscal aqui ou adicione observações sobre a entrada de mercadoria..." />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={mutation.isPending}>
                  {mutation.isPending ? 'Salvando...' : 'Confirmar Entrada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
