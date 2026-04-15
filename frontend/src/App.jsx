import React, { useEffect, useMemo, useState } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000/api').replace(/\/$/, '');
const emptyAuth = { token: '', user: null };
const VEHICLE_DATA = {
  Chevrolet: ['Agile', 'Astra', 'Blazer', 'Bolt', 'Camaro', 'Celta', 'Classic', 'Cobalt', 'Corsa', 'Cruze', 'Equinox', 'Joy', 'Kadett', 'Meriva', 'Montana', 'Onix', 'Onix Plus', 'Omega', 'Prisma', 'S10', 'Silverado', 'Sonic', 'Spin', 'Tracker', 'Trailblazer', 'Vectra', 'Zafira'],
  Citroen: ['Aircross', 'Basalt', 'Berlingo', 'C3', 'C3 Aircross', 'C4', 'C4 Cactus', 'C4 Lounge', 'C5', 'Jumpy'],
  Fiat: ['147', '500', 'Argo', 'Bravo', 'Cronos', 'Doblo', 'Fastback', 'Fiorino', 'Freemont', 'Grand Siena', 'Idea', 'Linea', 'Marea', 'Mobi', 'Palio', 'Punto', 'Pulse', 'Siena', 'Strada', 'Tempra', 'Tipo', 'Toro', 'Uno'],
  Ford: ['Belina', 'Bronco', 'Courier', 'Del Rey', 'EcoSport', 'Edge', 'Escort', 'Expedition', 'F-1000', 'Fiesta', 'Focus', 'Fusion', 'Ka', 'Maverick', 'Mustang', 'Pampa', 'Ranger', 'Territory', 'Versailles'],
  GWM: ['Haval H6', 'Ora 03'],
  Honda: ['Accord', 'City', 'Civic', 'CR-V', 'Fit', 'HR-V', 'WR-V'],
  Hyundai: ['Azera', 'Creta', 'Elantra', 'HB20', 'HB20S', 'HR', 'Santa Fe', 'Tucson', 'Veloster', 'Veracruz', 'ix35'],
  Jeep: ['Cherokee', 'Commander', 'Compass', 'Gladiator', 'Grand Cherokee', 'Renegade', 'Wrangler'],
  Kia: ['Bongo', 'Cerato', 'Mohave', 'Picanto', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Stonic'],
  Mitsubishi: ['ASX', 'Eclipse Cross', 'L200', 'Lancer', 'Outlander', 'Pajero', 'Pajero Dakar', 'Pajero Full', 'Pajero TR4'],
  Nissan: ['Frontier', 'Kicks', 'Leaf', 'Livina', 'March', 'Sentra', 'Tiida', 'Versa', 'X-Trail'],
  Peugeot: ['2008', '206', '207', '208', '3008', '307', '308', '408', 'Boxer', 'Expert', 'Hoggar', 'Partner'],
  Ram: ['1500', '2500', '3500', 'Rampage'],
  Renault: ['Captur', 'Clio', 'Duster', 'Fluence', 'Kardian', 'Kwid', 'Laguna', 'Logan', 'Master', 'Megane', 'Oroch', 'Sandero', 'Scenic', 'Symbol'],
  Toyota: ['Bandeirante', 'Camry', 'Corolla', 'Corolla Cross', 'Etios', 'Fielder', 'Hilux', 'Prius', 'RAV4', 'SW4', 'Yaris'],
  Volkswagen: ['Amarok', 'Brasilia', 'CrossFox', 'Fox', 'Fusca', 'Gol', 'Golf', 'Jetta', 'Kombi', 'Nivus', 'Parati', 'Passat', 'Polo', 'Santana', 'Saveiro', 'SpaceFox', 'T-Cross', 'Taos', 'Tiguan', 'Up', 'Voyage'],
  Volvo: ['C30', 'S60', 'S90', 'XC40', 'XC60', 'XC90'],
  BYD: ['Dolphin', 'Dolphin Mini', 'Han', 'Seal', 'Song Plus', 'Yuan Plus'],
};
const BRANDS = Object.keys(VEHICLE_DATA);
const COLORS = ['Branco', 'Preto', 'Prata', 'Cinza', 'Vermelho', 'Azul', 'Verde', 'Marrom', 'Bege', 'Amarelo'];
const FUELS = ['Flex', 'Gasolina', 'Etanol', 'Diesel', 'Elétrico', 'Híbrido', 'GNV'];
const TRANSMISSIONS = ['Manual', 'Automático', 'CVT', 'Automatizado'];
const SORT_OPTIONS = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'year_desc', label: 'Ano mais novo' },
  { value: 'km_asc', label: 'Menor KM' },
];

const listingInitial = {
  title: '', description: '', price: '', brand: '', model: '', year: '', km: '',
  transmission: '', fuel: '', color: '', city: '', neighborhood: '', phone: '', images: []
};

function currency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

function buildWhatsAppUrl(phone, title = '') {
  const digits = normalizePhone(phone);
  const text = encodeURIComponent('Olá vi seu anuncio no Local Marktplace e gostaria de mais informações !');
  return digits ? `https://wa.me/${digits}?text=${text}` : '#';
}

function formatSubscriptionStatus(status = '') {
  const labels = {
    PENDING_PAYMENT: 'Upgrade aguardando pagamento',
    PAYMENT_CONFIRMED: 'Pagamento confirmado',
    ACTIVATING: 'Ativando plano',
    ACTIVE: 'Plano ativo',
    PAST_DUE: 'Pagamento em atraso',
    EXPIRED: 'Assinatura expirada',
    CANCELLED: 'Assinatura cancelada',
    SUPERSEDED: 'Plano anterior encerrado',
  };
  return labels[status] || (status || 'Sem assinatura');
}

function formatPaymentStatus(status = '') {
  const labels = {
    PENDING: 'Aguardando confirmação do pagamento',
    PAID: 'Pagamento aprovado',
    CANCELLED: 'Pagamento cancelado',
    EXPIRED: 'Pix expirado',
    REJECTED: 'Pagamento recusado',
  };
  return labels[status] || status || 'Pendente';
}

function planBenefits(plan) {
  return String(plan?.benefits || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCurrentPlanSlug(subscription) {
  return subscription?.plan?.slug || '';
}

function getUpgradePlans(plans = [], subscription) {
  const currentSlug = getCurrentPlanSlug(subscription);
  if (currentSlug === 'particular') return plans.filter((plan) => plan.slug !== 'particular');
  return plans.filter((plan) => plan.slug !== currentSlug && plan.slug !== 'particular');
}

function getListingAllowanceLabel(subscription) {
  const limit = subscription?.plan?.listingLimit ?? 2;
  return `${limit} anúncio(s) incluído(s)`;
}

function getRemainingListingSlots(subscription, listingsCount = 0) {
  const limit = subscription?.plan?.listingLimit ?? 2;
  return Math.max(limit - listingsCount, 0);
}

function formatDate(dateValue) {
  if (!dateValue) return 'Sem data definida';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Sem data definida';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

const storeProfileInitial = {
  storeName: '', storeLogoUrl: '', storeBannerUrl: '', storeDescription: '',
  storeCity: '', storeNeighborhood: '', storeWhatsapp: '', storeInstagram: '', storeWebsite: '', storeIsActive: true
};

async function api(path, options = {}, token = '') {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Erro na requisição.');
  return data;
}

function getPrimaryImage(images = []) {
  return images.find((img) => img.isPrimary) || images[0] || null;
}

function readFilesAsDataUrl(files) {
  return Promise.all(
    Array.from(files).map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ imageUrl: reader.result, fileName: file.name, isPrimary: false });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }))
  );
}

async function reverseGeocode(latitude, longitude) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Não foi possível consultar a localização.');
  const data = await response.json();
  const address = data.address || {};
  return {
    city: address.city || address.town || address.municipality || address.village || '',
    neighborhood: address.suburb || address.neighbourhood || address.city_district || address.county || '',
  };
}

function Header({ auth, onLogout, currentView, setCurrentView }) {
  return (
    <header className="topbar">
      <div>
        <h1>Local Marktplace</h1>
        <p>Compre e anuncie veículos com uma experiência local mais direta e comercial.</p>
      </div>
      <nav className="topnav">
        <button className={currentView === 'home' ? 'active' : ''} onClick={() => setCurrentView('home')}>Anúncios</button>
        <button className={currentView === 'lojas' ? 'active' : ''} onClick={() => setCurrentView('lojas')}>Lojas</button>
        <button className={currentView === 'planos' ? 'active' : ''} onClick={() => setCurrentView('planos')}>Planos</button>
        {auth.user && <button className={currentView === 'dashboard' ? 'active' : ''} onClick={() => setCurrentView('dashboard')}>Meu painel</button>}
        {auth.user?.role === 'ADMIN' && <button className={currentView === 'admin' ? 'active' : ''} onClick={() => setCurrentView('admin')}>Admin</button>}
        {auth.user ? (
          <button className="ghost" onClick={onLogout}>Sair</button>
        ) : (
          <button className={currentView === 'auth' ? 'active' : ''} onClick={() => setCurrentView('auth')}>Entrar / Cadastrar</button>
        )}
      </nav>
    </header>
  );
}

