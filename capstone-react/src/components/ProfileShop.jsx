import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { clearCustomizationCache } from '../lib/customization';

const SHOP_API = window.location.hostname === 'localhost'
  ? '/api/shop'
  : `${import.meta.env.VITE_API_URL || ''}/api/shop`;

// Mini profile card that previews how an item looks
function ItemPreviewCard({ item, user }) {
  if (!item) return null;
  const css = typeof item.css_data === 'string' ? JSON.parse(item.css_data) : (item.css_data || {});

  const previewName = (
    <span style={{
      fontSize: 15, fontWeight: 800, letterSpacing: 1,
      ...(css.gradient
        ? { background: css.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-block' }
        : css.color ? { color: css.color } : { color: 'var(--text-primary)' })
    }}>
      {user.full_name?.toUpperCase() || 'YOUR NAME'}
    </span>
  );

  const avatarBorderStyle = item.type === 'avatar_border'
    ? { border: css.border || '3px solid var(--cyber-cyan)', boxShadow: css.boxShadow }
    : { border: '3px solid var(--card-bg)' };

  const cardBg = item.type === 'background'
    ? { background: css.pattern || css.gradient || css.image || 'rgba(0,0,0,0.8)', backgroundSize: css.size || 'cover' }
    : item.type === 'theme' && css.gradient
    ? { background: css.gradient }
    : {};

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,240,255,0.3)',
      background: 'rgba(0,10,20,0.9)', ...cardBg, minHeight: 110,
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
      position: 'relative',
    }}>
      {/* Avatar wrapper — companion sits outside overflow:hidden circle */}
      <div style={{ position: 'relative', flexShrink: 0, width: 56, height: 56 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(0,240,255,0.1)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'var(--cyber-cyan)',
          overflow: 'hidden', ...avatarBorderStyle,
        }}>
          {user.avatar_url
            ? <img src={user.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??')}
        </div>
        {/* companion preview — outside the clipped circle */}
        {item.type === 'companion' && css.url && (
          <img src={css.url} alt="companion" style={{
            position: 'absolute', top: '-15%', left: '-15%',
            width: '55%', height: 'auto',
            pointerEvents: 'none', zIndex: 2,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))',
            transform: 'rotate(-15deg)',
          }} />
        )}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {item.type === 'name_color' ? previewName : <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{user.full_name?.toUpperCase()}</span>}
          {item.type === 'badge' && <span style={{ fontSize: 16 }}>{item.preview_url}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Preview — {item.name}</div>
      </div>
    </div>
  );
}

