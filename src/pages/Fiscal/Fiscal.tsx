import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../lib/api';
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
  autorizado: { label: 'Autorizada', color: 'badge-green', icon: CheckCircle2 },
  processando: { label: 'Processando', color: 'badge-yellow', icon: AlertCircle },
  processando_autorizacao: { label: 'Processando', color: 'badge-yellow', icon: AlertCircle },
  cancelado: { label: 'Cancelada', color: 'badge-red', icon: Zap },
  denegado: { label: 'Denegada', color: 'badge-red', icon: AlertCircle },
  erro_autorizacao: { label: 'Erro', color: 'badge-red', icon: AlertCircle },
  pendente: { label: 'Pendente', color: 'badge-blue', icon: FileText },
};

export default function Fiscal() {
  const [activeTab, setActiveTab] = useState<'nfce' | 'nfe' | 'recebidas'>('nfce');
  const [periodo, setPeriodo] = useState({ de: '', ate: '' });
  const [showEmitirModal, setShowEmitirModal] = useState(false);
  const [vendaSelecionada, setVendaSelecionada] = useState<any>(null);
  const [tipoEmissao, setTipoEmissao] = useState<'NFCe' | 'NFe'>('NFCe');
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: notas = [], isLoading, refetch: refetchNotas } = useQuery<any[]>({
    queryKey: ['fiscal-docs', activeTab],
    queryFn: async () => {
      const resp = await api.get(`/fiscal/${activeTab}/`);
      const data = resp.data.results || resp.data;
      if (activeTab === 'recebidas') return data;
      return data.map((d: any) => ({ ...d, tipo: activeTab === 'nfce' ? 'NFC-e' : 'NF-e' }));
    },
    refetchInterval: (query) => {
      if (activeTab === 'recebidas') return false;
      const data = query.state.data as any[] | undefined;
      return data?.some((n: any) => n.status === 'processando' || n.status === 'processando_autorizacao') ? 5000 : false;
    }
  });

  const { data: vendasPendentes = [], refetch: refetchVendas } = useQuery<any[]>({
    queryKey: ['vendas-pendentes-nota'],
    queryFn: async () => {
      const resp = await api.get('/vendas/?status=FINALIZADA&nf_emitida=false');
      return resp.data.results || resp.data;
    },
    enabled: showEmitirModal
  });

  const handleSync = async (n?: any) => {
    setIsSyncing(true);
    try {
      const endpoint = activeTab === 'recebidas' 
        ? `/fiscal/recebidas/sincronizar/`
        : `/fiscal/${activeTab}/${n.id}/sincronizar/`;
      
      const resp = await api.post(endpoint);
      if (activeTab === 'recebidas') {
        toast.success(`Sincronização concluída: ${resp.data.total_novas} novas notas found.`);
      } else {
        toast.success('Status atualizado!');
      }
      refetchNotas();
    } catch (err) {
      toast.error('Erro ao sincronizar.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManifestar = async (n: any) => {
    if (!window.confirm('Deseja registrar "Ciência da Operação" para esta nota? Isso permitirá baixar o XML completo.')) return;
    setIsSyncing(true);
    try {
      await api.post(`/fiscal/recebidas/${n.id}/manifestar_ciencia/`);
      toast.success('Ciência registrada! Aguarde alguns instantes para o XML ficar disponível.');
      refetchNotas();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao manifestar.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportar = async (n: any) => {
    setIsSyncing(true);
    try {
      const resp = await api.post(`/fiscal/recebidas/${n.id}/importar/`);
      toast.success('Nota importada para o módulo de Compras!');
      refetchNotas();
      // Optional: redirect or show link to NotaCompra
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao importar nota. Verifique se o XML completo já está disponível.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePreview = async (n: any) => {
    if (activeTab === 'nfe') {
      window.open(`${api.defaults.baseURL}/fiscal/nfe/${n.id}/preview-danfe/`, '_blank');
    } else if (activeTab === 'nfce') {
      if (n.caminho_danfe) window.open(n.caminho_danfe, '_blank');
    }
  };

  const exportarXML = () => {
    const emitidas = notas.filter(n => n.status === 'autorizado' && (n.caminho_danfe || n.chave_nfe));
    if (emitidas.length === 0) {
      toast.warning(`Nenhuma ${activeTab.toUpperCase()} emitida com XML disponível.`);
      return;
    }
    toast.info(`${emitidas.length} XMLs localizados. Gerando pacote...`);
  };

  const handleEnviarEmail = async (n: FiscalDoc) => {
    const email = prompt('Informe o e-mail do destinatário:');
    if (!email) return;
    try {
      await api.post(`/fiscal/nfe/${n.id}/enviar-email/`, { emails: [email] });
      toast.success('E-mail enviado com sucesso!');
    } catch (err) {
      toast.error('Erro ao enviar e-mail.');
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Módulo Fiscal</h1>
          <p className="page-subtitle">Gestão de Documentos Fiscais Eletrônicos (Modelos 55 e 65)</p>
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

      <div style={{ marginBottom: 20 }}>
        <div className="tabs-container">
          <button 
            className={`tab-item ${activeTab === 'nfce' ? 'active' : ''}`} 
            onClick={() => setActiveTab('nfce')}
          >
            NFC-e (Consumidor)
          </button>
          <button 
            className={`tab-item ${activeTab === 'recebidas' ? 'active' : ''}`} 
            onClick={() => setActiveTab('recebidas')}
          >
            Compras (NF-e Recebidas)
          </button>
        </div>
      </div>

      {activeTab === 'recebidas' && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent-purple)', padding: '24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Sincronização MDe</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Consulte notas fiscais emitidas por terceiros contra seu CNPJ.</p>
            </div>
            <button className="btn btn-primary" onClick={() => handleSync()} disabled={isSyncing}>
              <Search size={16} className={isSyncing ? 'animate-spin' : ''} />
              Sincronizar Notas de Compra
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 28 }}>
        <div className="card" style={{ borderLeft: '4px solid var(--accent)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 8, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 8, color: 'var(--accent)' }}>
              <Zap size={20} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>
              {activeTab === 'recebidas' ? 'Manifestação do Destinatário' : 'Fila de Processamento'}
            </h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: 20 }}>
            {activeTab === 'recebidas' 
              ? 'O MDe permite que você saiba quais notas foram emitidas contra sua empresa. É necessário dar Ciência para baixar o XML.' 
              : activeTab === 'nfe' 
                ? 'NF-e utiliza emissão assíncrona. O status será atualizado via Webhooks em segundos.' 
                : 'NFC-e utiliza emissão síncrona com resposta imediata da SEFAZ.'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', fontWeight: 600 }}>
             <CheckCircle2 size={16} /> 
             WebService: Operacional
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--accent-green)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 8, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, color: 'var(--accent-green)' }}>
              <Download size={20} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Exportação em Massa</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input className="input" type="date" style={{ width: 140, fontSize: '0.8rem' }} value={periodo.de} onChange={e => setPeriodo(p => ({ ...p, de: e.target.value }))} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>ATÉ</span>
            <input className="input" type="date" style={{ width: 140, fontSize: '0.8rem' }} value={periodo.ate} onChange={e => setPeriodo(p => ({ ...p, ate: e.target.value }))} />
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 16, justifyContent: 'center' }} onClick={exportarXML}>
            Baixar Todos os XMLs (ZIP)
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
            {activeTab === 'recebidas' ? 'Notas Recebidas (Compras)' : `Histórico de ${activeTab.toUpperCase()}`}
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => refetchNotas()} disabled={isLoading}>
              <Search size={14} /> Atualizar
            </button>
            <div className="search-input-wrapper" style={{ maxWidth: 300 }}>
               <Search size={16} className="search-icon" />
               <input className="input" placeholder="Buscar por número ou cliente..." style={{ padding: '8px 12px 8px 36px', height: 36 }} />
            </div>
          </div>
        </div>

        {isLoading && notas.length === 0 ? (
          <div className="table-wrapper">
             <table className="table">
               <thead>
                 <tr><th>Tipo</th><th>Nº / Chave</th><th>Emitente</th><th>Valor Total</th><th>Status</th></tr>
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
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Sem {activeTab === 'recebidas' ? 'notas' : activeTab.toUpperCase()} no período</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              {activeTab === 'recebidas' ? 'Clique em Sincronizar para buscar novas notas no portal da Receita.' : 'As notas fiscais aparecerão aqui assim que a primeira venda for integrada.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            {activeTab === 'recebidas' ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Emitente</th>
                    <th>Chave de Acesso</th>
                    <th>Valor Total</th>
                    <th>Data Emissão</th>
                    <th>Manifesto</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {notas.map(n => (
                    <tr key={n.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{n.nome_emitente}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{n.documento_emitente}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{n.chave_nfe}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>R$ {Number(n.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td>{new Date(n.data_emissao).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <span className={`badge ${n.manifestacao_destinatario === 'nulo' ? 'badge-blue' : 'badge-green'}`}>
                          {n.manifestacao_display || n.manifestacao_destinatario}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${n.situacao === 'autorizada' ? 'badge-green' : 'badge-red'}`}>
                          {n.situacao}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {n.manifestacao_destinatario === 'nulo' ? (
                            <button className="btn btn-sm btn-ghost" onClick={() => handleManifestar(n)} title="Dar Ciência">
                              <CheckCircle2 size={14} />
                            </button>
                          ) : (
                            <button 
                              className="btn btn-sm btn-ghost" 
                              style={{ color: 'var(--accent)' }} 
                              onClick={() => handleImportar(n)} 
                              title="Importar para Compras"
                              disabled={n.nota_compra !== null}
                            >
                              <Archive size={14} />
                              {n.nota_compra ? 'Importado' : 'Importar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
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
                    const isProcessing = n.status === 'processando' || n.status === 'processando_autorizacao';
                    
                    return (
                      <tr key={n.id}>
                        <td><span className={`badge ${activeTab === 'nfce' ? 'badge-blue' : 'badge-purple'}`} style={{ fontWeight: 800 }}>{n.tipo}</span></td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{n.numero || 'S/N'}</td>
                        <td>{n.cliente_nome || n.nome_destinatario || 'Consumidor Final'}</td>
                        <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                          R$ {Number(n.venda_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td>{n.created_at ? new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className={`badge ${S.color}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <S.icon size={12} className={isProcessing ? 'animate-spin' : ''} />
                              {S.label}
                            </span>
                            {isProcessing && (
                              <button className="btn btn-link btn-xs" onClick={() => handleSync(n)} disabled={isSyncing}>
                                Sineronizar Agora
                              </button>
                            )}
                          </div>
                          {n.status === 'erro_autorizacao' && n.mensagem_sefaz && (
                            <div style={{ position: 'relative' }}>
                              <p className="text-error" style={{ fontSize: '0.65rem', marginTop: 4, maxWidth: 200, lineHeight: 1.2 }}>
                                {n.mensagem_sefaz.length > 50 ? n.mensagem_sefaz.substring(0, 50) + '...' : n.mensagem_sefaz}
                              </p>
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm btn-ghost" onClick={() => handlePreview(n)} title="Visualizar DANFE">
                              <Download size={14} />
                            </button>
                            
                            {activeTab === 'nfe' && n.status === 'autorizado' && (
                              <button className="btn btn-sm btn-ghost" onClick={() => handleEnviarEmail(n)} title="Enviar por E-mail">
                                <Send size={14} />
                              </button>
                            )}

                            {n.status === 'autorizado' && (
                              <button 
                                className="btn btn-sm btn-ghost" 
                                style={{ color: 'var(--accent-red)' }} 
                                title="Cancelar Nota"
                                onClick={async () => {
                                  if (window.confirm(`Deseja cancelar esta ${n.tipo}? Esta ação é irreversível na SEFAZ.`)) {
                                    try {
                                      const minLen = activeTab === 'nfce' ? 15 : 15;
                                      const justificativa = prompt(`Justificativa (mínimo ${minLen} caracteres):`, 'Erro na emissão: itens incorretos');
                                      if (!justificativa || justificativa.length < minLen) {
                                        toast.error('Justificativa inválida ou muito curta.');
                                        return;
                                      }
                                      await api.post(`/fiscal/${activeTab}/${n.id}/cancelar/`, { justificativa });
                                      toast.success('Solicitação de cancelamento enviada!');
                                      refetchNotas();
                                    } catch (err: any) {
                                      toast.error(err.response?.data?.error || 'Erro ao cancelar nota.');
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
            )}
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
                    className={`btn ${tipoEmissao === 'NFCe' ? 'btn-primary' : 'btn-ghost'}`} 
                    style={{ flex: 1 }}
                    onClick={() => setTipoEmissao('NFCe')}
                  >
                    NFC-e (Consumidor)
                  </button>
                  <button 
                    className={`btn ${tipoEmissao === 'NFe' ? 'btn-primary' : 'btn-ghost'}`} 
                    style={{ flex: 1 }}
                    onClick={() => setTipoEmissao('NFe')}
                  >
                    NF-e (Mercadoria)
                  </button>
                </div>
              </div>

              <label className="label">Vendas Pendentes de Nota</label>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 12 }}>
                Selecione uma venda para gerar a {tipoEmissao.toUpperCase()}.
              </p>

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
                    toast.info(`Transmitindo ${tipoEmissao}...`);
                    
                    const endpoint = tipoEmissao === 'NFCe' 
                      ? `/vendas/${vendaSelecionada.id}/emitir-nfce/`
                      : `/fiscal/nfe/emitir/`;
                    
                    const payload = tipoEmissao === 'NFCe' 
                      ? {} 
                      : { venda_id: vendaSelecionada.id, natureza_operacao: 'Venda de mercadoria' };

                    const resp = await api.post(endpoint, payload);
                    
                    if (resp.data.status === 'erro_autorizacao' || resp.data.status === 'error') {
                      toast.error(`Erro: ${resp.data.mensagem || resp.data.mensagem_sefaz}`);
                    } else {
                      toast.success(tipoEmissao === 'NFCe' ? 'NFC-e autorizada!' : 'NF-e enviada para processamento!');
                      if (resp.data.url_pdf) window.open(resp.data.url_pdf, '_blank');
                      setShowEmitirModal(false);
                      setVendaSelecionada(null);
                      refetchNotas();
                      refetchVendas();
                    }
                  } catch (err: any) {
                    toast.error(err.response?.data?.error || err.response?.data?.erro || 'Erro ao emitir nota.');
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