function Hero({ listingsCount, onOpenAuth, setCurrentView }) {
  return (
    <section className="hero card">
      <div>
        <span className="eyebrow">Classificados automotivos da sua região</span>
        <h2>Compre e anuncie diretamente na sua cidade.</h2>
        <p>
          Busca simples, fotos organizadas, contato direto por WhatsApp e uma experiência local mais objetiva para acelerar a negociação.
        </p>
        <div className="actions-row wrap">
          <button onClick={() => setCurrentView('dashboard')}>Publicar anúncio</button>
          <button className="ghost" onClick={onOpenAuth}>Entrar para anunciar</button>
          <button className="ghost" onClick={() => setCurrentView('planos')}>Ver planos comerciais</button>
        </div>
      </div>
      <div className="hero-stats">
        <div><strong>{listingsCount}</strong><span>Anúncios aprovados</span></div>
        <div><strong>15</strong><span>Fotos por anúncio</span></div>
        <div><strong>1 clique</strong><span>Contato por WhatsApp</span></div>
      </div>
    </section>
  );
}

function AuthPanel({ onAuthSuccess }) {
  const initialMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('token') ? 'reset' : 'login';
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', resetPassword: '', resetPasswordConfirm: '', token: typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('token') || '') : '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (mode === 'register') {
        await api('/auth/register', { method: 'POST', body: JSON.stringify(form) });
        setMode('login');
        setMessage('Cadastro concluído. Agora faça o login.');
      } else if (mode === 'forgot') {
        const data = await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: form.email }) });
        setMessage(data.message || 'Se o e-mail existir, enviamos o link de recuperação.');
      } else if (mode === 'reset') {
        if (form.resetPassword !== form.resetPasswordConfirm) throw new Error('As senhas não conferem.');
        const data = await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: form.token, password: form.resetPassword }) });
        setMode('login');
        setForm({ ...form, password: '', resetPassword: '', resetPasswordConfirm: '', token: '' });
        if (typeof window !== 'undefined') window.history.replaceState({}, '', window.location.pathname);
        setMessage(data.message || 'Senha atualizada com sucesso. Faça o login.');
      } else {
        const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: form.email, password: form.password }) });
        onAuthSuccess(data);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card auth-card">
      <div className="tabs">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
        <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Cadastro</button>
        <button className={mode === 'forgot' ? 'active' : ''} onClick={() => setMode('forgot')}>Recuperar senha</button>
      </div>
      <form onSubmit={handleSubmit} className="grid-form">
        {mode === 'register' && <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        {mode === 'register' && <input placeholder="Telefone / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}
        {(mode === 'login' || mode === 'register' || mode === 'forgot') && <input placeholder="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
        {mode === 'login' && <input placeholder="Senha" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
        {mode === 'reset' && <input placeholder="Token de recuperação" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} />}
        {mode === 'reset' && <input placeholder="Nova senha" type="password" value={form.resetPassword} onChange={(e) => setForm({ ...form, resetPassword: e.target.value })} />}
        {mode === 'reset' && <input placeholder="Confirmar nova senha" type="password" value={form.resetPasswordConfirm} onChange={(e) => setForm({ ...form, resetPasswordConfirm: e.target.value })} />}
        <button type="submit" disabled={loading}>{loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Cadastrar' : mode === 'forgot' ? 'Enviar link' : 'Redefinir senha'}</button>
      </form>
      {mode === 'login' && <button className="link-button" onClick={() => setMode('forgot')}>Esqueci minha senha</button>}
      {message && <p className="message">{message}</p>}
    </section>
  );
}

function VehicleFieldSelect({ label, value, onChange, options }) {
  return (
    <label className="field-group">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Filters({ filters, setFilters, onRefresh, total }) {
  const modelOptions = filters.brand ? (VEHICLE_DATA[filters.brand] || []) : [];
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilters({ q: '', brand: '', model: '', sortBy: 'recent' });

  return (
    <section className="card filters compact-filters">
      <div className="section-title compact">
        <div>
          <h2>Busque seu veículo</h2>
          <p>{total} anúncio(s) encontrado(s).</p>
        </div>
        <div className="actions-row wrap">
          <button className="ghost" onClick={clearFilters}>Limpar</button>
          <button onClick={onRefresh}>Atualizar</button>
        </div>
      </div>
      <div className="grid four">
        <input placeholder="Pesquisar por veículo, marca ou cidade" value={filters.q} onChange={(e) => update('q', e.target.value)} />
        <label className="field-group"><span>Marca</span><select value={filters.brand} onChange={(e) => setFilters((prev) => ({ ...prev, brand: e.target.value, model: '' }))}><option value="">Todas</option>{BRANDS.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select></label>
        <label className="field-group"><span>Modelo</span><select value={filters.model} onChange={(e) => update('model', e.target.value)} disabled={!filters.brand}><option value="">Todos</option>{modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
        <label className="field-group"><span>Ordenar por</span><select value={filters.sortBy} onChange={(e) => update('sortBy', e.target.value)}>{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
    </section>
  );
}

function ListingCard({ listing, auth, onOpen, onToggleFavorite }) {
  const primary = getPrimaryImage(listing.images);
  const whatsappUrl = buildWhatsAppUrl(listing.phone, listing.title);
  return (
    <article className="listing-card card">
      <div className="thumb-wrap">
        <img src={primary?.imageUrl || 'https://via.placeholder.com/800x500?text=Sem+imagem'} alt={listing.title} className="thumb" />
        <div className="pill-stack"><span className={`status-pill ${(listing.status || 'APPROVED').toLowerCase()}`}>{listing.status}</span>{listing.isFeatured && <span className="status-pill featured">DESTAQUE</span>}</div>
      </div>
      <div className="listing-body">
        <div>
          <h3>{listing.title}</h3>
          <p>{listing.brand} {listing.model} • {listing.year} • {listing.km} km</p>
          <p>{listing.city} / {listing.neighborhood}</p>
        </div>
        <strong>{currency(listing.price)}</strong>
        <div className="chip-row">
          <span>{listing.fuel || 'Combustível não informado'}</span>
          <span>{listing.transmission || 'Câmbio não informado'}</span>
          <span>{listing.color || 'Cor não informada'}</span>
        </div>
        <div className="actions-row wrap">
          <button onClick={() => onOpen(listing)}>Ver detalhes</button>
          {listing.phone && <a className="button-link success" href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>}
          {auth.user && (
            <button className="ghost" onClick={() => onToggleFavorite(listing)}>
              {listing.isFavorite ? 'Desfavoritar' : 'Favoritar'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ListingGrid({ listings, auth, onOpen, onToggleFavorite }) {
  if (!listings.length) return <section className="card empty">Nenhum anúncio encontrado com esses filtros.</section>;
  return (
    <section className="listing-grid">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} auth={auth} onOpen={onOpen} onToggleFavorite={onToggleFavorite} />
      ))}
    </section>
  );
}

function Gallery({ images, title }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => {
    const primaryIndex = Math.max(images.findIndex((img) => img.isPrimary), 0);
    setCurrentIndex(primaryIndex);
  }, [images]);

  const current = images[currentIndex] || images[0];
  const goPrev = () => setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  const goNext = () => setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));

  return (
    <div className="modal-gallery">
      {current && (
        <div className="gallery-stage">
          <img src={current.imageUrl} alt={title} className="hero-image" />
          {images.length > 1 && (
            <>
              <button className="gallery-nav left" onClick={goPrev} type="button">‹</button>
              <button className="gallery-nav right" onClick={goNext} type="button">›</button>
              <span className="gallery-counter">{currentIndex + 1} de {images.length}</span>
            </>
          )}
        </div>
      )}
      <div className="thumb-list">
        {images.map((image, index) => (
          <button key={image.id || `${image.imageUrl.slice(0, 20)}-${index}`} type="button" className={`thumb-button ${index === currentIndex ? 'selected' : ''}`} onClick={() => setCurrentIndex(index)}>
            <img src={image.imageUrl} alt={`Foto ${index + 1}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailModal({ listing, auth, onClose, onToggleFavorite, refresh, relatedListings, openListing }) {
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', message: `Olá! Tenho interesse no veículo ${listing.title}.` });
  const [leadMessage, setLeadMessage] = useState('');
  const whatsappUrl = buildWhatsAppUrl(listing.phone, listing.title);

  const sendLead = async (e) => {
    e.preventDefault();
    try {
      await api(`/listings/${listing.id}/lead`, { method: 'POST', body: JSON.stringify(leadForm) }, auth.token);
      setLeadMessage('Interesse enviado. O anunciante verá esse lead direto no painel dele.');
      setLeadForm({ name: '', phone: '', message: `Olá! Tenho interesse no veículo ${listing.title}.` });
      refresh();
    } catch (error) {
      setLeadMessage(error.message);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{listing.title}</h2>
            <p>{listing.brand} {listing.model} • {listing.year} • {currency(listing.price)}</p>
          </div>
          <button className="ghost" onClick={onClose}>Fechar</button>
        </div>

        <Gallery images={listing.images} title={listing.title} />

        <div className="grid two detail-grid">
          <div>
            <p>{listing.description}</p>
            <ul className="detail-list">
              <li><strong>Anunciante:</strong> {listing.user?.companyName || listing.user?.name || 'Vendedor'}</li>
              <li><strong>Cidade:</strong> {listing.city}</li>
              <li><strong>Bairro:</strong> {listing.neighborhood}</li>
              <li><strong>Câmbio:</strong> {listing.transmission}</li>
              <li><strong>Combustível:</strong> {listing.fuel}</li>
              <li><strong>Cor:</strong> {listing.color}</li>
              <li><strong>KM:</strong> {listing.km}</li>
              <li><strong>WhatsApp:</strong> {listing.phone}</li>
            </ul>
            <div className="actions-row wrap">
              <a className="button-link success" href={whatsappUrl} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
              {auth.user && (
                <>
                  <button className="ghost" onClick={() => onToggleFavorite(listing)}>
                    {listing.isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                  </button>
                                  </>
              )}
            </div>
          </div>
          <form className="card lead-box" onSubmit={sendLead}>
            <h3>Enviar interesse ao anunciante</h3>
            <p className="subtle">O contato principal é por WhatsApp. Use o botão acima para falar direto com o anunciante.</p>
            <input placeholder="Seu nome" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} />
            <input placeholder="Seu telefone / WhatsApp" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
            <textarea placeholder="Mensagem" value={leadForm.message} onChange={(e) => setLeadForm({ ...leadForm, message: e.target.value })} rows={5} />
            <button type="submit">Enviar interesse</button>
            {leadMessage && <span className="message">{leadMessage}</span>}
          </form>
        </div>

        {!!relatedListings.length && (
          <section className="related-section">
            <div className="section-title compact">
              <div>
                <h3>Veículos relacionados</h3>
                <p>Mais opções da mesma marca ou cidade.</p>
              </div>
            </div>
            <div className="related-grid">
              {relatedListings.slice(0, 3).map((item) => (
                <button key={item.id} className="related-card" type="button" onClick={() => openListing(item)}>
                  <img src={getPrimaryImage(item.images)?.imageUrl} alt={item.title} />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{currency(item.price)} • {item.city}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ListingForm({ auth, editing, onSaved, onCancel }) {
  const [form, setForm] = useState(editing ? {
    ...editing,
    images: editing.images.map((img) => ({ imageUrl: img.imageUrl, isPrimary: img.isPrimary }))
  } : { ...listingInitial, phone: auth.user?.phone || '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoState, setGeoState] = useState({ loading: false, tried: false, message: '' });

  useEffect(() => {
    if (editing) {
      setForm({ ...editing, images: editing.images.map((img) => ({ imageUrl: img.imageUrl, isPrimary: img.isPrimary })) });
    } else {
      setForm({ ...listingInitial, phone: auth.user?.phone || '' });
    }
  }, [editing, auth.user]);

  const modelOptions = form.brand ? (VEHICLE_DATA[form.brand] || []) : [];
  const allowManualModel = !!form.brand;

  const detectLocation = async () => {
    if (!navigator.geolocation) {
      setGeoState({ loading: false, tried: true, message: 'Seu navegador não suporta geolocalização.' });
      return;
    }

    setGeoState({ loading: true, tried: true, message: 'Lendo localização do dispositivo...' });
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const data = await reverseGeocode(position.coords.latitude, position.coords.longitude);
        setForm((prev) => ({
          ...prev,
          city: prev.city || data.city,
          neighborhood: prev.neighborhood || data.neighborhood,
        }));
        setGeoState({ loading: false, tried: true, message: data.city ? `Localização sugerida: ${data.city}${data.neighborhood ? ` / ${data.neighborhood}` : ''}` : 'Localização obtida. Confira os campos abaixo.' });
      } catch (error) {
        setGeoState({ loading: false, tried: true, message: 'Peguei sua posição, mas não consegui preencher cidade e bairro automaticamente.' });
      }
    }, () => {
      setGeoState({ loading: false, tried: true, message: 'Permissão de localização negada. Você pode preencher cidade e bairro manualmente.' });
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  useEffect(() => {
    if (!editing && !form.city && !geoState.tried) detectLocation();
  }, [editing]);

  const addPhotos = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    if (form.images.length + files.length > 15) {
      setMessage('O limite é de 15 fotos por anúncio.');
      return;
    }
    const loaded = await readFilesAsDataUrl(files);
    setForm((prev) => {
      const next = [...prev.images, ...loaded];
      if (!next.some((img) => img.isPrimary) && next[0]) next[0].isPrimary = true;
      return { ...prev, images: next };
    });
    setMessage('');
    e.target.value = '';
  };

  const setPrimary = (index) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((img, i) => ({ ...img, isPrimary: i === index }))
    }));
  };

  const moveImage = (index, direction) => {
    setForm((prev) => {
      const next = [...prev.images];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, images: next };
    });
  };

  const removeImage = (index) => {
    setForm((prev) => {
      const next = prev.images.filter((_, i) => i !== index).map((img) => ({ ...img, isPrimary: false }));
      if (next.length) {
        const previousPrimary = prev.images[index]?.isPrimary;
        if (previousPrimary) next[0].isPrimary = true;
        else {
          const existingPrimary = next.findIndex((img) => img.isPrimary);
          if (existingPrimary === -1) next[0].isPrimary = true;
        }
      }
      return { ...prev, images: next };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const payload = { ...form, price: Number(form.price), year: Number(form.year), km: Number(form.km) };
      if (editing) await api(`/listings/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) }, auth.token);
      else await api('/listings', { method: 'POST', body: JSON.stringify(payload) }, auth.token);
      setMessage('Anúncio salvo com sucesso.');
      setForm({ ...listingInitial, phone: auth.user?.phone || '' });
      setGeoState({ loading: false, tried: false, message: '' });
      onSaved();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <div className="section-title">
        <div>
          <h2>{editing ? 'Editar anúncio' : 'Novo anúncio'}</h2>
          <p>Mais padronização, seleção de modelo por marca, foto principal e contato via WhatsApp.</p>
        </div>
        <div className="actions-row wrap">
          {!editing && <button type="button" className="ghost" onClick={detectLocation} disabled={geoState.loading}>{geoState.loading ? 'Localizando...' : 'Usar localização do dispositivo'}</button>}
          {editing && <button className="ghost" type="button" onClick={onCancel}>Cancelar edição</button>}
        </div>
      </div>
      {geoState.message && <p className="message">{geoState.message}</p>}
      <form className="grid-form" onSubmit={submit}>
        <div className="grid two">
          <input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input placeholder="Preço" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        <textarea placeholder="Descrição" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid three">
          <div className="field-group"><span>Marca</span><input list="brand-options" placeholder="Selecione ou digite a marca" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value, model: '' })} /><datalist id="brand-options">{BRANDS.map((brand) => <option key={brand} value={brand} />)}</datalist><small>Se não encontrar, digite manualmente.</small></div>
          <div className="field-group"><span>Modelo</span><input list="model-options" placeholder={allowManualModel ? 'Selecione ou digite o modelo' : 'Digite primeiro a marca'} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} disabled={!allowManualModel} /><datalist id="model-options">{modelOptions.map((model) => <option key={model} value={model} />)}</datalist><small>{allowManualModel ? 'Se não encontrar, digite manualmente.' : 'Escolha ou digite uma marca para liberar o modelo.'}</small></div>
          <label className="field-group"><span>Ano</span><input placeholder="Ex.: 2021" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label>
          <label className="field-group"><span>KM</span><input placeholder="Ex.: 35000" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} /></label>
          <VehicleFieldSelect label="Câmbio" value={form.transmission} onChange={(value) => setForm({ ...form, transmission: value })} options={TRANSMISSIONS} />
          <VehicleFieldSelect label="Combustível" value={form.fuel} onChange={(value) => setForm({ ...form, fuel: value })} options={FUELS} />
          <VehicleFieldSelect label="Cor" value={form.color} onChange={(value) => setForm({ ...form, color: value })} options={COLORS} />
          <label className="field-group"><span>Cidade</span><input placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          <label className="field-group"><span>Bairro</span><input placeholder="Bairro" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} /></label>
        </div>
        <label className="field-group">
          <span>WhatsApp principal</span>
          <input placeholder="Telefone / WhatsApp para contato" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <div className="card upload-box">
          <label className="upload-label">
            <span>Adicionar fotos do dispositivo</span>
            <input type="file" accept="image/*" multiple onChange={addPhotos} />
          </label>
          <small>JPG, PNG ou WEBP. Máximo de 15 fotos. Você pode escolher a principal e reorganizar a ordem.</small>
          <div className="image-preview-grid">
            {form.images.map((img, index) => (
              <div key={`${img.imageUrl.slice(0, 30)}-${index}`} className={`preview-card ${img.isPrimary ? 'primary' : ''}`}>
                <img src={img.imageUrl} alt={`Foto ${index + 1}`} />
                <div className="preview-actions">
                  <button type="button" onClick={() => setPrimary(index)}>{img.isPrimary ? 'Foto principal' : 'Definir principal'}</button>
                  <div className="actions-row wrap">
                    <button type="button" className="ghost" onClick={() => moveImage(index, 'up')}>↑</button>
                    <button type="button" className="ghost" onClick={() => moveImage(index, 'down')}>↓</button>
                    <button type="button" className="ghost" onClick={() => removeImage(index)}>Remover</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar anúncio'}</button>
        {message && <p className="message">{message}</p>}
      </form>
    </section>
  );
}

function Dashboard({ auth, listings, favorites, leads, subscription, plans, payments, checkoutState, paymentConfig, myStore, onSaveStore, onRefresh, onEdit, onOpen, onDelete, onToggleFavorite, onLeadStatusChange, onSubscribe, onFeatureListing, onRefreshPayment, onOpenPlans, onOpenStore }) {
  const upgradePlans = getUpgradePlans(plans, subscription);
  const isParticular = getCurrentPlanSlug(subscription) === 'particular' || !subscription;
  const canManageStore = ['lojista', 'premium'].includes(getCurrentPlanSlug(subscription));
  const [storeForm, setStoreForm] = useState(storeProfileInitial);

  useEffect(() => {
    if (myStore?.profile) setStoreForm({ ...storeProfileInitial, ...myStore.profile });
  }, [myStore]);

  const loadStoreImage = async (field, files) => {
    if (!files?.length) return;
    const [loaded] = await readFilesAsDataUrl(files);
    if (loaded?.imageUrl) setStoreForm((prev) => ({ ...prev, [field]: loaded.imageUrl }));
  };

  return (
    <div className="dashboard-grid">
      <div className="dashboard-top-grid">
        <section className="card metric-card">
          <span>Olá, {auth.user.name}</span>
          <strong>{favorites.length}</strong>
          <small>Favoritos salvos</small>
        </section>

        <section className="card metric-card compact-metric">
          <span>Plano atual</span>
          <strong>{subscription?.plan?.name || 'Particular'}</strong>
          <small>{formatSubscriptionStatus(subscription?.status)} • {getListingAllowanceLabel(subscription)} • expira em {formatDate(subscription?.expiresAt)}</small>
        </section>
        <section className="card metric-card compact-metric">
          <span>Leads recebidos</span>
          <strong>{leads.length}</strong>
          <small>Contatos diretos para o anunciante</small>
        </section>
      </div>
      <section className="card">
        <div className="section-title">
          <div>
            <h2>Meus anúncios</h2>
            <p>Acompanhe status e atualize seus veículos.</p>
          </div>
          <button className="ghost" onClick={onRefresh}>Atualizar</button>
        </div>
        <div className="table-like">
          {listings.map((listing) => (
            <div key={listing.id} className="table-row">
              <div>
                <strong>{listing.title}</strong>
                <span>{currency(listing.price)} • {listing.status} • {listing.city}</span>
              </div>
              <div className="actions-row wrap">
                <button onClick={() => onOpen(listing)}>Ver</button>
                <button onClick={() => onEdit(listing)}>Editar</button>
                <a className="button-link success" href={buildWhatsAppUrl(listing.phone, listing.title)} target="_blank" rel="noreferrer">WhatsApp</a>
                <button className="ghost" onClick={() => onFeatureListing(listing.id, 7)}>Destacar 7 dias</button>
                <button className="danger" onClick={() => onDelete(listing.id)}>Excluir</button>
              </div>
            </div>
          ))}
          {listings.length === 0 && <p className="empty-inline">Você ainda não publicou anúncios.</p>}
        </div>
      </section>
      {canManageStore && (
        <section className="card">
          <div className="section-title">
            <div>
              <h2>Personalizar minha loja</h2>
              <p>Só contas Lojista e Premium aparecem na página de lojas. Preencha sua vitrine pública aqui.</p>
            </div>
          </div>
          <div className="grid four">
            <label className="field-group"><span>Nome da loja</span><input value={storeForm.storeName} onChange={(e) => setStoreForm({ ...storeForm, storeName: e.target.value })} /></label>
            <label className="field-group"><span>WhatsApp da loja</span><input value={storeForm.storeWhatsapp} onChange={(e) => setStoreForm({ ...storeForm, storeWhatsapp: e.target.value })} /></label>
            <label className="field-group"><span>Cidade</span><input value={storeForm.storeCity} onChange={(e) => setStoreForm({ ...storeForm, storeCity: e.target.value })} /></label>
            <label className="field-group"><span>Bairro</span><input value={storeForm.storeNeighborhood} onChange={(e) => setStoreForm({ ...storeForm, storeNeighborhood: e.target.value })} /></label>
          </div>
          <div className="grid four">
            <label className="field-group"><span>Logo da loja</span><input type="file" accept="image/*" onChange={(e) => loadStoreImage('storeLogoUrl', e.target.files)} /></label>
            <label className="field-group"><span>Banner da loja</span><input type="file" accept="image/*" onChange={(e) => loadStoreImage('storeBannerUrl', e.target.files)} /></label>
            <label className="field-group"><span>Instagram</span><input value={storeForm.storeInstagram} onChange={(e) => setStoreForm({ ...storeForm, storeInstagram: e.target.value })} /></label>
            <label className="field-group"><span>Site</span><input value={storeForm.storeWebsite} onChange={(e) => setStoreForm({ ...storeForm, storeWebsite: e.target.value })} /></label>
          </div>
          <div className="grid two store-upload-preview">
            <div className="upload-preview-box">{storeForm.storeLogoUrl ? <img src={storeForm.storeLogoUrl} alt="Logo da loja" className="store-logo large" /> : <span className="subtle">Faça upload do logo da loja</span>}</div>
            <div className="upload-preview-box">{storeForm.storeBannerUrl ? <img src={storeForm.storeBannerUrl} alt="Banner da loja" className="store-banner preview" /> : <span className="subtle">Faça upload do banner/capa da loja</span>}</div>
          </div>
          <label className="field-group"><span>Descrição da loja</span><textarea rows="4" value={storeForm.storeDescription} onChange={(e) => setStoreForm({ ...storeForm, storeDescription: e.target.value })} /></label>
          <div className="actions-row wrap">
            <label className="checkbox-row"><input type="checkbox" checked={!!storeForm.storeIsActive} onChange={(e) => setStoreForm({ ...storeForm, storeIsActive: e.target.checked })} /><span>Exibir minha loja publicamente</span></label>
            <button onClick={() => onSaveStore(storeForm)}>Salvar loja</button>
          </div>
        </section>
      )}
      <section className="card">
        <div className="section-title">
          <div>
            <h2>Contato por WhatsApp</h2>
            <p>Todos os contatos acontecem pelo WhatsApp para manter a negociação simples e rápida.</p>
          </div>
        </div>
        <div className="lead-list">
          {leads.length ? leads.map((lead) => (
            <article key={lead.id} className="card">
              <div className="between">
                <div>
                  <strong>{lead.name}</strong>
                  <p>{lead.listing?.title || 'Anúncio'}</p>
                </div>
                <a className="button-link success" href={buildWhatsAppUrl(lead.phone || lead.listing?.phone, lead.listing?.title || '')} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>
              </div>
              <p>{lead.message}</p>
            </article>
          )) : <p className="subtle">Quando alguém enviar interesse, você verá os contatos aqui para seguir pelo WhatsApp.</p>}
        </div>
      </section>
      <section className="card plan-flow-card">
        <div className="section-title">
          <div>
            <h2>Plano e upgrade</h2>
            <p>Veja seu plano atual, acompanhe a validade e, quando precisar, abra o checkout Pix para upgrade.</p>
          </div>
        </div>
        <div className="plan-summary-row">
          <div>
            <span className="subtle">Plano atual</span>
            <strong>{subscription?.plan?.name || 'Particular'}</strong>
            <p>{formatSubscriptionStatus(subscription?.status)} • {listings.length}/{subscription?.plan?.listingLimit ?? 2} anúncio(s) em uso • restam {getRemainingListingSlots(subscription, listings.length)} anúncio(s)</p>
            <p className="subtle">Expiração da assinatura: {formatDate(subscription?.expiresAt)}</p>
          </div>
          <div className="actions-row wrap">
            {canManageStore && <button className="ghost" onClick={onOpenStore}>Ver minha loja</button>}
            <button onClick={onOpenPlans}>Fazer upgrade</button>
          </div>
        </div>
        {checkoutState ? (
          <div className="checkout-box highlighted">
            <strong>Pagamento do upgrade</strong>
            <span>{checkoutState.instructions || 'Escaneie o QR Code Pix ou copie o código para pagar. A confirmação acontece automaticamente, sem precisar clicar em verificar pagamento.'}</span>
            <div className="chip-row wider">
              <span>Aguardando pagamento</span>
              <span>Pix gerado na hora</span>
              <span>{paymentConfig.enabled ? 'Mercado Pago ativo' : 'Modo simulação local'}</span>
              <span>Pagamento aprovado = plano ativo</span>
            </div>
            {checkoutState.pixQrBase64 && <img className="pix-qr" src={checkoutState.pixQrBase64} alt="QR Code Pix" />}
            {checkoutState.checkoutUrl && <a className="button-link success" href={checkoutState.checkoutUrl} target="_blank" rel="noreferrer">Abrir QR Code Pix</a>}
            {checkoutState.pixCode && <textarea readOnly rows={5} value={checkoutState.pixCode} />}
            {checkoutState.paymentId && <div className="actions-row wrap"><span className="subtle">Verificação automática do pagamento ativa. Assim que o Pix for aprovado, o plano será atualizado sozinho.</span></div>}
          </div>
        ) : (
          <div className="upgrade-inline-box">
            <p>{isParticular ? 'Seu plano Particular já está ativo por padrão com 2 anúncios. Faça upgrade apenas quando quiser mais estoque e vitrine de loja.' : 'Troque de plano quando quiser mais anúncios, vitrine e destaque.'}</p>
            {!!upgradePlans.length && <div className="chip-row wider">{upgradePlans.map((plan) => <span key={plan.id}>{plan.name} • {currency(plan.priceMonthly)}</span>)}</div>}
          </div>
        )}
      </section>
      <section className="card">
        <div className="section-title">
          <div>
            <h2>Meus favoritos</h2>
            <p>Somente favoritos aparecem como métrica principal para o usuário comum.</p>
          </div>
        </div>
        <div className="table-like">
          {favorites.map((listing) => (
            <div key={listing.id} className="table-row">
              <div>
                <strong>{listing.title}</strong>
                <span>{listing.city} • {currency(listing.price)}</span>
              </div>
              <div className="actions-row wrap">
                <button onClick={() => onOpen(listing)}>Abrir</button>
                <a className="button-link success" href={buildWhatsAppUrl(listing.phone, listing.title)} target="_blank" rel="noreferrer">WhatsApp</a>
                <button className="ghost" onClick={() => onToggleFavorite(listing)}>Remover</button>
              </div>
            </div>
          ))}
          {!favorites.length && <p className="empty-inline">Nenhum favorito salvo ainda.</p>}
        </div>
      </section>
    </div>
  );
}

function AdminPanel({ adminData, refreshAdmin, changeStatus, toggleFeature, updatePaymentStatus, updatePlan, createPlan, deletePlan }) {
  const emptyPlan = { name: '', slug: '', priceMonthly: '', listingLimit: '', featuredSlots: '', displayOrder: '', isRecommended: false, isActive: true, description: '', benefits: '' };
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [creatingPlan, setCreatingPlan] = useState(false);

  const openPlanEditor = (plan) => {
    setCreatingPlan(false);
    setEditingPlan(plan.id);
    setPlanForm({
      name: plan.name || '', slug: plan.slug || '', priceMonthly: plan.priceMonthly, listingLimit: plan.listingLimit, featuredSlots: plan.featuredSlots,
      displayOrder: plan.displayOrder || 0, isRecommended: !!plan.isRecommended, isActive: !!plan.isActive, description: plan.description || '', benefits: planBenefits(plan).join('\n'),
    });
  };

  const openCreatePlan = () => { setEditingPlan(null); setCreatingPlan(true); setPlanForm(emptyPlan); };
  const submitCreatePlan = async () => { await createPlan(planForm); setCreatingPlan(false); setPlanForm(emptyPlan); };

  return (
    <div className="dashboard-grid">
      <section className="card admin-stats">
        <div><strong>{adminData.dashboard.users}</strong><span>Usuários</span></div>
        <div><strong>{adminData.dashboard.listings}</strong><span>Anúncios</span></div>
        <div><strong>{adminData.dashboard.pending}</strong><span>Pendentes</span></div>
        <div><strong>{adminData.dashboard.leads}</strong><span>Leads</span></div>
        <div><strong>{adminData.dashboard.featured || 0}</strong><span>Destaques</span></div>
        <div><strong>{adminData.dashboard.activeSubscriptions || 0}</strong><span>Assinaturas ativas</span></div>
      </section>
      <section className="card">
        <div className="section-title"><div><h2>Configuração de planos</h2><p>O admin cria, ordena, recomenda, ativa e ajusta preços e limites direto no painel.</p></div><div className="actions-row wrap"><button className="ghost" onClick={refreshAdmin}>Atualizar admin</button><button onClick={openCreatePlan}>Novo plano</button></div></div>
        {creatingPlan && (
          <div className="card inset-card"><h3>Novo plano</h3><div className="grid four admin-plan-grid">
            <label className="field-group"><span>Nome</span><input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} /></label>
            <label className="field-group"><span>Slug</span><input value={planForm.slug} onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })} /></label>
            <label className="field-group"><span>Preço mensal</span><input value={planForm.priceMonthly} onChange={(e) => setPlanForm({ ...planForm, priceMonthly: e.target.value })} /></label>
            <label className="field-group"><span>Limite anúncios</span><input value={planForm.listingLimit} onChange={(e) => setPlanForm({ ...planForm, listingLimit: e.target.value })} /></label>
            <label className="field-group"><span>Destaques</span><input value={planForm.featuredSlots} onChange={(e) => setPlanForm({ ...planForm, featuredSlots: e.target.value })} /></label>
            <label className="field-group"><span>Ordem</span><input value={planForm.displayOrder} onChange={(e) => setPlanForm({ ...planForm, displayOrder: e.target.value })} /></label>
            <label className="field-group"><span>Status</span><select value={String(planForm.isActive)} onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.value === 'true' })}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
            <label className="checkbox-row"><input type="checkbox" checked={planForm.isRecommended} onChange={(e) => setPlanForm({ ...planForm, isRecommended: e.target.checked })} />Plano recomendado</label>
            <label className="field-group admin-plan-desc"><span>Descrição curta</span><input value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} /></label>
            <label className="field-group admin-plan-desc"><span>Benefícios (1 por linha)</span><textarea rows="4" value={planForm.benefits} onChange={(e) => setPlanForm({ ...planForm, benefits: e.target.value })} /></label>
            <div className="actions-row wrap"><button onClick={submitCreatePlan}>Criar plano</button><button className="ghost" onClick={() => setCreatingPlan(false)}>Cancelar</button></div>
          </div></div>
        )}
        <div className="table-like">
          {(adminData.plans || []).map((plan) => (
            <div key={plan.id} className="table-row stacked-row">
              <div><strong>{plan.name}</strong><span>{currency(plan.priceMonthly)} / mês • {plan.listingLimit} anúncios • {plan.featuredSlots} destaque(s) • ordem {plan.displayOrder || 0} • {plan.isActive ? 'Ativo' : 'Inativo'}{plan.isRecommended ? ' • Recomendado' : ''}</span></div>
              <p className="subtle">{plan.description}</p>
              {!!planBenefits(plan).length && <div className="chip-row">{planBenefits(plan).map((item) => <span key={item}>{item}</span>)}</div>}
              {editingPlan === plan.id ? (
                <div className="grid four admin-plan-grid">
                  <label className="field-group"><span>Nome</span><input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} /></label>
                  <label className="field-group"><span>Slug</span><input value={planForm.slug} onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })} /></label>
                  <label className="field-group"><span>Preço mensal</span><input value={planForm.priceMonthly} onChange={(e) => setPlanForm({ ...planForm, priceMonthly: e.target.value })} /></label>
                  <label className="field-group"><span>Limite anúncios</span><input value={planForm.listingLimit} onChange={(e) => setPlanForm({ ...planForm, listingLimit: e.target.value })} /></label>
                  <label className="field-group"><span>Destaques</span><input value={planForm.featuredSlots} onChange={(e) => setPlanForm({ ...planForm, featuredSlots: e.target.value })} /></label>
                  <label className="field-group"><span>Ordem</span><input value={planForm.displayOrder} onChange={(e) => setPlanForm({ ...planForm, displayOrder: e.target.value })} /></label>
                  <label className="field-group"><span>Status</span><select value={String(planForm.isActive)} onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.value === 'true' })}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
                  <label className="checkbox-row"><input type="checkbox" checked={planForm.isRecommended} onChange={(e) => setPlanForm({ ...planForm, isRecommended: e.target.checked })} />Plano recomendado</label>
                  <label className="field-group admin-plan-desc"><span>Descrição</span><input value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} /></label>
                  <label className="field-group admin-plan-desc"><span>Benefícios (1 por linha)</span><textarea rows="4" value={planForm.benefits} onChange={(e) => setPlanForm({ ...planForm, benefits: e.target.value })} /></label>
                  <div className="actions-row wrap"><button onClick={() => { updatePlan(plan.id, planForm); setEditingPlan(null); }}>Salvar plano</button><button className="ghost" onClick={() => setEditingPlan(null)}>Cancelar</button></div>
                </div>
              ) : (
                <div className="actions-row wrap"><button onClick={() => openPlanEditor(plan)}>Editar plano</button><button className="danger" onClick={() => deletePlan(plan.id)}>Excluir / inativar</button></div>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="card"><div className="section-title"><div><h2>Usuários</h2><p>Gerencie usuários e acompanhe seus volumes.</p></div></div><div className="table-like">{(adminData.users || []).map((user) => <div key={user.id} className="table-row"><div><strong>{user.name}</strong><span>{user.email} • {user.role} • {user.companyName || 'Sem empresa'}</span></div><span>{user._count?.listings || 0} anúncio(s)</span></div>)}{!(adminData.users || []).length && <p className="empty-inline">Nenhum usuário encontrado.</p>}</div></section>
      <section className="card"><div className="section-title"><div><h2>Anúncios do sistema</h2><p>O admin acompanha anúncios ativos e controla destaques quando necessário.</p></div></div><div className="table-like">{adminData.listings.map((listing) => (<div key={listing.id} className="table-row admin-row"><div><strong>{listing.title}</strong><span>{listing.user.name} • {listing.status} • {currency(listing.price)}</span></div><div className="actions-row wrap"><button className="ghost" onClick={() => toggleFeature(listing.id, !listing.isFeatured)}>{listing.isFeatured ? 'Remover destaque' : 'Dar destaque'}</button></div></div>))}</div></section>
      <section className="card"><h2>Assinaturas</h2><div className="table-like">{(adminData.subscriptions || []).map((item) => (<div key={item.id} className="table-row stacked-row"><div><strong>{item.user?.name}</strong><span>{item.plan?.name} • {formatSubscriptionStatus(item.status)} • {currency(item.plan?.priceMonthly || 0)}</span></div><p className="subtle">O plano Particular já nasce ativo. Lojista e Premium passam a ativar automaticamente quando o pagamento é aprovado.</p></div>))}</div></section>
      <section className="card"><h2>Pagamentos</h2><div className="table-like">{(adminData.payments || []).map((item) => (<div key={item.id} className="table-row stacked-row"><div><strong>{item.user?.name}</strong><span>{item.type} • {currency(item.amount)} • {formatPaymentStatus(item.status)}</span></div><p>{item.description || 'Cobrança do sistema'}</p><p className="subtle">Atualização automática pela consulta do pagamento.</p></div>))}{!(adminData.payments || []).length && <p className="empty-inline">Nenhum pagamento registrado ainda.</p>}</div></section>
      <section className="card"><h2>Leads do sistema</h2><div className="table-like">{adminData.leads.map((lead) => (<div key={lead.id} className="table-row stacked-row"><div><strong>{lead.name}</strong><span>{lead.phone} • {lead.listing?.title || 'Sem anúncio'}</span></div><p>{lead.message}</p></div>))}{!adminData.leads.length && <p className="empty-inline">Nenhum lead registrado ainda.</p>}</div></section>
    </div>
  );
}