// Buy confirmation modal with preview
function BuyPreviewModal({ item, user, trustPoints, onConfirm, onCancel, buying }) {
  const canAfford = trustPoints - item.price >= 10;
  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 9999 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card-bg)', border: '1px solid rgba(0,240,255,0.25)',
        borderRadius: 16, padding: 28, maxWidth: 420, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyber-cyan)', marginBottom: 4, letterSpacing: 1 }}>
          <i className="fa-solid fa-eye" style={{ marginRight: 8 }} />PREVIEW
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>This is how it'll look on your profile</div>

        <ItemPreviewCard item={item} user={user} />

        <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(0,0,0,0.5)', borderRadius: 10, border: '1px solid rgba(0,240,255,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>Item</span>
            <span style={{ fontWeight: 700 }}>{item.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>Cost</span>
            <span style={{ fontWeight: 700, color: 'var(--cyber-yellow)' }}>{item.price} TP</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>After purchase</span>
            <span style={{ fontWeight: 700, color: canAfford ? 'var(--green)' : 'var(--red)' }}>{trustPoints - item.price} TP</span>
          </div>
        </div>

        {!canAfford && (
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--red)', textAlign: 'center' }}>
            Cannot purchase — would drop below the 10 TP minimum.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="cyber-btn secondary" onClick={onCancel} style={{ flex: 1, fontSize: 12 }}>Cancel</button>
          <button className="cyber-btn" onClick={onConfirm} disabled={!canAfford || buying}
            style={{ flex: 1, fontSize: 12, opacity: canAfford ? 1 : 0.4, cursor: canAfford ? 'pointer' : 'not-allowed' }}>
            {buying ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />Buying...</> : `Buy for ${item.price} TP`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfileShop({ user, onClose }) {
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('shop');
  const [selectedType, setSelectedType] = useState('all');
  const [trustPoints, setTrustPoints] = useState(0);
  const [previewItem, setPreviewItem] = useState(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      const { data: statusData } = await supabase.from('account_status').select('trust_points').eq('id', user.id).single();
      setTrustPoints(statusData?.trust_points || 0);

      const itemsRes = await fetch(SHOP_API, { headers });
      if (!itemsRes.ok) throw new Error(`Shop GET failed: ${itemsRes.status}`);
      setItems(await itemsRes.json());

      const purchasesRes = await fetch(SHOP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ action: 'get-purchases', userId: user.id })
      });
      setPurchases(await purchasesRes.json());
    } catch (err) { console.error('Failed to load shop:', err); }
    setLoading(false);
  };

  const confirmBuy = async () => {
    if (!previewItem) return;
    setBuying(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(SHOP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: 'buy-item', userId: user.id, itemId: previewItem.id })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to buy item'); return; }
      setTrustPoints(data.newPoints);
      setPreviewItem(null);
      loadData();
    } catch (err) { alert('Network error. Please try again.'); }
    setBuying(false);
  };

  const owned = purchases.map(p => p.item_id);
  const filteredItems = selectedType === 'all' ? items : items.filter(i => i.type === selectedType);

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, color: 'var(--cyber-cyan)' }}>
                <i className="fa-solid fa-store" style={{ marginRight: 8 }} />Profile Shop
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Spend trust points on profile cosmetics
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>YOUR TRUST POINTS</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--cyber-yellow)' }}>{trustPoints}</div>
            </div>
          </div>

          {/* Min balance notice */}
          <div style={{ background: 'rgba(252,238,10,0.08)', border: '1px solid rgba(252,238,10,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fa-solid fa-info-circle" style={{ color: 'var(--cyber-yellow)', fontSize: 15 }} />
            <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
              Minimum balance of <strong style={{ color: 'var(--cyber-yellow)' }}>10 TP</strong> must be maintained at all times.
            </div>
          </div>

          {/* Tabs — shop & inventory only; customize is now in the profile */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid rgba(0,240,255,0.2)', paddingBottom: 10 }}>
            {['shop', 'inventory'].map(t => (
              <button key={t} onClick={() => setTab(t)} className="cyber-btn"
                style={{ background: tab === t ? 'var(--cyber-cyan)' : 'transparent', color: tab === t ? '#000' : 'var(--cyber-cyan)', border: `1px solid ${tab === t ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.3)'}`, padding: '8px 16px', fontSize: 12, textTransform: 'uppercase' }}>
                {t === 'shop' ? <><i className="fa-solid fa-shopping-cart" style={{ marginRight: 6 }} />Shop</> : <><i className="fa-solid fa-box" style={{ marginRight: 6 }} />Inventory</>}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
          ) : (
            <>
              {/* SHOP TAB */}
              {tab === 'shop' && (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {['all', 'theme', 'badge', 'name_color', 'avatar_border', 'background', 'companion'].map(type => (
                      <button key={type} onClick={() => setSelectedType(type)}
                        style={{ padding: '6px 12px', fontSize: 11, borderRadius: 6, cursor: 'pointer', textTransform: 'capitalize',
                          background: selectedType === type ? 'rgba(0,240,255,0.2)' : 'rgba(0,0,0,0.3)',
                          border: `1px solid ${selectedType === type ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.1)'}`,
                          color: selectedType === type ? 'var(--cyber-cyan)' : 'var(--text-muted)' }}>
                        {type === 'all' ? 'All Items' : type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                    {filteredItems.map(item => {
                      const css = typeof item.css_data === 'string' ? JSON.parse(item.css_data || '{}') : (item.css_data || {});
                      const canAfford = trustPoints - item.price >= 10;
                      const isOwned = owned.includes(item.id);
                      return (
                        <div key={item.id} style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {/* Inline preview swatch */}
                          {item.type === 'badge' && <div style={{ fontSize: 32, textAlign: 'center' }}>{item.preview_url}</div>}
                          {item.type === 'name_color' && (
                            <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center',
                              ...(css.gradient ? { background: css.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color: css.color }) }}>
                              {user.full_name}
                            </div>
                          )}
                          {item.type === 'theme' && (
                            <div style={{ height: 50, borderRadius: 6, background: css.gradient || css.primary || 'rgba(0,240,255,0.2)' }} />
                          )}
                          {item.type === 'background' && (
                            <div style={{ height: 50, borderRadius: 6, background: css.pattern || css.gradient || css.image || 'rgba(0,240,255,0.1)', backgroundSize: css.size || 'cover' }} />
                          )}
                          {item.type === 'avatar_border' && (
                            <div style={{ width: 44, height: 44, borderRadius: '50%', margin: '0 auto', background: 'rgba(0,240,255,0.1)', border: css.border || '3px solid var(--cyber-cyan)', boxShadow: css.boxShadow }} />
                          )}
                          {item.type === 'companion' && css.url && (
                            <img src={css.url} alt={item.name} style={{ height: 50, objectFit: 'contain', margin: '0 auto', display: 'block', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />
                          )}

                          <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--cyber-cyan)', textTransform: 'uppercase', fontWeight: 600 }}>{item.type.replace('_', ' ')}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', flexGrow: 1 }}>{item.description}</div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--cyber-yellow)' }}>{item.price} <span style={{ fontSize: 10 }}>TP</span></div>
                            {isOwned
                              ? <span style={{ fontSize: 11, color: 'var(--green)' }}><i className="fa-solid fa-check" style={{ marginRight: 4 }} />Owned</span>
                              : (
                                <button onClick={() => setPreviewItem(item)} className="cyber-btn"
                                  disabled={!canAfford}
                                  title={!canAfford ? 'Would drop below 10 TP minimum' : 'Preview & Buy'}
                                  style={{ padding: '6px 10px', fontSize: 11, background: canAfford ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.08)', color: canAfford ? '#000' : 'var(--text-muted)', opacity: canAfford ? 1 : 0.5, cursor: canAfford ? 'pointer' : 'not-allowed' }}>
                                  <i className="fa-solid fa-eye" style={{ marginRight: 4 }} />Preview
                                </button>
                              )
                            }
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* INVENTORY TAB */}
              {tab === 'inventory' && (
                purchases.length === 0
                  ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-box-open" style={{ fontSize: 48, marginBottom: 16, display: 'block', opacity: 0.3 }} />
                      Nothing owned yet. Check out the shop!
                    </div>
                  : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                      {purchases.map(p => (
                        <div key={p.id} style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 10, padding: 14 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.shop_items.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--cyber-cyan)', textTransform: 'uppercase', fontWeight: 600, marginTop: 4 }}>{p.shop_items.type?.replace('_', ' ')}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            Purchased {new Date(p.purchased_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
              )}
            </>
          )}

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(0,240,255,0.2)' }}>
            <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      </div>

      {/* Buy Preview Modal */}
      {previewItem && (
        <BuyPreviewModal
          item={previewItem}
          user={user}
          trustPoints={trustPoints}
          onConfirm={confirmBuy}
          onCancel={() => setPreviewItem(null)}
          buying={buying}
        />
      )}
    </>
  );
}
