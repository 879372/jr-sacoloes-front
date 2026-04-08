import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import ClienteModal from './ClienteModal';
import { 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Edit3, 
  ToggleLeft, 
  ToggleRight,
  User,
  Phone,
  CreditCard,
  MapPin
} from 'lucide-react';

interface Cliente {
  id: string;
  nome: string;
  razao_social: string;
  cpf_cnpj: string;
  telefone: string;
  email: string;
  pessoa: 'F' | 'J';
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  ativo: boolean;
  codigo_legado?: string;
}

interface ApiResponse {
  count: number;
  results: Cliente[];
}

export default function Clientes() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  // Fetch Clientes with React Query
  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ['clientes', search, page],
    queryFn: async () => {
      const resp = await api.get('/clientes/', { params: { search, page } });
      return resp.data;
    },
  });

  // Toggle Active Status Mutation
  const toggleMutation = useMutation({
    mutationFn: async (cliente: Cliente) => {
      return api.patch(`/clientes/${cliente.id}/`, { ativo: !cliente.ativo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });

  const handleEdit = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setShowModal(true);
  };

  const handleNew = () => {
    setSelectedCliente(null);
    setShowModal(true);
  };

  const handleToggle = (cliente: Cliente) => {
    if (confirm(`Deseja realmente ${cliente.ativo ? 'desativar' : 'ativar'} o cliente ${cliente.nome}?`)) {
      toggleMutation.mutate(cliente);
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Gestão de Clientes</h1>
          <p className="page-subtitle">
            {isLoading ? 'Carregando total...' : `${data?.count.toLocaleString('pt-BR')} registros na base`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>
          <Plus size={18} />
          Novo Cliente
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <div className="search-input-wrapper" style={{ maxWidth: '400px' }}>
            <Search size={18} className="search-icon" />
            <input
              className="input"
              placeholder="Buscar por nome, CPF/CNPJ ou código..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Cliente / Razão Social</th><th>CPF/CNPJ</th><th>Cidade/UF</th><th>Telefone</th><th>Status</th><th style={{ textAlign: 'right' }}>Ações</th></tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td colSpan={6}><div className="skeleton-line" style={{ height: 24, margin: '8px 0', borderRadius: 4 }}></div></td>
                  </tr>
                ))
              ) : (
                data?.results.map((c) => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.codigo_legado || '—'}</td>
                    <td>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.nome}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.pessoa === 'F' ? 'Pessoa Física' : 'Pessoa Jurídica'}</div>
                    </td>
                    <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                            <CreditCard size={12} className="text-muted" />
                            <span style={{ fontFamily: 'monospace' }}>{c.cpf_cnpj || '—'}</span>
                        </div>
                    </td>
                    <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                            <Phone size={12} className="text-muted" />
                            <span>{c.telefone || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            <MapPin size={10} />
                            <span>{[c.cidade, c.uf].filter(Boolean).join('/') || 'N/D'}</span>
                        </div>
                    </td>
                    <td>
                      <span className={`badge ${c.ativo ? 'badge-green' : 'badge-red'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }}></div>
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(c)} title="Editar">
                          <Edit3 size={14} />
                        </button>
                        <button 
                          className="btn btn-sm btn-ghost" 
                          onClick={() => handleToggle(c)} 
                          style={{ color: c.ativo ? 'var(--accent-red)' : 'var(--accent-green)' }}
                          title={c.ativo ? 'Desativar' : 'Ativar'}
                        >
                          {c.ativo ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {!isLoading && data && data.count > 50 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={16} />
              Anterior
            </button>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>Página {page}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setPage(p => p + 1)} disabled={page * 50 >= data.count}>
              Próxima
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <ClienteModal 
          cliente={selectedCliente} 
          onClose={() => setShowModal(false)} 
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['clientes'] })} 
        />
      )}
    </div>
  );
}