function StoresPage({ stores, onOpenStore }) {
  const [filters, setFilters] = useState({ q: '', city: '', neighborhood: '', plan: '' });
  const filtered = useMemo(() => stores.filter((store) => {
    if (filters.q && ![store.name, store.description, store.city, store.neighborhood].join(' ').toLowerCase().includes(filters.q.toLowerCase())) return false;
    if (filters.city && !(store.city || '').toLowerCase().includes(filters.city.toLowerCase())) return false;
    if (filters.neighborhood && !(store.neighborhood || '').toLowerCase().includes(filters.neighborhood.toLowerCase())) return false;
    if (filters.plan && store.planSlug !== filters.plan) return false;
    return true;
  }), [stores, filters]);

  return (
    <div className="dashboard-grid">
      <section className="card">
        <div className="section-title"><div><h2>Lojas</h2><p>Só aparecem contas Lojista e Premium com loja ativa e anúncios ativos.</p></div></div>
        <div className="grid four">
          <input placeholder="Buscar loja" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <input placeholder="Cidade" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
          <input placeholder="Bairro" value={filters.neighborhood} onChange={(e) => setFilters({ ...filters, neighborhood: e.target.value })} />
          <label className="field-group"><span>Plano</span><select value={filters.plan} onChange={(e) => setFilters({ ...filters, plan: e.target.value })}><option value="">Todos</option><option value="lojista">Lojista</option><option value="premium">Premium</option></select></label>
        </div>
        <div className="stores-grid">
          {filtered.map((store) => (
            <article key={store.userId} className="store-card">
              {store.bannerUrl ? <img className="store-banner" src={store.bannerUrl} alt={store.name} /> : <div className="store-banner placeholder" />}
              <div className="store-card-body">
                <div className="store-header-line">
                  {store.logoUrl ? <img className="store-logo" src={store.logoUrl} alt={store.name} /> : <div className="store-avatar">{store.name.slice(0,1).toUpperCase()}</div>}
                  <div>
                    <strong>{store.name}</strong>
                    <p>{store.planName} • {store.city}{store.neighborhood ? ` / ${store.neighborhood}` : ''}</p>
                  </div>
                </div>
                <p>{store.description || 'Loja sem descrição ainda.'}</p>
                <div className="chip-row"><span>{store.listingCount} anúncio(s) ativo(s)</span><span>{store.planSlug === 'premium' ? 'Premium' : 'Lojista'}</span></div>
                <div className="actions-row wrap">
                  <button onClick={() => onOpenStore(store.userId)}>Ver loja</button>
                  {store.whatsapp && <a className="button-link success" href={buildWhatsAppUrl(store.whatsapp, store.name)} target="_blank" rel="noreferrer">WhatsApp</a>}
                </div>
              </div>
            </article>
          ))}
          {!filtered.length && <p className="empty-inline">Nenhuma loja encontrada com esses filtros.</p>}
        </div>
      </section>
    </div>
  );
}

