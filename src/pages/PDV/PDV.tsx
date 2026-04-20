import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import fiscalApi from '../../services/fiscalApi';
import { 
  ShoppingCart, 
  Search, 
  X, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  ClipboardList, 
  ArrowRight,
  LogOut,
  Store,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Minus,
  Plus,
  Trash2,
  Lock
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Produto, ItemCarrinho, Sessao, Venda, Pagamento } from './types';
import CashOpsModal from './CashOpsModal';

const FORMAS_PAGAMENTO = [
  { key: 'DINHEIRO', label: 'Dinheiro', icon: Banknote, color: 'var(--accent-green)' },
  { key: 'PIX', label: 'Pix', icon: Smartphone, color: 'var(--accent)' },
  { key: 'CARTAO_DEBITO', label: 'Débito', icon: CreditCard, color: 'var(--accent-yellow)' },
  { key: 'CARTAO_CREDITO', label: 'Crédito', icon: CreditCard, color: 'var(--accent-yellow)' },
  { key: 'FIADO', label: 'Fiado', icon: ClipboardList, color: 'var(--accent-red)' },
];

import { toast } from 'sonner';

export default function PDV() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeVendaId = searchParams.get('venda_id');
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [qtyMultiplier, setQtyMultiplier] = useState(1);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>(() => {
    const saved = localStorage.getItem('pdv_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [venda, setVenda] = useState<Venda | null>(() => {
    const saved = localStorage.getItem('pdv_venda');
    return saved ? JSON.parse(saved) : null;
  });

  // Operações de Caixa
  const [showCashOp, setShowCashOp] = useState(false);
  const [cashOpType, setCashOpType] = useState<'SANGRIA' | 'SUPRIMENTO'>('SANGRIA');
  const [modalFecharCaixaOpen, setModalFecharCaixaOpen] = useState(false);
  const [modalCancelarVendaOpen, setModalCancelarVendaOpen] = useState(false);

  // Persistência local do estado da venda
  useEffect(() => {
    localStorage.setItem('pdv_cart', JSON.stringify(carrinho));
    if (venda) localStorage.setItem('pdv_venda', JSON.stringify(venda));
    else localStorage.removeItem('pdv_venda');
  }, [carrinho, venda]);
  const [showPagamento, setShowPagamento] = useState(false);
  const [fundoInicial, setFundoInicial] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'cart'>('search');
  
  // Pagamentos Múltiplos
  const [pagamentosRealizados, setPagamentosRealizados] = useState<Pagamento[]>([]);
  const [formaPagto, setFormaPagto] = useState('DINHEIRO');
  const [valorPago, setValorPago] = useState('');
  
  const buscaRef = useRef<HTMLInputElement>(null);
  const valorPagoRef = useRef<HTMLInputElement>(null);

  // Totais
  const total = carrinho.reduce((acc, item) => acc + item.subtotal, 0);
  const totalJaPago = pagamentosRealizados.reduce((acc, p) => acc + p.valor, 0);
  const valorRestante = Math.max(0, total - totalJaPago);
  const troco = Math.max(0, totalJaPago - total);

  // 1. Check Active Session
  const { data: sessao, isLoading: loadingSessao } = useQuery<Sessao>({
    queryKey: ['sessao-ativa'],
    queryFn: async () => {
      try {
        const resp = await api.get('/sessoes-caixa/ativa/');
        return resp.data;
      } catch {
        return null;
      }
    },
    staleTime: Infinity, // Só recarrega se invalidado
  });

  // 2. Fetch Active Sale for Session
  const { data: vendaAberta } = useQuery({
    queryKey: ['venda-aberta', sessao?.id, resumeVendaId],
    queryFn: async () => {
      if (!sessao) return null;
      
      // Se houver um ID específico para retomar
      if (resumeVendaId) {
        try {
          const { data } = await api.get(`/vendas/${resumeVendaId}/`);
          return data;
        } catch {
          toast.error('Não foi possível carregar a venda solicitada.');
        }
      }

      // Fallback: carregar a primeira venda aberta da sessão
      const { data } = await api.get('/vendas/', { params: { sessao: sessao.id, status: 'EM_ABERTO' } });
      const results = data.results || data;
      return results.length > 0 ? results[0] : null;
    },
    enabled: !!sessao,
  });

  useEffect(() => {
    if (vendaAberta) {
      setVenda(vendaAberta);
      setCarrinho(vendaAberta.itens.map((i: any) => ({
        id: i.id,
        produto_id: i.produto?.id || i.produto,
        nome: i.produto?.nome || 'Produto sem nome',
        quantidade: parseFloat(i.quantidade),
        preco_unitario: parseFloat(i.preco_unitario),
        subtotal: parseFloat(i.subtotal),
        unidade: i.produto?.unidade_medida || 'UN'
      })));
    }
  }, [vendaAberta]);

  // Mutations
  const abrirCaixaMutation = useMutation({
    mutationFn: (fundo: number) => api.post('/sessoes-caixa/', { fundo_inicial: fundo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessao-ativa'] });
      setTimeout(() => buscaRef.current?.focus(), 200);
    },
  });

  const fecharCaixaMutation = useMutation({
    mutationFn: () => api.post(`/sessoes-caixa/${sessao?.id}/fechar/`),
    onSuccess: () => {
      toast.success('Caixa fechado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['sessao-ativa'] });
      setCarrinho([]);
      setVenda(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.erro || 'Erro ao fechar o caixa.');
    }
  });

  const cancelarVendaMutation = useMutation({
    mutationFn: () => api.post(`/vendas/${venda?.id}/cancelar/`),
    onSuccess: () => {
      toast.success('Venda cancelada!');
      queryClient.invalidateQueries({ queryKey: ['venda-aberta'] });
      setCarrinho([]);
      setVenda(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.erro || 'Erro ao cancelar venda.');
    }
  });

  const removerItemMutation = useMutation({
    mutationFn: async ({ itemId, itemSubtotal }: { itemId: number | string, itemSubtotal: number }) => {
      await api.delete(`/venda-itens/${itemId}/`);
      // Atualiza total da venda
      if (venda) {
        const novoTotal = Math.max(0, Number(venda.total) - itemSubtotal);
        await api.patch(`/vendas/${venda.id}/`, { total: novoTotal });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venda-aberta'] });
    },
    onError: () => toast.error('Erro ao remover item.'),
  });

  const criarVendaMutation = useMutation({
    mutationFn: (sessaoId: string) => api.post('/vendas/', { sessao: sessaoId, total: 0 }),
  });

  const adicionarItemMutation = useMutation({
    mutationFn: async ({ vendaId, produto, qty }: { vendaId: string, produto: Produto, qty: number }) => {
      const preco = Number(produto.preco_venda);
      const { data: item } = await api.post('/venda-itens/', {
        venda: vendaId,
        produto: produto.id,
        quantidade: qty,
        preco_unitario: preco,
        subtotal: preco * qty
      });
      // Atualizar total da venda
      const novoTotal = total + (preco * qty);
      await api.patch(`/vendas/${vendaId}/`, { total: novoTotal });
      return item;
    },
  });

  const finalizarVendaMutation = useMutation({
    mutationFn: async (emitirFiscal: boolean) => {
      const respVenda = await api.post(`/vendas/${venda?.id}/finalizar/`, {
        pagamentos: pagamentosRealizados
      });
      
      if (emitirFiscal) {
          try {
              toast.info('Enviando dados fiscais para ACBr...');
              
              // 1. Mapear itens para o formato ACBr
              const itensFiscal = carrinho.map((item, idx) => ({
                  codigo: item.produto_id?.toString() || idx.toString(),
                  descricao: item.nome,
                  ncm: '00000000', // Padrão se não houver no cadastro
                  cfop: '5102',     // Venda normal
                  unidade: item.unidade || 'UN',
                  quantidade: item.quantidade.toString(),
                  valor_unitario: item.preco_unitario.toFixed(2),
                  valor_total: item.subtotal.toFixed(2),
                  cst_icms: '00',
              }));

              const payloadFiscal = {
                  cnpj_emitente: import.meta.env.VITE_EMPRESA_CNPJ || '00000000000000',
                  itens: itensFiscal,
                  total: total.toFixed(2),
                  pagamento: pagamentosRealizados.map(p => ({
                      forma: p.forma === 'DINHEIRO' ? '01' : 
                             p.forma === 'CARTAO_CREDITO' ? '03' :
                             p.forma === 'CARTAO_DEBITO' ? '04' :
                             p.forma === 'PIX' ? '17' : '99',
                      valor: p.valor.toFixed(2)
                  })),
                  ambiente: 'homologacao'
              };

              // 2. Emitir via nova API Fiscal (Monitor Local ou Cloud Simplificado)
              const respFiscal = await fiscalApi.post('/nfce/emitir/', payloadFiscal);
              
              if (respFiscal.data.status === 'error') {
                  toast.error(`Erro Fiscal: ${respFiscal.data.mensagem_sefaz || respFiscal.data.mensagem}`);
              } else {
                  toast.success('NFC-e Emitida com Sucesso!');
                  if (respFiscal.data.url_consulta) {
                      window.open(respFiscal.data.url_consulta, '_blank');
                  }
              }
          } catch (err: any) {
              const msg = err.response?.data?.detail || err.response?.data?.mensagem || 'Erro ao comunicar com API Fiscal.';
              toast.error(msg);
          }
      }
      return respVenda;
    },
    onSuccess: () => {
      toast.success('Venda finalizada!');
      queryClient.invalidateQueries({ queryKey: ['venda-aberta'] });
      setPagamentosRealizados([]);
      setCarrinho([]);
      setVenda(null);
      setShowPagamento(false);
      setActiveTab('search');
      setTimeout(() => buscaRef.current?.focus(), 100);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.erro || 'Erro ao finalizar venda.');
    }
  });

  // Handlers
  const handleAbrirCaixa = () => {
    abrirCaixaMutation.mutate(parseFloat(fundoInicial || '0'));
  };

  const handleRemoverItem = (item: typeof carrinho[0], idx: number) => {
    if (item.id) {
      // Item persistido no servidor — remove via API
      removerItemMutation.mutate({ itemId: item.id, itemSubtotal: item.subtotal });
    }
    // Remove localmente imediatamente para UX fluida
    setCarrinho(prev => prev.filter((_, i) => i !== idx));
    if (venda) {
      const novoTotal = Math.max(0, Number(venda.total) - item.subtotal);
      setVenda(prev => prev ? { ...prev, total: novoTotal } : prev);
    }
  };

  const handleAdicionarItem = useCallback(async (produto: Produto, qtyOverride?: number) => {
    if (isAdding) return;
    setIsAdding(true);
    
    try {
      let currentVenda = venda;
      if (!currentVenda && sessao) {
         const resp = await criarVendaMutation.mutateAsync(sessao.id);
         currentVenda = resp.data;
         setVenda(currentVenda);
      }
      
      const quantityToAdd = qtyOverride || qtyMultiplier || 1;

      if (currentVenda) {
          await adicionarItemMutation.mutateAsync({ 
            vendaId: currentVenda.id, 
            produto, 
            qty: quantityToAdd 
          });

          setCarrinho(prev => {
              const idx = prev.findIndex(i => i.produto_id === produto.id);
              const preco = Number(produto.preco_venda);
              if (idx >= 0) {
                const novo = [...prev];
                const novaQty = novo[idx].quantidade + quantityToAdd;
                novo[idx] = { 
                  ...novo[idx], 
                  quantidade: novaQty, 
                  subtotal: novaQty * novo[idx].preco_unitario 
                };
                return novo;
              }
              return [...prev, {
                produto_id: produto.id,
                nome: produto.nome,
                quantidade: quantityToAdd,
                preco_unitario: preco,
                subtotal: preco * quantityToAdd,
                unidade: produto.unidade_medida
              }];
          });
          
          setBusca('');
          setResultados([]);
          setSelectedIndex(0);
          setQtyMultiplier(1);
          await refetchVenda();
        }
      } catch {
          toast.error('Erro ao adicionar item.');
      } finally {
        setIsAdding(false);
      }
    }, [isAdding, venda, sessao, adicionarItemMutation, criarVendaMutation, qtyMultiplier]);

  const handleBusca = useCallback(async (q: string) => {
    setBusca(q);
    
    // Suporte ao padrão QTY*SEARCH (ex: 3*COPO)
    let searchTerm = q;
    let multiplier = 1;
    
    if (q.includes('*')) {
      const [qtyPart, ...rest] = q.split('*');
      const parsedQty = parseFloat(qtyPart);
      if (!isNaN(parsedQty) && parsedQty > 0) {
        multiplier = parsedQty;
        searchTerm = rest.join('*');
      }
    }
    
    searchTerm = searchTerm.trim();
    setQtyMultiplier(multiplier);

    if (!searchTerm) { 
      setResultados([]); 
      setSelectedIndex(0);
      return; 
    }

    try {
      const { data } = await api.get('/produtos/busca-pdv/', { params: { q: searchTerm } });
      setResultados(data);
      setSelectedIndex(0);

      // AUTO-ADD: Se retornar exatamente 1 item e o termo de busca for numérico (padrão de código de barras)
      const isBarcode = /^\d+$/.test(searchTerm);
      if (data.length === 1 && isBarcode) {
        handleAdicionarItem(data[0], multiplier);
      }
    } catch { 
      setResultados([]); 
    }
  }, [handleAdicionarItem]);

  const handleAddPagamento = () => {
    const valor = parseFloat(valorPago || '0');
    if (valor <= 0) return;
    setPagamentosRealizados(prev => [...prev, { forma: formaPagto, valor }]);
    setValorPago('');
    valorPagoRef.current?.focus();
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { 
        e.preventDefault(); 
        if (carrinho.length > 0) { 
           setShowPagamento(true); 
           setValorPago(valorRestante.toFixed(2));
           setTimeout(() => valorPagoRef.current?.focus(), 100);
        }
      }
      if (e.key === 'F3') { e.preventDefault(); setActiveTab('search'); buscaRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [carrinho, valorRestante]);

  if (loadingSessao) return <div className="loading">Iniciando terminal de venda...</div>;

  // Tela de Abertura de Caixa
  if (!sessao) {
    return (
      <div className="login-page">
         <div className="login-card animate-in" style={{ textAlign: 'center' }}>
            <div style={{ padding: 20, background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <Store size={40} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 8 }}>Abertura de Caixa</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Informe o fundo de reserva para iniciar o expediente.</p>
            
            <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Fundo Inicial (R$)</label>
                <input 
                  className="input" 
                  type="number" 
                  step="0.01" 
                  autoFocus 
                  value={fundoInicial}
                  onChange={e => setFundoInicial(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAbrirCaixa()}
                  style={{ textAlign: 'center', fontSize: '1.5rem', height: 60, fontWeight: 700 }}
                  placeholder="0,00"
                />
            </div>
            <button className="btn btn-primary" onClick={handleAbrirCaixa} style={{ width: '100%', padding: 16, fontSize: '1rem' }}>
                Iniciar Vendas
                <ArrowRight size={18} />
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/dashboard')} style={{ width: '100%', marginTop: 12 }}>Voltar ao Painel</button>
         </div>
      </div>
    );
  }

  return (
    <div className="pdv-container">
      {/* HEADER */}
      <header className="pdv-header" style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--accent)', color: 'white', padding: 6, borderRadius: 6 }}><Store size={18} /></div>
          <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.5px' }}>JR <span className="text-accent">PDV</span></div>
          {venda && (
            <span style={{ fontSize: '0.7rem', fontWeight: 700, background: 'rgba(59,130,246,0.1)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 4 }}>
              CUPOM #{String(venda.id).slice(-6).toUpperCase()}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
             <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)' }}></div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Operador: {sessao.operador_nome?.split(' ')[0] || 'Gestor'}</span>
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }}></div>
          
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)' }} onClick={() => { setCashOpType('SANGRIA'); setShowCashOp(true); }} title="Sangria (Retirada)">
              <Minus size={14} />
              Sangria
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-green)' }} onClick={() => { setCashOpType('SUPRIMENTO'); setShowCashOp(true); }} title="Suprimento (Entrada)">
              <Plus size={14} />
              Suprimento
            </button>
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }}></div>
          
          <button 
            className="btn btn-ghost btn-sm" 
            style={{ color: 'var(--accent-yellow)', borderColor: 'var(--accent-yellow)' }}
            onClick={() => setModalFecharCaixaOpen(true)}
            disabled={fecharCaixaMutation.isPending}
            title="Fechar Caixa"
          >
            <Lock size={14} />
            Fechar Caixa
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }}></div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>
             <LogOut size={14} />
             Sair
          </button>
        </div>
      </header>

      <div className="pdv-body">
        {/* BUSCA DE PRODUTOS */}
        <section className={`pdv-search-column ${activeTab === 'search' ? 'active' : ''}`}>
           <div style={{ position: 'relative', marginBottom: 20 }}>
              <Search size={20} style={{ position: 'absolute', left: 16, top: 14, color: 'var(--text-muted)' }} />
              <input 
                ref={buscaRef}
                className="input" 
                placeholder="Escaneie ou digite o nome do produto... (F3)" 
                style={{ height: 48, paddingLeft: 48, fontSize: '1rem', borderRadius: 12 }}
                value={busca}
                onChange={e => handleBusca(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIndex(prev => Math.min(prev + 1, resultados.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (resultados.length > 0) {
                      handleAdicionarItem(resultados[selectedIndex]);
                    }
                  } else if (e.key === 'Escape') {
                    setBusca('');
                    setResultados([]);
                  }
                }}
                autoFocus
              />
           </div>

           <div style={{ flex: 1, overflowY: 'auto' }}>
              {resultados.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {resultados.map((p, i) => (
                    <div 
                      key={p.id} 
                      className="card animate-in" 
                      style={{ 
                        padding: '14px 20px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        border: selectedIndex === i ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: selectedIndex === i ? 'var(--bg-hover)' : 'transparent'
                      }}
                      onClick={() => handleAdicionarItem(p)}
                    >
                       <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.nome}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CÓD: {p.codigo_legado || 'N/D'} · {p.unidade_medida || 'UN'}</div>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-green)' }}>R$ {Number(p.preco_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 700 }}>+ ADD ITEM</div>
                       </div>
                    </div>
                  ))}
                </div>
              ) : busca ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <AlertTriangle size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                  <p>Produto não encontrado.</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 60, opacity: 0.3 }}>
                   <Search size={48} style={{ margin: '0 auto 16px' }} />
                   <p style={{ fontWeight: 600 }}>Aguardando entrada de mercadoria...</p>
                </div>
              )}
           </div>
        </section>

        {/* CARRINHO / CUPOM */}
        <section className={`pdv-cart-column ${activeTab === 'cart' ? 'active' : ''}`}>
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                 <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShoppingCart size={18} />
                    CUPOM FISCAL
                 </h3>
                 <span className="badge badge-blue">{carrinho.length} ITENS</span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                 {carrinho.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Nenhum item adicionado
                    </div>
                 ) : (
                    carrinho.map((item, idx) => (
                       <div key={idx} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                             <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.nome}</div>
                             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.quantidade} {item.unidade || 'UN'} x R$ {item.preco_unitario.toFixed(2)}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                             <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)' }}>R$ {item.subtotal.toFixed(2)}</div>
                             <button 
                                style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 2 }} 
                                onClick={() => handleRemoverItem(item, idx)}
                                title="Remover item"
                              >
                                <Trash2 size={10} /> Excluir
                              </button>
                          </div>
                       </div>
                    ))
                 )}
              </div>

              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '2px dashed var(--border)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>SUBTOTAL</span>
                    <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--accent-green)', letterSpacing: '-1.5px' }}>
                      R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                 </div>
                 <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    {venda && (
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ color: 'var(--accent-red)', flex: 1 }}
                        onClick={() => setModalCancelarVendaOpen(true)}
                        disabled={cancelarVendaMutation.isPending}
                      >
                        <AlertTriangle size={14} /> Cancelar Venda
                      </button>
                    )}
                  </div>
                 <button 
                   className="btn btn-primary" 
                   style={{ width: '100%', height: 56, fontSize: '1.1rem', fontWeight: 800 }}
                   onClick={() => setShowPagamento(true)}
                   disabled={carrinho.length === 0}
                 >
                    RECEBER PAGAMENTO (F2)
                 </button>
              </div>
           </div>
        </section>
      </div>

      {/* MODAL DE PAGAMENTO */}
      {showPagamento && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowPagamento(false)}>
          
          <div className="card animate-in" style={{ width: '100%', maxWidth: 700, padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
               <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Finalização de Venda</h2>
               <button onClick={() => setShowPagamento(false)} className="btn btn-ghost" style={{ borderRadius: '50%', padding: 8 }}><X size={24} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 32 }}>
                
                {/* Coluna Esquerda: Lançamento de Pagamento */}
                <div>
                   <div className="form-group" style={{ marginBottom: 24 }}>
                      <label className="form-label">Selecione a Forma de Pagamento</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                         {FORMAS_PAGAMENTO.map(f => (
                           <button 
                             key={f.key} 
                             onClick={() => setFormaPagto(f.key)}
                             style={{ 
                               display: 'flex', alignItems: 'center', gap: 8, padding: '12px', borderRadius: 10, border: '1px solid var(--border)',
                               background: formaPagto === f.key ? 'var(--bg-hover)' : 'transparent',
                               borderColor: formaPagto === f.key ? 'var(--accent)' : 'var(--border)',
                               color: formaPagto === f.key ? 'var(--accent)' : 'var(--text-primary)',
                               cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem'
                             }}
                            >
                             <f.icon size={16} />
                             {f.label}
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="form-group">
                      <label className="form-label">Valor a Receber</label>
                      <div style={{ display: 'flex', gap: 12 }}>
                         <input 
                           ref={valorPagoRef}
                           className="input" 
                           type="number" 
                           step="0.01" 
                           value={valorPago}
                           onChange={e => setValorPago(e.target.value)}
                           onKeyDown={e => e.key === 'Enter' && handleAddPagamento()}
                           style={{ height: 56, fontSize: '1.5rem', fontWeight: 800, textAlign: 'center' }}
                         />
                         <button className="btn btn-primary" onClick={handleAddPagamento} style={{ padding: '0 24px' }}>Confirmar</button>
                      </div>
                   </div>

                   {/* Lista de Pagamentos já feitos */}
                   {pagamentosRealizados.length > 0 && (
                     <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
                        {pagamentosRealizados.map((p, i) => (
                           <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: '0.9rem' }}>
                              <span style={{ fontWeight: 600 }}>{p.forma}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                 <strong>R$ {p.valor.toFixed(2)}</strong>
                                 <button style={{ color: 'var(--accent-red)', border: 'none', background: 'none' }} onClick={() => setPagamentosRealizados(prev => prev.filter((_, idx) => idx !== i))}>✕</button>
                              </div>
                           </div>
                        ))}
                     </div>
                   )}
                </div>

                {/* Coluna Direita: Resumo */}
                <div style={{ background: 'rgba(0,0,0,0.1)', padding: 24, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                   <div>
                      <div className="kpi-label">TOTAL A PAGAR</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>R$ {total.toFixed(2)}</div>
                   </div>
                   <div>
                      <div className="kpi-label">TOTAL RECEBIDO</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-green)' }}>R$ {totalJaPago.toFixed(2)}</div>
                   </div>
                   <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                      {valorRestante > 0 ? (
                        <>
                          <div className="kpi-label" style={{ color: 'var(--accent-red)' }}>FALTA RECEBER</div>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-red)' }}>R$ {valorRestante.toFixed(2)}</div>
                        </>
                      ) : (
                        <>
                          <div className="kpi-label" style={{ color: 'var(--accent-green)' }}>TROCO</div>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-green)' }}>R$ {troco.toFixed(2)}</div>
                        </>
                      )}
                   </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
               <button className="btn btn-ghost" style={{ flex: 1, height: 50 }} onClick={() => finalizarVendaMutation.mutate(true)} disabled={totalJaPago < total || finalizarVendaMutation.isPending}>
                  <FileText size={18} />
                  Cupom Fiscal
               </button>
               <button className="btn btn-primary" style={{ flex: 2, height: 50, fontSize: '1.1rem', fontWeight: 800, background: 'var(--accent-green)' }} 
                 onClick={() => finalizarVendaMutation.mutate(false)} 
                 disabled={totalJaPago < total || finalizarVendaMutation.isPending}
               >
                  <CheckCircle2 size={20} />
                  Finalizar Venda
               </button>
            </div>
          </div>
        </div>
      )}

      {showCashOp && sessao && (
        <CashOpsModal
          sessaoId={sessao.id}
          tipo={cashOpType}
          onClose={() => setShowCashOp(false)}
        />
      )}

      {modalFecharCaixaOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Fechar Caixa</h2>
              <button className="btn-icon" onClick={() => setModalFecharCaixaOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px 0', fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
              Confirmar o fechamento do caixa? Esta ação não pode ser desfeita e irá registrar o fim do turno.
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalFecharCaixaOpen(false)}>
                Voltar
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, background: 'var(--accent-red)', color: 'white', fontWeight: 600 }}
                onClick={() => {
                  setModalFecharCaixaOpen(false);
                  fecharCaixaMutation.mutate();
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalCancelarVendaOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Cancelar Venda</h2>
              <button className="btn-icon" onClick={() => setModalCancelarVendaOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px 0', fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
              Tem certeza que deseja cancelar esta venda em aberto?
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalCancelarVendaOpen(false)}>
                Voltar
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, background: 'var(--accent-red)', color: 'white', fontWeight: 600 }}
                onClick={() => {
                  setModalCancelarVendaOpen(false);
                  cancelarVendaMutation.mutate();
                }}
              >
                Cancelar Venda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
