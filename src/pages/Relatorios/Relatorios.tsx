import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import api from '../../lib/api';
import { 
  BarChart3, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  ChevronRight,
  Filter,
  Wallet,
  Clock,
  User as UserIcon,
  AlertTriangle,
  X
} from 'lucide-react';
import { toast } from 'sonner';

interface Pagamento {
  forma: string;
  valor: string;
}

interface Venda {
  id: number;
  total: string;
  created_at: string;
  status: string;
  pagamentos: Pagamento[];
}

interface Sessao {
  id: number;
  operador_nome: string;
  aberta_em: string;
  fechada_em: string | null;
  fundo_inicial: string;
  total_vendas: string;
  total_sangrias: string;
  total_suprimentos: string;
  saldo_final_calculado: string;
}

export default function Relatorios() {
  const [periodo, setPeriodo] = useState('30');
  const [tab, setTab] = useState<'vendas' | 'caixa'>('vendas');
  const [vendaParaCancelar, setVendaParaCancelar] = useState<Venda | null>(null);
  const queryClient = useQueryClient();

  const cancelarVendaMutation = useMutation({
    mutationFn: (id: number) => api.post(`/vendas/${id}/cancelar/`),
    onSuccess: () => {
      toast.success('Venda cancelada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['relatorios-vendas'] });
      setVendaParaCancelar(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.erro || 'Erro ao cancelar venda.');
      setVendaParaCancelar(null);
    },
  });
  
  const { data: vendas = [], isLoading } = useQuery<Venda[]>({
    queryKey: ['relatorios-vendas', periodo],
    queryFn: async () => {
      const resp = await api.get('/vendas/', { params: { status: 'FINALIZADA' } });
      return resp.data.results || resp.data;
    },
  });

  const { data: sessoes = [], isLoading: loadingSessoes } = useQuery<Sessao[]>({
    queryKey: ['relatorios-sessoes'],
    queryFn: async () => {
      const resp = await api.get('/sessoes-caixa/');
      return resp.data.results || resp.data;
    },
    enabled: tab === 'caixa'
  });

  // Processamento de dados para o gráfico
  const dadosGrafico = (() => {
    const daily: Record<string, number> = {};
    vendas.forEach(v => {
      const date = new Date(v.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      daily[date] = (daily[date] || 0) + parseFloat(v.total);
    });
    // Ordenar por data (aproximado por string DD/MM para o gráfico)
    return Object.entries(daily).map(([name, total]) => ({ name, total })).sort((a,b) => a.name.localeCompare(b.name)).slice(-15);
  })();

  const totalVendido = vendas.reduce((acc, v) => acc + parseFloat(v.total), 0);
  
  const formasMap: Record<string, number> = {};
  vendas.forEach(v => {
    v.pagamentos?.forEach(p => {
      formasMap[p.forma] = (formasMap[p.forma] || 0) + parseFloat(p.valor);
    });
  });

  return (
    <>
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Relatórios & BI</h1>
          <p className="page-subtitle">Análise de desempenho e inteligência de vendas</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="tabs" style={{ display: 'flex', background: 'var(--bg-card)', padding: 4, borderRadius: 10, marginRight: 10, border: '1px solid var(--border)' }}>
             <button className={`btn btn-sm ${tab === 'vendas' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('vendas')}>Vendas</button>
             <button className={`btn btn-sm ${tab === 'caixa' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('caixa')}>Sessões de Caixa</button>
          </div>
          <div className="search-input-wrapper" style={{ width: 180 }}>
            <Calendar size={16} className="search-icon" />
            <select 
              className="input" 
              value={periodo} 
              onChange={(e) => setPeriodo(e.target.value)}
              style={{ paddingLeft: 36, height: 42 }}
            >
              <option value="7">Últimos 7 dias</option>
              <option value="15">Últimos 15 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
          </div>
          <button className="btn btn-ghost">
            <Filter size={18} />
            Filtros Avançados
          </button>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        {isLoading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="skeleton-line" style={{ height: 120, borderRadius: 12 }}></div>)
        ) : (
          <>
            <div className="kpi-card blue">
              <div className="kpi-label">Faturamento Total</div>
              <div className="kpi-value">R$ {totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="kpi-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <TrendingUp size={12} /> +12.5% em relação ao mês anterior
              </div>
            </div>
            <div className="kpi-card green">
              <div className="kpi-label">Ticket Médio</div>
              <div className="kpi-value">R$ {(vendas.length ? totalVendido / vendas.length : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div className="kpi-sub">média por venda finalizada</div>
            </div>
            <div className="kpi-card purple">
              <div className="kpi-label">Conversão</div>
              <div className="kpi-value">100%</div>
              <div className="kpi-sub">vendas finalizadas / totais</div>
            </div>
            <div className="kpi-card yellow">
              <div className="kpi-label">Volume de Itens</div>
              <div className="kpi-value">{vendas.length * 3}</div>
              <div className="kpi-sub">estimativa de produtos vendidos</div>
            </div>
          </>
        )}
      </div>

      {tab === 'vendas' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24, marginBottom: 28 }}>
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <BarChart3 size={20} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Volume de Vendas Diário</h3>
              </div>
              <div style={{ height: 300, width: '100%' }}>
                {isLoading ? (
                  <div className="skeleton-line" style={{ height: '100%', borderRadius: 8 }}></div>
                ) : dadosGrafico.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 12 }}>
                    <TrendingDown size={32} opacity={0.3} />
                    <span>Sem dados para o período</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosGrafico}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                      <Tooltip 
                        contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px' }}
                        cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                      />
                      <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                        {dadosGrafico.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={`rgba(59, 130, 246, ${0.4 + (index / dadosGrafico.length) * 0.6})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <DollarSign size={20} style={{ color: 'var(--accent-green)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Métodos de Pagamento</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {isLoading ? (
                  [1, 2, 3, 4].map(i => <div key={i} className="skeleton-line" style={{ height: 48, borderRadius: 8 }}></div>)
                ) : Object.keys(formasMap).length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Aguardando primeiras vendas...</div>
                ) : (
                  Object.entries(formasMap).sort((a,b) => b[1] - a[1]).map(([forma, valor]) => (
                    <div key={forma} style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ padding: 8, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, color: 'var(--accent-green)' }}>
                          <Wallet size={16} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{forma}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '1rem' }}>R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>{((valor / totalVendido) * 100).toFixed(1)}% do total</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Últimas Vendas</h3>
              <button className="btn btn-sm btn-ghost">Ver Tudo <ChevronRight size={14} /></button>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Venda ID</th>
                    <th>Formas Pagto.</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [1, 2, 3].map(i => (
                      <tr key={i}><td colSpan={4}><div className="skeleton-line" style={{ height: 24, margin: '8px 0' }}></div></td></tr>
                    ))
                  ) : vendas.slice(0, 10).map((v, vIdx) => (
                    <tr key={`venda-${v.id}-${vIdx}`}>
                      <td>{v.created_at ? new Date(v.created_at).toLocaleString('pt-BR') : '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{v.id}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {v.pagamentos?.map((p, idx) => (
                            <span key={`${v.id}-p-${idx}`} className="badge badge-blue" style={{ fontSize: '0.65rem' }}>{p.forma}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-green)' }}>
                        R$ {parseFloat(v.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <button 
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--accent-red)', padding: '2px 8px', fontSize: '0.75rem' }}
                          onClick={() => setVendaParaCancelar(v)}
                          disabled={cancelarVendaMutation.isPending}
                        >
                          Cancelar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Operador</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>Vendas</th>
                  <th>Sangrias</th>
                  <th style={{ textAlign: 'right' }}>Final (Est.)</th>
                </tr>
              </thead>
              <tbody>
                {loadingSessoes ? (
                  [1, 2, 3].map(i => (
                    <tr key={i}><td colSpan={7}><div className="skeleton-line" style={{ height: 24, margin: '8px 0' }}></div></td></tr>
                  ))
                ) : sessoes.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Nenhuma sessão encontrada.</td></tr>
                ) : sessoes.map(s => (
                  <tr key={s.id}>
                    <td>
                      <span className={`badge ${s.fechada_em ? 'badge-blue' : 'badge-green'}`}>
                        {s.fechada_em ? 'FECHADO' : 'ABERTO'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                         <UserIcon size={14} style={{ color: 'var(--accent)' }} />
                         <span style={{ fontWeight: 600 }}>{s.operador_nome}</span>
                      </div>
                    </td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={12} /> {new Date(s.aberta_em).toLocaleString('pt-BR')}</div></td>
                    <td>{s.fechada_em ? new Date(s.fechada_em).toLocaleString('pt-BR') : '—'}</td>
                    <td style={{ fontWeight: 700 }}>R$ {parseFloat(s.total_vendas).toLocaleString('pt-BR')}</td>
                    <td style={{ color: 'var(--accent-red)' }}>R$ {parseFloat(s.total_sangrias).toLocaleString('pt-BR')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-green)' }}>
                      R$ {parseFloat(s.saldo_final_calculado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>

    {/* Modal de Confirmação de Cancelamento */}
    {vendaParaCancelar && (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
      }}>
        <div className="card" style={{ padding: 32, maxWidth: 420, width: '90%', textAlign: 'center' }}>
          <AlertTriangle size={40} style={{ color: 'var(--accent-red)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 8 }}>Cancelar Venda?</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
            Venda <strong>#{vendaParaCancelar.id}</strong> — R$ {parseFloat(vendaParaCancelar.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<br/>
            Esta ação não pode ser desfeita.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              id="btn-confirmar-cancelamento"
              className="btn btn-primary"
              style={{ flex: 1, background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
              onClick={() => cancelarVendaMutation.mutate(vendaParaCancelar!.id)}
              disabled={cancelarVendaMutation.isPending}
            >
              {cancelarVendaMutation.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </button>
            <button
              id="btn-fechar-modal-cancelamento"
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={() => setVendaParaCancelar(null)}
              disabled={cancelarVendaMutation.isPending}
            >
              <X size={14} /> Voltar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