function StoreDetailPage({ store, auth, onOpenListing, onToggleFavorite, onBack }) {
  if (!store) return null;
  return (
    <div className="dashboard-grid">
      <section className="card store-detail-hero">
        <button className="ghost" onClick={onBack}>← Voltar para lojas</button>
        {store.bannerUrl ? <img className="store-banner detail" src={store.bannerUrl} alt={store.name} /> : <div className="store-banner placeholder detail" />}
        <div className="store-detail-head">
          {store.logoUrl ? <img className="store-logo xl" src={store.logoUrl} alt={store.name} /> : <div className="store-avatar xl">{store.name.slice(0,1).toUpperCase()}</div>}
          <div>
            <h2>{store.name}</h2>
            <p>{store.planName} • {store.city}{store.neighborhood ? ` / ${store.neighborhood}` : ''}</p>
            <p>{store.description || 'Loja sem descrição.'}</p>
            <div className="actions-row wrap">
              {store.whatsapp && <a className="button-link success" href={buildWhatsAppUrl(store.whatsapp, store.name)} target="_blank" rel="noreferrer">Chamar no WhatsApp</a>}
              {store.instagram && <span className="subtle">{store.instagram}</span>}
            </div>
          </div>
        </div>
      </section>
      <section className="card">
        <div className="section-title"><div><h2>Anúncios da loja</h2><p>Ao clicar em uma loja, aparecem apenas os anúncios dela.</p></div></div>
        <ListingGrid listings={store.listings || []} auth={auth} onOpen={onOpenListing} onToggleFavorite={onToggleFavorite} />
      </section>
    </div>
  );
}

