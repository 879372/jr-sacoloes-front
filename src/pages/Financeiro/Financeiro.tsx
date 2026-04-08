import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import FinanceiroColumn from './components/FinanceiroColumn';
import ContaForm from './components/ContaForm';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  ArrowRightLeft, 
  X,
  CreditCard,
  Wallet,
  AlertCircle
} from 'lucide-react';

interface Conta {
  id: string;
  descricao: string;
  valor: string;
  vencimento: string;
  status: 'PENDENTE' | 'PAGO' | 'RECEBIDO' | 'VENCIDO';
  fornecedor?: string;
  cliente_nome?: string;
  data_pagamento?: string;
  data_recebimento?: string;
}

export default function Financeiro() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState<'PAGAR' | 'RECEBER' | null>(null);
  const [activeTab, setActiveTab] = useState<'vencidos' | 'pagar' | 'receber' | 'concluidos'>('vencidos');

  // Fetch Contas a Pagar
  const { data: pagar = [], isLoading: loadingPagar } = useQuery<Conta[]>({
    queryKey: ['contas-pagar'],
    queryFn: async () => {
      const resp = await api.get('/financeiro/contas-pagar/');
      return resp.data.results || resp.data;
    },
  });

  // Fetch Contas a Receber
  const { data: receber = [], isLoading: loadingReceber } = useQuery<Conta[]>({
    queryKey: ['contas-receber'],
    queryFn: async () => {
      const resp = await api.get('/financeiro/contas-receber/');
      return resp.data.results || resp.data;
    },
  });

  // Mutation para baixar conta
  const baixarMutation = useMutation({
    mutationFn: async ({ conta, tipo }: { conta: Conta, tipo: 'PAGAR' | 'RECEBER' }) => {
      const endpoint = tipo === 'PAGAR' ? `/financeiro/contas-pagar/${conta.id}/` : `/financeiro/contas-receber/${conta.id}/`;
      const hoje = new Date().toISOString().slice(0, 10);
      return api.patch(endpoint, {
        status: tipo === 'PAGAR' ? 'PAGO' : 'RECEBIDO',
        ...(tipo === 'PAGAR' ? { data_pagamento: hoje } : { data_recebimento: hoje }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      queryClient.invalidateQueries({ queryKey: ['contas-receber'] });
    },
  });

  const handleBaixar = (conta: Conta, tipo: 'PAGAR' | 'RECEBER') => {
    baixarMutation.mutate({ conta, tipo });
  };

  const totalPagar = pagar.filter(c => c.status !== 'PAGO').reduce((a, c) => a + parseFloat(c.valor), 0);
  const totalReceber = receber.filter(c => c.status !== 'RECEBIDO').reduce((a, c) => a + parseFloat(c.valor), 0);
  const loading = loadingPagar || loadingReceber;

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Gestão Financeira</h1>
          <p className="page-subtitle">Fluxo de Caixa e Controle de Contas</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setShowModal('RECEBER')}>
            <TrendingUp size={18} className="text-accent-green" />
            Lançar Recebimento
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal('PAGAR')}>
            <TrendingDown size={18} />
            Lançar Pagamento
          </button>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="skeleton-line" style={{ height: 120, borderRadius: 12 }}></div>
          ))
        ) : (
          <>
            <div className="kpi-card red" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="kpi-label">A Pagar Total</div>
                <div style={{ padding: 6, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6, color: 'var(--accent-red)' }}><TrendingDown size={14} /></div>
              </div>
              <div className="kpi-value">R$ {totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="kpi-sub">pendências de fornecedores</div>
            </div>
            <div className="kpi-card green" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="kpi-label">A Receber Total</div>
                <div style={{ padding: 6, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 6, color: 'var(--accent-green)' }}><TrendingUp size={14} /></div>
              </div>
              <div className="kpi-value">R$ {totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="kpi-sub">receitas pendentes de clientes</div>
            </div>
            <div className="kpi-card blue" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="kpi-label">Projeção Saldo</div>
                <div style={{ padding: 6, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 6, color: 'var(--accent)' }}><ArrowRightLeft size={14} /></div>
              </div>
              <div className="kpi-value">R$ {(totalReceber - totalPagar).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="kpi-sub">considerando todas as pendências</div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .financeiro-tabs { display: none; }
        @media (max-width: 768px) {
          .financeiro-tabs { display: flex; background: var(--bg-secondary); border-radius: 12px; padding: 4px; margin-bottom: 24px; border: 1px solid var(--border); }
          .financeiro-tab { flex: 1; padding: 12px 8px; border: none; background: none; color: var(--text-secondary); font-size: 0.75rem; font-weight: 700; cursor: pointer; border-radius: 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.2s; }
          .financeiro-tab.active { background: var(--bg-card); color: var(--accent); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        }
        .kanban-container { display: flex; gap: 24, overflow-x: auto, padding-bottom: 24px; }
        @media (max-width: 768px) {
          .kanban-container { overflow-x: visible; }
        }
      `}</style>
      
      <div className="financeiro-tabs">
        {[
          { id: 'vencidos', l: 'Vencidos', Icon: AlertCircle },
          { id: 'pagar', l: 'Pagar', Icon: TrendingDown },
          { id: 'receber', l: 'Receber', Icon: TrendingUp },
          { id: 'concluidos', l: 'Pagos', Icon: Wallet }
        ].map(t => (
          <button key={t.id} className={`financeiro-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id as any)}>
            <t.Icon size={16} />
            {t.l}
          </button>
        ))}
      </div>

      <div className="kanban-container">
        {loading ? (
             [1, 2, 3].map(i => (
               <div key={i} style={{ flex: 1, minWidth: 300 }}>
                 <div className="skeleton-line" style={{ height: 24, width: '60%', marginBottom: 16 }}></div>
                 <div className="skeleton-line" style={{ height: 100, marginBottom: 12, borderRadius: 12 }}></div>
                 <div className="skeleton-line" style={{ height: 100, marginBottom: 12, borderRadius: 12 }}></div>
               </div>
             ))
        ) : (
          <>
            <FinanceiroColumn 
              titulo="Vencidos" 
              Icon={<AlertCircle size={20} />} 
              cor="var(--accent-red)"
              isActiveMobile={activeTab === 'vencidos'}
              itens={[...pagar.filter(c => c.status === 'VENCIDO'), ...receber.filter(c => c.status === 'VENCIDO')]}
              onBaixar={c => handleBaixar(c, pagar.find(p => p.id === c.id) ? 'PAGAR' : 'RECEBER')} 
            />
              
            <FinanceiroColumn 
              titulo="A Pagar" 
              Icon={<TrendingDown size={20} />} 
              cor="var(--accent-yellow)"
              isActiveMobile={activeTab === 'pagar'}
              itens={pagar.filter(c => c.status === 'PENDENTE')}
              onBaixar={c => handleBaixar(c, 'PAGAR')} 
            />
              
            <FinanceiroColumn 
              titulo="A Receber" 
              Icon={<TrendingUp size={20} />} 
              cor="var(--accent)"
              isActiveMobile={activeTab === 'receber'}
              itens={receber.filter(c => c.status === 'PENDENTE')}
              onBaixar={c => handleBaixar(c, 'RECEBER')} 
            />
              
            <FinanceiroColumn 
              titulo="Concluídos" 
              Icon={<Wallet size={20} />} 
              cor="var(--accent-green)"
              isActiveMobile={activeTab === 'concluidos'}
              itens={[...pagar.filter(c => c.status === 'PAGO'), ...receber.filter(c => c.status === 'RECEBIDO')]}
              onBaixar={() => {}} 
            />
          </>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(null)}>
          <div className="card animate-in" style={{ width: '100%', maxWidth: 550, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 8, background: showModal === 'PAGAR' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', borderRadius: 8, color: showModal === 'PAGAR' ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                  <CreditCard size={20} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{showModal === 'PAGAR' ? 'Novo Lançamento: A Pagar' : 'Novo Lançamento: A Receber'}</h2>
              </div>
              <button onClick={() => setShowModal(null)} className="btn btn-ghost" style={{ padding: 6, borderRadius: '50%' }}><X size={20} /></button>
            </div>
            <ContaForm 
              tipo={showModal} 
              onClose={() => setShowModal(null)} 
              onSave={() => { setShowModal(null); queryClient.invalidateQueries({ queryKey: ['contas-pagar'] }); queryClient.invalidateQueries({ queryKey: ['contas-receber'] }); }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
