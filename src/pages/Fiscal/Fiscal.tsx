import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../lib/api';
import fiscalApi from '../../services/fiscalApi';
import { 
  FileText, 
  Send, 
  Download, 
  Zap, 
  Search,
  CheckCircle2,
  AlertCircle,
  Archive,
  X,
  ChevronRight
} from 'lucide-react';

interface FiscalDoc {
  id: string;
  ref: string;
  numero: string;
  chave_nfe: string;
  cliente_nome?: string;
  nome_destinatario?: string;
  venda_total: string;
  status: string;
  status_sefaz: string;
  mensagem_sefaz: string;
  caminho_danfe: string;
  created_at: string;
  tipo?: string; // NFC-e ou NF-e
}

const STATUS_MAP: Record<string, { label: string, color: string, icon: any }> = {
  autorizada: { label: 'Autorizada', color: 'badge-green', icon: CheckCircle2 },
  processando: { label: 'Processando', color: 'badge-yellow', icon: AlertCircle },
  cancelada: { label: 'Cancelada', color: 'badge-red', icon: Zap },
  denegada: { label: 'Denegada', color: 'badge-red', icon: AlertCircle },
  rejeitada: { label: 'Rejeitada', color: 'badge-orange', icon: AlertCircle },
  pendente: { label: 'Pendente', color: 'badge-blue', icon: FileText },
};