function PlansPage({ plans, subscription, onSubscribe, paymentConfig }) {
  const isParticular = getCurrentPlanSlug(subscription) === 'particular' || !subscription;
  const currentPlanId = subscription?.plan?.id;
  const sortedPlans = [...plans].sort((a, b) => {
    if (currentPlanId && a.id === currentPlanId) return -1;
    if (currentPlanId && b.id === currentPlanId) return 1;
    if ((a.isRecommended ? 1 : 0) !== (b.isRecommended ? 1 : 0)) return (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0);
    return (a.displayOrder || 0) - (b.displayOrder || 0) || (a.priceMonthly || 0) - (b.priceMonthly || 0);
  });
  return (
    <div className="dashboard-grid">
      <section className="card">
        <div className="section-title">
          <div>
            <h2>Planos comerciais</h2>
            <p>{isParticular ? 'O plano Particular já fica ativo no cadastro, com 2 anúncios liberados. Compare abaixo as opções Lojista e Premium quando quiser expandir sua operação.' : 'Compare seu plano atual com outras opções para vender mais e ganhar destaque.'}</p>
          </div>
        </div>
        <div className="plans-grid">
          {sortedPlans.map((plan) => (
            <article key={plan.id} className={`plan-card ${plan.isRecommended ? 'recommended' : ''} ${currentPlanId === plan.id ? 'current-plan' : ''}`}>
              <span className="eyebrow">{currentPlanId === plan.id ? 'Seu plano atual' : plan.isRecommended ? 'Mais escolhido' : 'Plano comercial'}</span>
              <h3>{plan.name}</h3>
              <strong>{currency(plan.priceMonthly)}{plan.priceMonthly ? '/mês' : ''}</strong>
              <p>{plan.description}</p>
              <ul>
                <li>Até {plan.listingLimit} anúncios ativos</li>
                <li>{plan.featuredSlots} destaque(s) simultâneo(s)</li>
                {planBenefits(plan).map((item) => <li key={item}>{item}</li>)}
              </ul>
              {plan.slug === 'particular' ? (
                <div className="chip-row wider"><span>{currentPlanId === plan.id || isParticular ? 'Plano atual ativo' : 'Plano padrão disponível no cadastro'}</span></div>
              ) : (
                <button disabled={currentPlanId === plan.id} onClick={() => onSubscribe(plan.id)}>{currentPlanId === plan.id ? 'Plano atual' : 'Fazer upgrade e gerar Pix'}</button>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Como funciona a contratação</h2>
        <div className="chip-row wider">
          <span>Particular ativo por padrão</span>
          <span>Escolha do upgrade</span>
          <span>Pix gerado na hora</span>
          <span>{paymentConfig.enabled ? 'Mercado Pago ativo' : 'Modo simulação local'}</span>
          <span>Pagamento confirmado</span>
          <span>Plano em ativação</span>
          <span>Plano ativo</span>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('automarket-auth');
    return saved ? JSON.parse(saved) : emptyAuth;
  });
  const [currentView, setCurrentView] = useState('home');
  const [filters, setFilters] = useState({ q: '', brand: '', model: '', sortBy: 'recent' });
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [favoriteListings, setFavoriteListings] = useState([]);
  const [sellerLeads, setSellerLeads] = useState([]);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stores, setStores] = useState([]);
  const [myStore, setMyStore] = useState({ canManageStore: false, planSlug: 'particular', planName: 'Particular', profile: storeProfileInitial });
  const [paymentConfig, setPaymentConfig] = useState({ enabled: false, provider: 'LOCAL_SIMULATION' });
  const [checkoutState, setCheckoutState] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [editingListing, setEditingListing] = useState(null);
  const [message, setMessage] = useState('');
  const [adminData, setAdminData] = useState({ dashboard: { users: 0, listings: 0, pending: 0, leads: 0, featured: 0, activeSubscriptions: 0 }, listings: [], leads: [], subscriptions: [], payments: [], plans: [], users: [] });

  useEffect(() => {
    localStorage.setItem('automarket-auth', JSON.stringify(auth));
  }, [auth]);





  const fetchListings = async () => {
    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== false) query.set(key, String(value));
      });
      const data = await api(`/listings?${query.toString()}`, {
        headers: auth.user ? { 'x-user-id': String(auth.user.id) } : {}
      }, auth.token);
      setListings(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const fetchMyListings = async () => {
    if (!auth.user) return;
    try {
      const mine = await api('/listings/mine', {}, auth.token);
      setMyListings(mine);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const fetchFavoriteListings = async () => {
    if (!auth.user) return;
    try {
      const data = await api('/listings', { headers: { 'x-user-id': String(auth.user.id) } }, auth.token);
      setFavoriteListings(data.filter((listing) => listing.isFavorite));
    } catch (error) {
      setMessage(error.message);
    }
  };

  const fetchSellerLeads = async () => {
    if (!auth.user) return;
    try {
      const leads = await api('/listings/mine/leads', {}, auth.token);
      setSellerLeads(leads);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const fetchPlans = async () => {
    try {
      const [data, config] = await Promise.all([api('/plans'), api('/payments/config')]);
      setPlans(data);
      setPaymentConfig(config);
    } catch (error) {
      setMessage(error.message);
    }
  };


  const fetchStores = async () => {
    try {
      const data = await api('/stores');
      setStores(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const fetchMyStore = async () => {
    if (!auth.user) return setMyStore({ canManageStore: false, planSlug: 'particular', planName: 'Particular', profile: storeProfileInitial });
    try {
      const data = await api('/stores/me', {}, auth.token);
      setMyStore(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const fetchSubscription = async () => {
    if (!auth.user) return setSubscription(null);
    try {
      const [data, myPayments] = await Promise.all([api('/plans/my-subscription', {}, auth.token), api('/payments/mine', {}, auth.token)]);
      setSubscription(data);
      setPayments(myPayments);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const fetchAdmin = async () => {
    if (auth.user?.role !== 'ADMIN') return;
    try {
      const [dashboard, adminListings, leads, subscriptions, payments, adminPlans, users] = await Promise.all([
        api('/admin/dashboard', {}, auth.token),
        api('/admin/listings', {}, auth.token),
        api('/admin/leads', {}, auth.token),
        api('/plans/admin/subscriptions', {}, auth.token),
        api('/payments/admin/all', {}, auth.token),
        api('/plans/admin/plans', {}, auth.token),
        api('/admin/users', {}, auth.token),
      ]);
      setAdminData({ dashboard, listings: adminListings, leads, subscriptions, payments, plans: adminPlans, users });
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => { fetchListings(); fetchPlans(); fetchStores(); }, []);
  useEffect(() => { fetchListings(); }, [filters]);

  useEffect(() => {
    if (auth.user) {
      fetchListings();
      fetchMyListings();
      fetchFavoriteListings();
      fetchSellerLeads();
      fetchSubscription();
      fetchMyStore();
      if (auth.user.role === 'ADMIN') fetchAdmin();
    } else {
      setMyListings([]);
      setFavoriteListings([]);
      setSellerLeads([]);
      setSubscription(null);
      setMyStore({ canManageStore: false, planSlug: 'particular', planName: 'Particular', profile: storeProfileInitial });
          }
  }, [auth.user]);


  useEffect(() => {
    if (!checkoutState) return;
    const relatedPayment = checkoutState.paymentId ? payments.find((item) => item.id === checkoutState.paymentId) : null;
    const paymentApproved = relatedPayment?.status === 'PAID';
    const paymentRejected = ['EXPIRED', 'CANCELLED', 'REJECTED'].includes(relatedPayment?.status);
    const planActivated = checkoutState.type === 'PLAN' && checkoutState.planId && subscription?.plan?.id === checkoutState.planId && ['ACTIVE', 'ACTIVATING'].includes(subscription?.status);
    const featuredApplied = checkoutState.type === 'FEATURED' && checkoutState.listingId && myListings.some((item) => item.id === checkoutState.listingId && item.isFeatured);

    if (paymentApproved || planActivated || featuredApplied) {
      setCheckoutState(null);
      if (paymentApproved || planActivated) {
        setMessage('Pagamento aprovado e plano ativado com sucesso.');
      }
    }

    if (paymentRejected) {
      setCheckoutState(null);
      setMessage(`Cobrança finalizada com status: ${formatPaymentStatus(relatedPayment?.status)}.`);
    }
  }, [checkoutState, payments, subscription, myListings]);

  useEffect(() => {
    if (!checkoutState?.paymentId || !auth.token) return;

    const relatedPayment = payments.find((item) => item.id === checkoutState.paymentId);
    const terminal = ['PAID', 'EXPIRED', 'CANCELLED', 'REJECTED'].includes(relatedPayment?.status);
    if (terminal) return;

    let cancelled = false;
    const runRefresh = async (silent = false) => {
      try {
        await api(`/payments/${checkoutState.paymentId}/refresh`, { method: 'POST' }, auth.token);
        if (!cancelled) {
          await refreshAll();
          if (!silent) setMessage('Status do pagamento atualizado automaticamente.');
        }
      } catch (error) {
        if (!cancelled && !silent) setMessage(error.message);
      }
    };

    runRefresh(true);
    const interval = setInterval(() => runRefresh(true), 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [checkoutState?.paymentId, auth.token]);

  const handleAuthSuccess = (data) => {
    setAuth(data);
    setCurrentView(data.user?.role === 'ADMIN' ? 'admin' : 'dashboard');
    setMessage('');
  };

  const logout = () => {
    setAuth(emptyAuth);
    setCurrentView('home');
    setEditingListing(null);
  };

  const refreshAll = async () => {
    await fetchListings();
    await fetchPlans();
    await fetchStores();
    if (auth.user) {
      await fetchMyListings();
      await fetchFavoriteListings();
      await fetchSellerLeads();
      await fetchSubscription();
      await fetchMyStore();
      if (auth.user.role === 'ADMIN') await fetchAdmin();
    }
  };

  const toggleFavorite = async (listing) => {
    if (!auth.token) {
      setCurrentView('auth');
      return;
    }
    try {
      if (listing.isFavorite) await api(`/listings/${listing.id}/favorite`, { method: 'DELETE' }, auth.token);
      else await api(`/listings/${listing.id}/favorite`, { method: 'POST' }, auth.token);
      await refreshAll();
      if (selectedListing?.id === listing.id) {
        const updated = await api(`/listings/${listing.id}`, { headers: { 'x-user-id': String(auth.user.id) } }, auth.token);
        setSelectedListing(updated);
      }
    } catch (error) {
      setMessage(error.message);
    }
  };

  const removeListing = async (id) => {
    if (!window.confirm('Deseja excluir este anúncio?')) return;
    try {
      await api(`/listings/${id}`, { method: 'DELETE' }, auth.token);
      await refreshAll();
      setEditingListing(null);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const changeStatus = async (id, status) => {
    try {
      await api(`/admin/listings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, auth.token);
      await refreshAll();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const updateLeadStatus = async (leadId, status) => {
    try {
      await api(`/listings/leads/${leadId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, auth.token);
      await refreshAll();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const subscribeToPlan = async (planId) => {
    if (!auth.token) { setCurrentView('auth'); return; }
    try {
      const data = await api('/plans/subscribe', { method: 'POST', body: JSON.stringify({ planId }) }, auth.token);
      setCheckoutState(data.checkout ? { ...data.checkout, paymentId: data.payment?.id || null, planId: data.subscription?.planId || planId, type: 'PLAN' } : null);
      setMessage(data.message || `Cobrança criada. ${data.checkout?.instructions || ''}`);
      await refreshAll();
      setCurrentView('dashboard');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const featureListing = async (listingId, days = 7) => {
    try {
      const data = await api('/payments/feature-listing', { method: 'POST', body: JSON.stringify({ listingId, days }) }, auth.token);
      setCheckoutState({ ...(data.checkout || {}), paymentId: data.payment?.id || null, listingId, type: 'FEATURED', instructions: data.checkout?.instructions || `Cobrança de destaque gerada para ${days} dias.` });
      setMessage(`Cobrança de destaque criada para ${days} dias.`);
      await refreshAll();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const toggleFeature = async (listingId, isFeatured) => {
    try {
      await api(`/admin/listings/${listingId}/feature`, { method: 'PATCH', body: JSON.stringify({ isFeatured }) }, auth.token);
      await refreshAll();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const updatePaymentStatus = async (paymentId, status) => {
    try {
      await api(`/payments/admin/${paymentId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, auth.token);
      await refreshAll();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const updateSubscriptionStatus = async (subscriptionId, status) => {
    try {
      await api(`/plans/admin/subscriptions/${subscriptionId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, auth.token);
      await refreshAll();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const refreshPaymentStatus = async (paymentId) => {
    try {
      const data = await api(`/payments/${paymentId}/refresh`, { method: 'POST' }, auth.token);
      setMessage(`Status atualizado: ${formatPaymentStatus(data.status)}.`);
      await refreshAll();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const createPlan = async (payload) => {
    try {
      await api('/plans/admin/plans', { method: 'POST', body: JSON.stringify(payload) }, auth.token);
      setMessage('Plano criado com sucesso.');
      await refreshAll();
    } catch (error) {
      setMessage(error.message);
      throw error;
    }
  };

  const updatePlan = async (planId, payload) => {
    try {
      await api(`/plans/admin/plans/${planId}`, { method: 'PATCH', body: JSON.stringify(payload) }, auth.token);
      setMessage('Plano atualizado com sucesso.');
      await refreshAll();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const deletePlan = async (planId) => {
    try {
      await api(`/plans/admin/plans/${planId}`, { method: 'DELETE' }, auth.token);
      setMessage('Plano removido ou inativado com sucesso.');
      await refreshAll();
    } catch (error) {
      setMessage(error.message);
    }
  };


  const saveMyStore = async (payload) => {
    try {
      await api('/stores/me', { method: 'PUT', body: JSON.stringify(payload) }, auth.token);
      setMessage('Loja atualizada com sucesso.');
      await refreshAll();
      setCurrentView('lojas');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const openListing = async (listing) => {
    try {
      const data = await api(`/listings/${listing.id}`, {
        headers: auth.user ? { 'x-user-id': String(auth.user.id) } : {}
      }, auth.token);
      setSelectedListing(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const openStore = async (userId) => {
    try {
      const data = await api(`/stores/${userId}`);
      setSelectedStore(data);
      setCurrentView('store');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const relatedListings = useMemo(() => {
    if (!selectedListing) return [];
    return listings.filter((item) => item.id !== selectedListing.id && (item.brand === selectedListing.brand || item.city === selectedListing.city));
  }, [selectedListing, listings]);

  return (
    <div className="app-shell">
      <Header auth={auth} onLogout={logout} currentView={currentView} setCurrentView={setCurrentView} />
      {message && <div className="global-message">{message}</div>}
      <main className="container">
        {currentView === 'home' && (
          <>
            <Hero listingsCount={listings.length} onOpenAuth={() => setCurrentView(auth.user ? 'dashboard' : 'auth')} setCurrentView={setCurrentView} />
            <Filters filters={filters} setFilters={setFilters} onRefresh={fetchListings} total={listings.length} />
            <ListingGrid listings={listings} auth={auth} onOpen={openListing} onToggleFavorite={toggleFavorite} />
          </>
        )}

        {currentView === 'auth' && !auth.user && <AuthPanel onAuthSuccess={handleAuthSuccess} />}

        {currentView === 'dashboard' && auth.user && (
          <>
            <ListingForm auth={auth} editing={editingListing} onSaved={refreshAll} onCancel={() => setEditingListing(null)} />
            <Dashboard
              auth={auth}
              listings={myListings}
              favorites={favoriteListings}
              leads={sellerLeads}
              subscription={subscription}
              plans={plans}
              payments={payments}
              checkoutState={checkoutState}
              paymentConfig={paymentConfig}
              myStore={myStore}
              onSaveStore={saveMyStore}
              onRefresh={refreshAll}
              onEdit={(listing) => setEditingListing(listing)}
              onOpen={openListing}
              onDelete={removeListing}
              onToggleFavorite={toggleFavorite}
              onLeadStatusChange={updateLeadStatus}
              onSubscribe={subscribeToPlan}
              onFeatureListing={featureListing}
              onRefreshPayment={refreshPaymentStatus}
              onOpenPlans={() => setCurrentView('planos')}
              onOpenStore={() => openStore(auth.user.id)}
            />
          </>
        )}

        {currentView === 'admin' && auth.user?.role === 'ADMIN' && (
          <AdminPanel adminData={adminData} refreshAdmin={refreshAll} changeStatus={changeStatus} toggleFeature={toggleFeature} updatePaymentStatus={updatePaymentStatus} updatePlan={updatePlan} createPlan={createPlan} deletePlan={deletePlan} />
        )}

        {currentView === 'lojas' && <StoresPage stores={stores} onOpenStore={openStore} />}
        {currentView === 'store' && selectedStore && <StoreDetailPage store={selectedStore} auth={auth} onOpenListing={openListing} onToggleFavorite={toggleFavorite} onBack={() => setCurrentView('lojas')} />}
        {currentView === 'planos' && <PlansPage plans={plans} subscription={subscription} onSubscribe={subscribeToPlan} paymentConfig={paymentConfig} />}
      </main>
      {selectedListing && (
        <DetailModal
          listing={selectedListing}
          auth={auth}
          onClose={() => setSelectedListing(null)}
          onToggleFavorite={toggleFavorite}
          refresh={refreshAll}
          relatedListings={relatedListings}
          openListing={openListing}
        />
      )}
    </div>
  );
}
