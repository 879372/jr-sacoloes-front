import { Check } from 'lucide-react';

interface Conta {
  id: string;
  descricao: string;
  valor: string;
  vencimento: string;
  status: string;
  fornecedor?: string;
  cliente_nome?: string;
}

interface FinanceiroColumnProps {
  titulo: string;
  Icon: React.ReactNode;
  cor: string;
  itens: Conta[];
  onBaixar: (conta: Conta) => void;
  isActiveMobile: boolean;
}

export default function FinanceiroColumn({ titulo, Icon, cor, itens, onBaixar, isActiveMobile }: FinanceiroColumnProps) {
  return (
    <div className={`financeiro-col ${isActiveMobile ? 'active' : ''}`} style={{ flex: 1, minWidth: 280 }}>
      {/* Estilos específicos via classes injetadas para mobile */}
      <style>{`
        @media (max-width: 768px) {
          .financeiro-col { display: none; }
          .financeiro-col.active { display: block; width: 100% !important; min-width: 100% !important; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: `2px solid ${cor}` }}>
        <span style={{ fontSize: '1.2rem', color: cor }}>{Icon}</span>
        <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: 0.5, textTransform: 'uppercase' }}>{titulo}</span>
        <span style={{ marginLeft: 'auto', background: `${cor}22`, color: cor, borderRadius: 8, padding: '2px 12px', fontSize: '0.75rem', fontWeight: 800 }}>{itens.length}</span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {itens.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: 40, background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed var(--border)' }}>
            Nenhum lançamento
          </div>
        )}
        {itens.map(c => (
          <div key={c.id} className="card animate-in" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: cor }}></div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 4 }}>{c.descricao}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{c.fornecedor || c.cliente_nome || 'Sem identificação'}</span>
              <span>•</span>
              <span>{new Date(c.vencimento).toLocaleDateString('pt-BR')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ 
                fontWeight: 800, 
                color: 'var(--accent-green)', 
                fontSize: '1.15rem', 
                letterSpacing: -0.5 
              }}>
                R$ {parseFloat(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              {(c.status === 'PENDENTE' || c.status === 'VENCIDO') && (
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => onBaixar(c)}
                  style={{ gap: 4, height: 32 }}
                >
                  <Check size={14} />
                  Baixar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
