import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { clearCustomizationCache } from '../lib/customization';
import { getApiUrl } from '../lib/api';

export default function ProfileShop({ user, onClose }) {
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('shop'); // shop | inventory | customize
  const [selectedType, setSelectedType] = useState('all');
  const [trustPoints, setTrustPoints] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      // Load user's trust points from account_status
      const { data: statusData } = await supabase
        .from('account_status')
        .select('trust_points')
        .eq('id', user.id)
        .single();
      
      setTrustPoints(statusData?.trust_points || 0);

      // Load shop items
      const itemsRes = await fetch(getApiUrl('/api/shop'), { headers });
      const itemsData = await itemsRes.json();
      setItems(itemsData);

      // Load user purchases
      const purchasesRes = await fetch(getApiUrl('/api/shop'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ action: 'get-purchases', userId: user.id })
      });
      const purchasesData = await purchasesRes.json();
      setPurchases(purchasesData);

      // Load user settings
      const settingsRes = await fetch(getApiUrl('/api/shop'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ action: 'get-settings', userId: user.id })
      });
      const settingsData = await settingsRes.json();
      setSettings(settingsData);

    } catch (err) {
      console.error('Failed to load shop:', err);
    }
    setLoading(false);
  };

  const buyItem = async (item) => {
    // Check if purchase would leave less than 10 points
    const MINIMUM_POINTS = 10;
    const pointsAfterPurchase = trustPoints - item.price;
    
    if (pointsAfterPurchase < MINIMUM_POINTS) {
      alert(`❌ Cannot purchase: You must maintain at least ${MINIMUM_POINTS} trust points.\n\nYou have: ${trustPoints} TP\nItem costs: ${item.price} TP\nYou'd have: ${pointsAfterPurchase} TP (below minimum)`);
      return;
    }

    if (!confirm(`Buy "${item.name}" for ${item.price} trust points?\n\nYou'll have ${pointsAfterPurchase} TP remaining.`)) return;

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/shop'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          action: 'buy-item',
          userId: user.id,
          itemId: item.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to buy item');
        return;
      }

      setTrustPoints(data.newPoints);
      alert(`✅ Purchased "${item.name}"!`);
      loadData();
    } catch (err) {
      alert('Network error. Please try again.');
    }
  };

  const applyItem = async (type, itemId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/api/shop'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          action: 'apply-customization',
          userId: user.id,
          type,
          itemId
        })
      });

      if (!res.ok) {
        alert('Failed to apply customization');
        return;
      }

      // Clear cache so changes are reflected immediately
      clearCustomizationCache(user.id);
      
      alert('✅ Customization applied! Refresh the page to see changes.');
      loadData();
    } catch (err) {
      alert('Network error. Please try again.');
    }
  };

  const owned = purchases.map(p => p.item_id);
  const filteredItems = selectedType === 'all' 
    ? items 
    : items.filter(i => i.type === selectedType);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--cyber-cyan)' }}>
              <i className="fa-solid fa-store" style={{ marginRight: 8 }}></i>
              Profile Shop
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Customize your profile with trust points
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>YOUR TRUST POINTS</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--cyber-yellow)' }}>
              {trustPoints}
            </div>
          </div>
        </div>

        {/* Minimum Points Notice */}
        <div style={{
          background: 'rgba(252,238,10,0.1)',
          border: '1px solid rgba(252,238,10,0.3)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <i className="fa-solid fa-info-circle" style={{ color: 'var(--cyber-yellow)', fontSize: 16 }}></i>
          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
            <strong>Minimum Balance:</strong> You must keep at least <strong style={{ color: 'var(--cyber-yellow)' }}>10 Trust Points</strong> at all times. Items that would drop you below this limit cannot be purchased.
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid rgba(0,240,255,0.2)', paddingBottom: 10 }}>
          {['shop', 'inventory', 'customize'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="cyber-btn"
              style={{
                background: tab === t ? 'var(--cyber-cyan)' : 'transparent',
                color: tab === t ? '#000' : 'var(--cyber-cyan)',
                border: `1px solid ${tab === t ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.3)'}`,
                padding: '8px 16px',
                fontSize: 12,
                textTransform: 'uppercase'
              }}
            >
              {t === 'shop' && <i className="fa-solid fa-shopping-cart" style={{ marginRight: 6 }}></i>}
              {t === 'inventory' && <i className="fa-solid fa-box" style={{ marginRight: 6 }}></i>}
              {t === 'customize' && <i className="fa-solid fa-palette" style={{ marginRight: 6 }}></i>}
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            Loading...
          </div>
        ) : (
          <>
            {/* SHOP TAB */}
            {tab === 'shop' && (
              <>
                {/* Type Filter */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {['all', 'theme', 'badge', 'name_color', 'avatar_border', 'background'].map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 11,
                        background: selectedType === type ? 'rgba(0,240,255,0.2)' : 'rgba(0,0,0,0.3)',
                        border: `1px solid ${selectedType === type ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.1)'}`,
                        color: selectedType === type ? 'var(--cyber-cyan)' : 'var(--text-muted)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {type === 'all' ? 'All Items' : type.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                {/* Items Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {filteredItems.map(item => (
                    <div
                      key={item.id}
                      style={{
                        background: 'rgba(0,240,255,0.05)',
                        border: '1px solid rgba(0,240,255,0.2)',
                        borderRadius: 10,
                        padding: 14,
                        position: 'relative'
                      }}
                    >
                      {/* Preview */}
                      {item.type === 'badge' && (
                        <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>
                          {item.preview_url}
                        </div>
                      )}
                      {item.type === 'theme' && item.css_data?.gradient && (
                        <div style={{
                          height: 60,
                          background: item.css_data.gradient,
                          borderRadius: 6,
                          marginBottom: 8
                        }}></div>
                      )}
                      {item.type === 'name_color' && (
                        <div style={{
                          fontSize: 18,
                          fontWeight: 700,
                          textAlign: 'center',
                          marginBottom: 8,
                          ...(item.css_data?.gradient 
                            ? { background: item.css_data.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                            : { color: item.css_data?.color })
                        }}>
                          {user.full_name}
                        </div>
                      )}

                      {/* Info */}
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--cyber-cyan)', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>
                        {item.type.replace('_', ' ')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                        {item.description}
                      </div>

                      {/* Price & Buy */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--cyber-yellow)' }}>
                          {item.price} <span style={{ fontSize: 10 }}>TP</span>
                        </div>
                        {owned.includes(item.id) ? (
                          <div style={{ fontSize: 11, color: 'var(--green)' }}>
                            <i className="fa-solid fa-check"></i> Owned
                          </div>
                        ) : (
                          <button
                            onClick={() => buyItem(item)}
                            className="cyber-btn"
                            style={{
                              padding: '6px 12px',
                              fontSize: 11,
                              background: (trustPoints - item.price >= 10) ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.1)',
                              color: (trustPoints - item.price >= 10) ? '#000' : 'var(--text-muted)',
                              opacity: (trustPoints - item.price >= 10) ? 1 : 0.5,
                              cursor: (trustPoints - item.price >= 10) ? 'pointer' : 'not-allowed'
                            }}
                            disabled={trustPoints - item.price < 10}
                            title={trustPoints - item.price < 10 ? 'Would drop below 10 TP minimum' : 'Buy item'}
                          >
                            Buy
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* INVENTORY TAB */}
            {tab === 'inventory' && (
              <div>
                {purchases.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-box-open" style={{ fontSize: 48, marginBottom: 16, display: 'block', opacity: 0.3 }}></i>
                    You haven't purchased anything yet. Check out the shop!
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {purchases.map(p => (
                      <div
                        key={p.id}
                        style={{
                          background: 'rgba(0,240,255,0.05)',
                          border: '1px solid rgba(0,240,255,0.2)',
                          borderRadius: 10,
                          padding: 14
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{p.shop_items.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          Purchased {new Date(p.purchased_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CUSTOMIZE TAB */}
            {tab === 'customize' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {['theme', 'badge', 'name_color', 'avatar_border', 'background'].map(type => {
                  const ownedItems = purchases.filter(p => p.shop_items.type === type);
                  const activeId = settings?.[`active_${type}`];

                  return (
                    <div key={type}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, textTransform: 'capitalize' }}>
                        {type.replace('_', ' ')}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {/* None option */}
                        <button
                          onClick={() => applyItem(type, null)}
                          style={{
                            padding: '8px 14px',
                            fontSize: 12,
                            background: !activeId ? 'var(--cyber-cyan)' : 'rgba(0,0,0,0.3)',
                            color: !activeId ? '#000' : 'var(--text-muted)',
                            border: `1px solid ${!activeId ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.2)'}`,
                            borderRadius: 6,
                            cursor: 'pointer'
                          }}
                        >
                          None
                        </button>
                        {ownedItems.map(p => (
                          <button
                            key={p.item_id}
                            onClick={() => applyItem(type, p.item_id)}
                            style={{
                              padding: '8px 14px',
                              fontSize: 12,
                              background: activeId === p.item_id ? 'var(--cyber-cyan)' : 'rgba(0,0,0,0.3)',
                              color: activeId === p.item_id ? '#000' : 'var(--text-primary)',
                              border: `1px solid ${activeId === p.item_id ? 'var(--cyber-cyan)' : 'rgba(0,240,255,0.2)'}`,
                              borderRadius: 6,
                              cursor: 'pointer'
                            }}
                          >
                            {p.shop_items.preview_url || p.shop_items.name}
                          </button>
                        ))}
                        {ownedItems.length === 0 && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 0' }}>
                            No items owned. Visit the shop!
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Close Button */}
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(0,240,255,0.2)' }}>
          <button className="cyber-btn secondary" onClick={onClose} style={{ width: '100%' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


