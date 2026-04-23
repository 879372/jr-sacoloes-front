import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import fiscalApi from '../../services/fiscalApi';
import { 
  Plus, 
  FileText, 
  Truck, 
  Calendar, 
  DollarSign, 
  X,
  Info,
  Search,
  Check,
  CheckCircle2,
  RefreshCw,
  Archive
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
  chave_acesso?: string;
}

const STATUS_MAP: Record<string, { label: string, color: string, icon: any }> = {
  PENDENTE: { label: 'Aguardando', color: 'badge-yellow', icon: Info },
  RECEBIDA: { label: 'Confirmada', color: 'badge-green', icon: CheckCircle2 },
  CANCELADA: { label: 'Cancelada', color: 'badge-red', icon: X },
};

const formatCurrency = (val: any) => {
  return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Compras() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'PENDENTE' | 'CONFIRMADAS' | 'CANCELADAS'>('PENDENTE');
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // Início do mês
    end: new Date().toISOString().split('T')[0] 
  });
  
  const [form, setForm] = useState({ 
    numero_nf: '', 
    fornecedor: '', 
    cnpj_fornecedor: '', 
    data_emissao: '', 
    valor_total: '', 
    observacoes: '',
    chave_acesso: ''
  });

  // Query mapeada para o status correto
  const currentStatus = activeTab === 'PENDENTE' ? 'PENDENTE' : (activeTab === 'CONFIRMADAS' ? 'RECEBIDA' : 'CANCELADA');

  const { data: items = [], isLoading, refetch } = useQuery<NotaCompra[]>({
    queryKey: ['compras-data', currentStatus, searchTerm, dateRange],
    queryFn: async () => {
      const resp = await api.get('/notas-compra/', { 
        params: { 
          status: currentStatus,
          search: searchTerm || undefined,
          data_inicio: dateRange.start,
          data_fim: dateRange.end
        } 
      });
      return resp.data.results || resp.data;
    },
  });

  const mutation = useMutation({
    mutationFn: (newNota: any) => api.post('/notas-compra/', newNota),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras-data'] });
      setShowModal(false);
      resetForm();
      toast.success('Nota fiscal registrada!');
    },
  });

  const receberMutation = useMutation({
    mutationFn: (id: string) => api.post(`/notas-compra/${id}/receber/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras-data'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Compra confirmada! Estoque atualizado.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.erro || 'Erro ao confirmar recebimento.');
    }
  });

  // Lógica de Sincronização Unificada
  const handleSync = async () => {
    setIsSyncing(true);
    const toastId = toast.loading('Sincronizando notas da Sefaz...');
    try {
      // 1. Busca distribuições na API Fiscal (MDe)
      const resp = await fiscalApi.get('/cloud/distribuicao/nfe/', { 
        params: { 
          cpf_cnpj: import.meta.env.VITE_EMPRESA_CNPJ?.replace(/\D/g, '') || '00000000000000', 
          ambiente: import.meta.env.VITE_FISCAL_AMBIENTE || 'producao' 
        } 
      });
      
      // A resposta do ACBr Cloud vem como { "@count": X, "data": [ { documents: [...] } ] }
      const distributions = resp.data?.data || [];
      
      // Achata todos os documentos de todas as distribuições em um único array
      const allDocs = distributions.flatMap((dist: any) => dist.documentos || []);
      
      if (!allDocs.length) {
        toast.info('Nenhuma nota nova encontrada na Sefaz.', { id: toastId });
        return;
      }

      // 2. Tenta "Pré-cadastrar" notas novas (ResNFe ou procNFe)
      let novos = 0;
      for (const doc of allDocs) {
        // Ignora documentos que não sejam resumos de NF-e ou a própria NF-e
        if (doc.tipo_documento !== 'ResNFe' && doc.tipo_documento !== 'procNFe') continue;

        try {
          await api.post('/notas-compra/', {
            numero_nf: doc.numero || '', 
            fornecedor: doc.nome_emitente || doc.xNome || 'Fornecedor Desconhecido',
            cnpj_fornecedor: doc.documento_emitente || doc.CNPJ || '',
            data_emissao: doc.data_emissao || doc.dhEmi || new Date().toISOString(),
            valor_total: parseFloat(doc.valor_total || doc.vNF || '0'),
            chave_acesso: doc.chave_acesso || doc.chNFe,
            status: 'PENDENTE',
            observacoes: 'Sincronizado automaticamente via Sefaz (MDe)'
          });
          novos++;
        } catch (e: any) {
          // Ignora se for erro de unicidade (já existe) ou outros erros de post
          continue;
        }
      }

      if (novos > 0) {
        toast.success(`Sincronização concluída! ${novos} novas notas importadas.`, { id: toastId });
      } else {
        toast.info('Sincronização concluída. Nenhuma nota nova para importar.', { id: toastId });
      }
      refetch();
    } catch (err: any) {
      console.error('Erro na sincronização:', err);
      toast.error('Erro ao conectar com a API Fiscal ou processar dados.', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const resetForm = () => {
    setForm({ numero_nf: '', fornecedor: '', cnpj_fornecedor: '', data_emissao: '', valor_total: '', observacoes: '', chave_acesso: '' });
  };

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
          <p className="page-subtitle">Central de Notas Fiscais e Entradas</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            Sincronizar Sefaz
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Registrar Manual
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="tabs-container" style={{ background: 'var(--bg-card)', padding: '6px', borderRadius: '12px' }}>
          <button 
            className={`tab-item ${activeTab === 'PENDENTE' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('PENDENTE'); setSearchTerm(''); }}
            style={{ borderRadius: '8px' }}
          >
            <Archive size={16} style={{ marginRight: 8 }} />
            Pendentes
          </button>
          <button 
            className={`tab-item ${activeTab === 'CONFIRMADAS' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('CONFIRMADAS'); setSearchTerm(''); }}
            style={{ borderRadius: '8px' }}
          >
            <CheckCircle2 size={16} style={{ marginRight: 8 }} />
            Confirmadas
          </button>
          <button 
            className={`tab-item ${activeTab === 'CANCELADAS' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('CANCELADAS'); setSearchTerm(''); }}
            style={{ borderRadius: '8px' }}
          >
            <X size={16} style={{ marginRight: 8 }} />
            Canceladas
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS UNIFICADA */}
      <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 16, alignItems: 'end' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>BUSCAR FORNECEDOR / NF</label>
            <div className="search-input-wrapper" style={{ margin: 0 }}>
              <Search size={18} className="search-icon" />
              <input 
                className="input" 
                placeholder="Ex: Nome, CNPJ ou Nº da NF" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DE (DATA ENTRADA)</label>
            <input 
              type="date" 
              className="input" 
              value={dateRange.start} 
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} 
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ATÉ (DATA ENTRADA)</label>
            <input 
              type="date" 
              className="input" 
              value={dateRange.end} 
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} 
            />
          </div>

          <button className="btn btn-ghost" onClick={() => refetch()} style={{ height: 42 }}>
             <RefreshCw size={16} />
             Atualizar
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div className="loading" style={{ height: 300 }}>Carregando registros...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: 16, opacity: 0.5 }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Nada por aqui</h3>
            <p style={{ color: 'var(--text-muted)' }}>Use o botão sincronizar para buscar notas da Sefaz.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Fornecedor / Emitente</th>
                  <th>Data Emissão</th>
                  <th>Chave / Número</th>
                  <th>Valor Total</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((n) => {
                  const StatusIcon = STATUS_MAP[n.status]?.icon || Info;
                  return (
                    <tr key={n.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{n.fornecedor}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{n.cnpj_fornecedor}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                          <Calendar size={14} className="text-muted" />
                          {n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : '—'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                          {n.numero_nf ? `NF: ${n.numero_nf}` : (n.chave_acesso ? `Chave: ...${n.chave_acesso.slice(-8)}` : 'S/N')}
                        </div>
                      </td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 800 }}>
                        R$ {formatCurrency(n.valor_total)}
                      </td>
                      <td>
                        <span className={`badge ${STATUS_MAP[n.status]?.color || 'badge-blue'}`} style={{ gap: 4 }}>
                          <StatusIcon size={12} />
                          {STATUS_MAP[n.status]?.label || n.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {n.status === 'PENDENTE' && (
                            <button 
                              className="btn btn-sm btn-primary" 
                              style={{ background: 'var(--accent-green)', padding: '6px 12px' }} 
                              onClick={() => receberMutation.mutate(n.id)}
                              disabled={receberMutation.isPending}
                            >
                              <Check size={14} />
                              Confirmar
                            </button>
                          )}
                          <button className="btn btn-sm btn-ghost" title="Ver detalhes">
                             <FileText size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL MANUAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="card animate-in" style={{ width: '100%', maxWidth: 550 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Lançamento Manual</h2>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Nome do Fornecedor *</label>
                  <input className="input" required value={form.fornecedor} onChange={e => handleInputChange('fornecedor', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Número da NF</label>
                  <input className="input" value={form.numero_nf} onChange={e => handleInputChange('numero_nf', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Data de Emissão</label>
                  <input className="input" type="date" value={form.data_emissao} onChange={e => handleInputChange('data_emissao', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Valor Total (R$) *</label>
                  <input className="input" type="number" step="0.01" required value={form.valor_total} onChange={e => handleInputChange('valor_total', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Chave de Acesso</label>
                  <input className="input" value={form.chave_acesso} onChange={e => handleInputChange('chave_acesso', e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Observações</label>
                  <textarea className="input" rows={3} value={form.observacoes} onChange={e => handleInputChange('observacoes', e.target.value)} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={mutation.isPending}>
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