export default function Fiscal() {
  const [activeTab, setActiveTab] = useState<'nfce' | 'nfe'>('nfce');
  const [periodo, setPeriodo] = useState({ de: '', ate: '' });
  const [showEmitirModal, setShowEmitirModal] = useState(false);
  const [vendaSelecionada, setVendaSelecionada] = useState<any>(null);
  const [tipoEmissao, setTipoEmissao] = useState<'nfce' | 'nfe'>('nfce');
  const [filtroVenda, setFiltroVenda] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: notas = [], isLoading, refetch: refetchNotas, isFetching } = useQuery<any[]>({
    queryKey: ['fiscal-docs', activeTab, periodo],
    staleTime: 0, // Garante que os dados sejam considerados "velhos" imediatamente para forçar refetch
    gcTime: 0,    // Remove do cache ao desmontar ou trocar key
    queryFn: async () => {
      const resp = await api.get('/vendas/', { 
        params: { 
          nf_emitida: true, 
          nf_tipo: activeTab,
          data_inicio: periodo.de,
          data_fim: periodo.ate
        } 
      });
      const results = resp.data.results || resp.data;
      return results.map((v: any) => ({
        id: v.id,
        ref: v.id.toString(),
        numero: v.nf_numero,
        chave_nfe: v.nf_chave,
        cliente_nome: v.cliente_nome,
        venda_total: v.total,
        status: v.nf_status?.toLowerCase() || 'pendente',
        tipo: v.nf_tipo || 'nfce',
        created_at: v.data,
        nf_url_pdf: v.nf_url_pdf,
        nf_mensagem: v.nf_mensagem
      }));
    }
  });

  const { data: vendasPendentes = [], refetch: refetchVendas } = useQuery<any[]>({
    queryKey: ['vendas-pendentes-nota', filtroVenda],
    queryFn: async () => {
      const resp = await api.get('/vendas/', { params: { status: 'FINALIZADA', nf_emitida: false, search: filtroVenda } });
      return resp.data.results || resp.data;
    },
    enabled: showEmitirModal
  });

  const handleSync = async (n: any) => {
    setIsSyncing(true);
    try {
      // Por enquanto, apenas um "refetch" do backend para ver se o status mudou na Bridge
      // Em uma implementação real, poderíamos ter um endpoint no backend que consulta o Bridge e atualiza a venda.
      await refetchNotas();
      toast.success('Informações atualizadas!');
    } catch {
      toast.error('Erro ao consultar status.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePreview = (n: any) => {
    if (n.nf_url_pdf) {
      window.open(n.nf_url_pdf, '_blank');
    } else {
      toast.error('URL do DANFE não disponível para esta nota.');
    }
  };

  const exportarXML = () => {
    const emitidas = notas.filter(n => n.status === 'autorizada');
    if (emitidas.length === 0) {
      toast.warning(`Nenhuma ${activeTab.toUpperCase()} autorizada para exportação.`);
      return;
    }
    toast.info(`${emitidas.length} notas localizadas. Prepare o download dos XMLs no dashboard da ACBr.`);
  };

  const handleEnviarEmail = async (n: any) => {
    const email = prompt('Informe o e-mail do destinatário:');
    if (!email) return;
    try {
      await fiscalApi.post(`/nfe/${n.chave_nfe}/enviar-email/`, { emails: [email] });
      toast.success('Solicitação de e-mail enviada!');
    } catch {
      toast.error('Erro ao enviar e-mail.');
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Módulo Fiscal</h1>
          <p className="page-subtitle">Gestão de Documentos Fiscais Eletrônicos (Registrados no ERP)</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={exportarXML}>
            <Archive size={18} />
            Exportar p/ Contador
          </button>
          <button className="btn btn-primary" onClick={() => setShowEmitirModal(true)}>
            <Send size={18} />
            Emissão Manual
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20, position: 'relative' }}>
        <div className="tabs-container">
          <button 
            className={`tab-item ${activeTab === 'nfce' ? 'active' : ''}`} 
            onClick={() => {
              setActiveTab('nfce');
              refetchNotas();
            }}
          >
            NFC-e (Consumidor)
          </button>
          <button 
            className={`tab-item ${activeTab === 'nfe' ? 'active' : ''}`} 
            onClick={() => {
              setActiveTab('nfe');
              refetchNotas();
            }}
          >
            NF-e (Mercadoria)
          </button>
        </div>
        {isFetching && (
          <div style={{ position: 'absolute', right: 0, top: 0, padding: '4px 12px', fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600 }}>
             Carregando...
          </div>
        )}
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 28 }}>
        <div className="card" style={{ borderLeft: '4px solid var(--accent)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 8, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 8, color: 'var(--accent)' }}>
              <FileText size={20} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Controle Interno</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: 20 }}>
            Listando apenas documentos emitidos por este ERP e vinculados a vendas.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontWeight: 600 }}>
             <CheckCircle2 size={16} /> 
             Base de Dados Sincronizada
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--accent-green)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 8, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, color: 'var(--accent-green)' }}>
              <Download size={20} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Filtro por Período</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input className="input" type="date" style={{ width: 140, fontSize: '0.8rem' }} value={periodo.de} onChange={e => setPeriodo(p => ({ ...p, de: e.target.value }))} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>ATÉ</span>
            <input className="input" type="date" style={{ width: 140, fontSize: '0.8rem' }} value={periodo.ate} onChange={e => setPeriodo(p => ({ ...p, ate: e.target.value }))} />
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }} onClick={() => refetchNotas()}>
            Aplicar Filtros
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
            {`Histórico de ${activeTab.toUpperCase()}`}
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => refetchNotas()} disabled={isLoading}>
              <Search size={14} /> Atualizar
            </button>
          </div>
        </div>

        {isLoading && notas.length === 0 ? (
          <div className="table-wrapper">
             <table className="table">
               <thead>
                 <tr><th>Tipo</th><th>Nº / Chave</th><th>Destinatário</th><th>Valor Total</th><th>Status</th></tr>
               </thead>
               <tbody>
                  {[1, 2, 3, 4, 5].map(i => (
                    <tr key={i}><td colSpan={5}><div className="skeleton-line" style={{ height: 24, margin: '8px 0' }}></div></td></tr>
                  ))}
               </tbody>
             </table>
          </div>
        ) : notas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🧾</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Sem {activeTab.toUpperCase()} registradas</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              As notas fiscais autorizadas vinculadas a vendas aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
             <table className="table">
               <thead>
                 <tr>
                   <th>Modelo</th>
                   <th>Nº</th>
                   <th>Destinatário</th>
                   <th>Valor Total</th>
                   <th>Data/Hora</th>
                   <th>Status</th>
                   <th>Ações</th>
                 </tr>
               </thead>
               <tbody>
                 {notas.map(n => {
                   const S = STATUS_MAP[n.status] || { label: n.status, color: 'badge-blue', icon: FileText };
                   
                   return (
                     <tr key={n.id}>
                       <td><span className={`badge ${activeTab === 'nfce' ? 'badge-blue' : 'badge-purple'}`} style={{ fontWeight: 800 }}>{n.tipo.toUpperCase()}</span></td>
                       <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{n.numero || 'S/N'}</td>
                       <td>{n.cliente_nome || 'Consumidor Final'}</td>
                       <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                         R$ {Number(n.venda_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                       </td>
                       <td>{n.created_at ? new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                       <td>
                           <span className={`badge ${S.color}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                             <S.icon size={12} />
                             {S.label}
                           </span>
                       </td>
                       <td>
                         <div style={{ display: 'flex', gap: 6 }}>
                           <button className="btn btn-sm btn-ghost" onClick={() => handlePreview(n)} title="Visualizar DANFE">
                             <Download size={14} />
                           </button>
                           
                           {activeTab === 'nfe' && n.status === 'autorizada' && (
                             <button className="btn btn-sm btn-ghost" onClick={() => handleEnviarEmail(n)} title="Enviar por E-mail">
                               <Send size={14} />
                             </button>
                           )}
 
                           {n.status === 'autorizada' && (
                             <button 
                               className="btn btn-sm btn-ghost" 
                               style={{ color: 'var(--accent-red)' }} 
                               title="Cancelar Nota"
                               onClick={async () => {
                                 if (window.confirm(`Deseja cancelar esta ${n.tipo.toUpperCase()}? Esta ação é irreversível na SEFAZ.`)) {
                                   try {
                                     const justificativa = prompt(`Justificativa (mínimo 15 caracteres):`, 'Erro na emissão: itens incorretos');
                                     if (!justificativa || justificativa.length < 15) {
                                       toast.error('Justificativa inválida ou muito curta.');
                                       return;
                                     }
                                     await api.post(`/vendas/${n.id}/cancelar/`, { justificativa });
                                     toast.success('Solicitação de cancelamento enviada!');
                                     refetchNotas();
                                   } catch (err: any) {
                                     const msg = err.response?.data?.mensagem_sefaz || err.response?.data?.detail || err.response?.data?.erro || 'Erro ao cancelar nota.';
                                     toast.error(msg);
                                   }
                                 }
                               }}
                             >
                               <X size={14} />
                             </button>
                           )}
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

      {/* MODAL EMITIR MANUAL */}
      {showEmitirModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEmitirModal(false)}>
          <div className="card animate-in" style={{ width: '100%', maxWidth: 600, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 8, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 8, color: 'var(--accent)' }}>
                  <Archive size={20} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Emissão Manual de Nota</h2>
              </div>
              <button onClick={() => setShowEmitirModal(false)} className="btn btn-ghost" style={{ borderRadius: '50%', padding: 6 }}><X size={20} /></button>
            </div>

            <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="label">Modelo de Documento</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    className={`btn ${tipoEmissao === 'nfce' ? 'btn-primary' : 'btn-ghost'}`} 
                    style={{ flex: 1 }}
                    onClick={() => setTipoEmissao('nfce')}
                  >
                    NFC-e (Consumidor)
                  </button>
                  <button 
                    className={`btn ${tipoEmissao === 'nfe' ? 'btn-primary' : 'btn-ghost'}`} 
                    style={{ flex: 1 }}
                    onClick={() => setTipoEmissao('nfe')}
                  >
                    NF-e (Mercadoria)
                  </button>
                </div>
              </div>

              <label className="label">Importar de uma Venda</label>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                 <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                 <input 
                  className="input" 
                  placeholder="Pesquisar venda por ID ou cliente..." 
                  style={{ paddingLeft: 40 }}
                  value={filtroVenda}
                  onChange={e => setFiltroVenda(e.target.value)}
                 />
              </div>

              {vendasPendentes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <CheckCircle2 size={32} style={{ color: 'var(--accent-green)', opacity: 0.5, marginBottom: 12 }} />
                   <p style={{ fontWeight: 600 }}>Nenhuma venda pendente.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {vendasPendentes.map(v => (
                    <div 
                      key={v.id} 
                      className="card" 
                      style={{ 
                        padding: '16px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        transition: 'all 0.2s',
                        borderColor: vendaSelecionada?.id === v.id ? 'var(--accent)' : 'var(--border)',
                        background: vendaSelecionada?.id === v.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                      }}
                      onClick={() => setVendaSelecionada(v)}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>Venda #{v.id}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(v.created_at).toLocaleString('pt-BR')} · {v.cliente_nome || 'Consumidor Final'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ color: 'var(--accent-green)', fontWeight: 800 }}>R$ {Number(v.total).toFixed(2)}</div>
                        <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, background: 'rgba(255,255,255,0.01)' }}>
               <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowEmitirModal(false)}>Cancelar</button>
               <button 
                className="btn btn-primary" 
                style={{ flex: 2 }} 
                disabled={!vendaSelecionada}
                onClick={async () => {
                  try {
                    toast.info(`Transmitindo ${tipoEmissao.toUpperCase()} para SEFAZ...`);
                    
                    const resp = await api.post(`/vendas/${vendaSelecionada.id}/emitir-nfce/`, {
                      tipo: tipoEmissao
                    });

                    if (resp.data.erro) {
                        toast.error(`Erro: ${resp.data.erro}`);
                    } else {
                        toast.success(`${tipoEmissao.toUpperCase()} autorizada com sucesso!`);
                        const url = resp.data.url_consulta || resp.data.url_pdf;
                        if (url) window.open(url, '_blank');
                        setShowEmitirModal(false);
                        setVendaSelecionada(null);
                        refetchNotas();
                        refetchVendas();
                    }
                  } catch (err: any) {
                    const msg = err.response?.data?.mensagem_sefaz || err.response?.data?.detail || err.response?.data?.erro || 'Erro ao emitir nota.';
                    toast.error(msg);
                  }
                }}
               >
                 Transmitir Agora
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
