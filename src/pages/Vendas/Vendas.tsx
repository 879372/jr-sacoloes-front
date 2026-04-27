import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { 
  Search, 
  Eye, 
  Trash2, 
  FileText, 
  CheckCircle2,
  Clock,
  User,
  X,
  ShoppingCart,
  Smartphone,
  Printer
} from 'lucide-react';
import { thermalPrinter } from '../../lib/thermalPrint';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface VendaItem {
  id: number;
  produto_nome?: string;
  produto?: {
    nome: string;
    unidade_medida: string;
  };
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  unidade: string;
}

interface VendaPagamento {
  id: number;
  forma: string;
  valor: number;
}

interface Venda {
  id: number;
  data: string;
  cliente_nome: string;
  total: number;
  status: 'EM_ABERTO' | 'FINALIZADA' | 'CANCELADA';
  nf_emitida: boolean;
  nf_url_pdf?: string;
  id_externo?: string;
  desconto?: number;
  itens: VendaItem[];
  pagamentos: VendaPagamento[];
}

const formatCurrency = (val: any) => {
  const num = Number(val);
  return isNaN(num) ? '0,00' : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Vendas() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState({ 
    start: new Date().toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const [selectedVenda, setSelectedVenda] = useState<Venda | null>(null);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [clienteTelefone, setClienteTelefone] = useState('');

  const { data: vendas, isLoading } = useQuery<Venda[]>({
    queryKey: ['vendas', searchTerm, statusFilter, dateRange],
    queryFn: async () => {
      const resp = await api.get('/vendas/', { 
        params: { 
          q: searchTerm, 
          status: statusFilter || undefined,
          data_inicio: dateRange.start,
          data_fim: dateRange.end
        } 
      });
      return resp.data.results || resp.data;
    }
  });

  const cancelarMutation = useMutation({
    mutationFn: ({ id, justificativa }: { id: number, justificativa?: string }) => 
      api.post(`/vendas/${id}/cancelar/`, { justificativa }),
    onSuccess: () => {
      toast.success('Venda cancelada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      setSelectedVenda(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.mensagem_sefaz || err.response?.data?.detail || err.response?.data?.erro || 'Erro ao cancelar venda.';
      toast.error(msg);
    }
  });

  const emitirNFCeMutation = useMutation({
    mutationFn: (id: number) => api.post(`/vendas/${id}/emitir-nfce/`),
    onSuccess: (resp) => {
      if (resp.data.status === 'error' || resp.data.erro || resp.data.mensagem_sefaz) {
        const msg = resp.data.mensagem_sefaz || resp.data.erro || resp.data.mensagem;
        toast.error(`Erro: ${msg}`);
      } else {
        toast.success('NFC-e autorizada!');
        if (resp.data.url_pdf) window.open(resp.data.url_pdf, '_blank');
        queryClient.invalidateQueries({ queryKey: ['vendas'] });
        setSelectedVenda(null);
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.mensagem_sefaz || err.response?.data?.detail || 'Erro ao comunicar com a SEFAZ.';
      toast.error(msg);
    }
  });

  const handlePrintUSB = async (venda: Venda) => {
    try {
      let cupom = `     JR SACOLOES\n`;
      cupom += `   Comprovante de Venda\n`;
      cupom += `--------------------------------\n`;
      cupom += `Data: ${new Date(venda.data).toLocaleString('pt-BR')}\n`;
      cupom += `Venda: #${venda.id}\n`;
      cupom += `--------------------------------\n`;
      
      venda.itens.forEach((item) => {
        const nome = (item.produto?.nome || item.produto_nome || 'Item').substring(0, 18).padEnd(18, ' ');
        const totalItem = (item.subtotal || 0).toFixed(2).padStart(8, ' ');
        cupom += `${nome} ${totalItem}\n`;
        cupom += `  ${item.quantidade.toFixed(3)} x ${item.preco_unitario.toFixed(2)}\n`;
      });
      
      cupom += `--------------------------------\n`;
      cupom += `SUBTOTAL:       R$ ${Number(venda.total || 0).toFixed(2).padStart(10, ' ')}\n`;
      if ((venda.desconto || 0) > 0) {
        cupom += `DESCONTO:     - R$ ${Number(venda.desconto).toFixed(2).padStart(10, ' ')}\n`;
      }
      const totalLiq = Number(venda.total || 0) - Number(venda.desconto || 0);
      cupom += `TOTAL:          R$ ${totalLiq.toFixed(2).padStart(10, ' ')}\n`;
      cupom += `--------------------------------\n`;
      
      if (venda.nf_emitida) {
          cupom += `NFC-e: ${venda.id} Serie: 1\n`; // Ajustar se tiver campos específicos
          cupom += `Chave de Acesso:\n`;
          cupom += `Consulte no site da SEFAZ\n`;
          cupom += `--------------------------------\n`;
      }

      cupom += `       OBRIGADO! \n`;

      if (venda.nf_url_pdf || venda.id_externo) {
          // Tenta reconstruir a URL de consulta se for fiscal
          const publicUrl = import.meta.env.VITE_PUBLIC_URL;
          const apiBase = publicUrl || (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '');
          const qrUrl = venda.nf_url_pdf || `${apiBase}/api/comprovante/${venda.id_externo}/`;
          await thermalPrinter.printWithQRCode(cupom, qrUrl);
      } else {
          await thermalPrinter.print(cupom);
      }
      
      toast.success('Imprimindo via USB...');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao imprimir. Verifique a impressora USB.');
    }
  };

  const handleSendWhatsapp = () => {
    if (!selectedVenda) return;

    const publicUrl = import.meta.env.VITE_PUBLIC_URL;
    const apiBase = publicUrl || (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '');
    const idExterno = selectedVenda.id_externo;

    if (!selectedVenda.nf_url_pdf && !idExterno) {
        toast.error('Não foi possível gerar o link do comprovante.');
        return;
    }

    const linkComprovante = selectedVenda.nf_url_pdf || `${apiBase}/api/comprovante/${idExterno}/`;
    const descontoMsg = (selectedVenda.desconto || 0) > 0 ? `Desconto: R$ ${Number(selectedVenda.desconto).toFixed(2)}\n` : '';

    const texto = `*JR SACOLÕES - Seu Comprovante*\n\n` +
      `Olá! Segue o link do seu comprovante de compra:\n\n` +
      `${linkComprovante}\n\n` +
      descontoMsg +
      `Obrigado pela preferência!`;

    const encodedText = encodeURIComponent(texto);
    const fone = clienteTelefone.replace(/\D/g, '');
    
    window.open(`https://wa.me/${fone ? '55' + fone : ''}?text=${encodedText}`, '_blank');
    setShowWhatsappModal(false);
    setClienteTelefone('');
  };

  const handleConnectPrinter = async () => {
    try {
      await thermalPrinter.requestDevice();
      toast.success('Impressora USB Conectada!');
    } catch (e) {
      toast.error('Falha ao conectar impressora.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FINALIZADA': return <span className="badge badge-green">Finalizada</span>;
      case 'CANCELADA': return <span className="badge badge-red">Cancelada</span>;
      case 'EM_ABERTO': return <span className="badge badge-yellow">Em Aberto</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Histórico de Vendas</h1>
        <p className="page-subtitle">Gerencie e consulte todas as transações realizadas no PDV.</p>
      </div>

      {/* FILTROS */}
      <div className="card" style={{ marginBottom: 24, padding: '16px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1.5fr) 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CLIENTE / ID</label>
            <div className="search-input-wrapper" style={{ margin: 0 }}>
              <Search className="search-icon" size={18} />
              <input 
                type="text" 
                className="input" 
                placeholder="Buscar..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DATA INICIAL</label>
            <input 
              type="date" 
              className="input" 
              value={dateRange.start} 
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} 
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DATA FINAL</label>
            <input 
              type="date" 
              className="input" 
              value={dateRange.end} 
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} 
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>STATUS</label>
            <select 
              className="select" 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="FINALIZADA">Finalizadas</option>
              <option value="CANCELADA">Canceladas</option>
              <option value="EM_ABERTO">Em Aberto</option>
            </select>
          </div>

          <button className="btn btn-ghost" onClick={() => queryClient.invalidateQueries({ queryKey: ['vendas'] })} style={{ height: 42 }}>
            <Clock size={18} />
            Atualizar
          </button>
        </div>
      </div>

      {/* TABELA */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Data / Hora</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Fisc.</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="loading">Carregando vendas...</td></tr>
              ) : vendas?.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Nenhuma venda encontrada.</td></tr>
              ) : (
                vendas?.map((v, idx) => (
                  <tr key={`${v.id}-${idx}`}>
                    <td style={{ fontWeight: 700 }}>#{String(v.id).slice(-6).toUpperCase()}</td>
                    <td>{new Date(v.data).toLocaleString('pt-BR')}</td>
                    <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                           <User size={14} className="text-muted" />
                           {v.cliente_nome || 'Consumidor Final'}
                        </div>
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                      R$ {formatCurrency(v.total)}
                    </td>
                    <td>
                      {v.nf_emitida ? (
                        <div title="Nota Emitida">
                          <CheckCircle2 size={16} className="text-accent-green" />
                        </div>
                      ) : (
                        <div title="Sem nota">
                          <Clock size={16} className="text-muted" />
                        </div>
                      )}
                    </td>
                    <td>{getStatusBadge(v.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelectedVenda(v)}>
                        <Eye size={16} />
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DETALHES */}
      {selectedVenda && (
        <div className="modal-overlay" onClick={() => setSelectedVenda(null)}>
          <div className="card animate-in" style={{ width: '100%', maxWidth: 1000, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>Venda #{selectedVenda?.id ? String(selectedVenda.id).slice(-6).toUpperCase() : '---'}</h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                   {selectedVenda?.data ? new Date(selectedVenda.data).toLocaleString('pt-BR') : 'Data Indisponível'} · {selectedVenda?.cliente_nome || 'Consumidor Final'}
                </div>
              </div>
              <button onClick={() => setSelectedVenda(null)} className="btn btn-ghost" style={{ borderRadius: '50%', padding: 8 }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '32px', maxHeight: '70vh', overflowY: 'auto' }}>
               <div style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Itens da Venda</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                     {selectedVenda.itens?.map((item, idx) => (
                       <div key={`item-${item.id}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--border)' }}>
                          <div>
                             <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                               {item?.produto?.nome || item?.produto_nome || 'Produto desconhecido'}
                             </div>
                             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item?.quantidade} x R$ {formatCurrency(item?.preco_unitario)}</div>
                          </div>
                          <div style={{ fontWeight: 800 }}>R$ {formatCurrency(item?.subtotal)}</div>
                       </div>
                     ))}
                  </div>
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                  <div>
                     <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Pagamento</h3>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selectedVenda.pagamentos?.map((p, idx) => (
                          <div key={`p-${p.id}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                             <span style={{ color: 'var(--text-secondary)' }}>{p?.forma || 'Pagamento'}</span>
                             <span style={{ fontWeight: 700 }}>R$ {formatCurrency(p?.valor)}</span>
                          </div>
                        ))}
                     </div>
                  </div>
                  <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: 20, borderRadius: 16, border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                     <div className="kpi-label" style={{ color: 'var(--accent)' }}>Total da Transação</div>
                     <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)' }}>R$ {formatCurrency(selectedVenda.total)}</div>
                     <div style={{ marginTop: 8 }}>{getStatusBadge(selectedVenda.status)}</div>
                  </div>
               </div>
            </div>

            <div style={{ padding: '24px 32px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
               <button 
                  onClick={handleConnectPrinter} 
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Printer size={12} />
                  Configurar Impressora
                </button>
               
               <div style={{ display: 'flex', gap: 12 }}>
                {selectedVenda.status === 'FINALIZADA' && (
                  <>
                    <button 
                      className="btn btn-ghost" 
                      style={{ color: 'var(--accent-green)', borderColor: 'var(--accent-green)' }}
                      onClick={() => setShowWhatsappModal(true)}
                    >
                      <Smartphone size={16} />
                      WhatsApp
                    </button>
                    <button 
                      className="btn btn-ghost" 
                      style={{ color: 'var(--accent-green)', background: 'rgba(16, 185, 129, 0.1)' }}
                      onClick={() => handlePrintUSB(selectedVenda)}
                    >
                      <Printer size={16} />
                      Reimprimir (USB)
                    </button>
                    
                    <button 
                      className="btn btn-danger" 
                      onClick={() => {
                        let justificativa = '';
                        if (selectedVenda.nf_emitida) {
                          justificativa = prompt(
                            'Esta venda possui NFC-e emitida. Informe a justificativa de cancelamento (mínimo 15 caracteres):',
                            'Venda cancelada por desistencia do cliente ou erro de digitacao'
                          ) || '';
                          
                          if (!justificativa || justificativa.length < 15) {
                            if (justificativa) toast.error('Justificativa muito curta (mínimo 15 caracteres).');
                            return;
                          }
                        }

                        if (confirm('Tem certeza que deseja cancelar esta venda? O estoque será devolvido.')) {
                          cancelarMutation.mutate({ id: selectedVenda.id, justificativa });
                        }
                      }}
                      disabled={cancelarMutation.isPending}
                    >
                      <Trash2 size={16} />
                      Cancelar Venda
                    </button>
                    
                    {!selectedVenda.nf_emitida && (
                      <button 
                        className="btn btn-primary"
                        onClick={() => emitirNFCeMutation.mutate(selectedVenda.id)}
                        disabled={emitirNFCeMutation.isPending}
                      >
                        <FileText size={16} />
                        Emitir NFC-e
                      </button>
                    )}
                  </>
                )}

                {selectedVenda.status === 'EM_ABERTO' && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate(`/pdv?venda_id=${selectedVenda.id}`)}
                  >
                    <ShoppingCart size={16} />
                    Continuar no PDV
                  </button>
                )}
               </div>
            </div>
          </div>
        </div>
      )}

      {showWhatsappModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="card animate-in" style={{ maxWidth: 450, width: '90%', padding: 32, textAlign: 'center' }}>
            <div style={{ padding: 12, background: 'rgba(34, 197, 94, 0.1)', borderRadius: '50%', color: 'var(--accent-green)', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Smartphone size={28} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8 }}>Reenviar WhatsApp</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.9rem' }}>Informe o número do cliente.</p>
            
            <input 
              className="input" 
              type="text" 
              autoFocus 
              value={clienteTelefone}
              onChange={e => setClienteTelefone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendWhatsapp()}
              style={{ textAlign: 'center', fontSize: '1.25rem', height: 50, fontWeight: 700, marginBottom: 20 }}
              placeholder="(00) 00000-0000"
            />
            
            <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowWhatsappModal(false)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1, background: 'var(--accent-green)' }} onClick={handleSendWhatsapp}>
                    Enviar Agora
                </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS LOCAIS PARA O HISTÓRICO */}
      <style>{`
        .badge {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .btn-danger {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .btn-danger:hover {
          background: #ef4444;
          color: white;
        }
      `}</style>
    </div>
  );
}
