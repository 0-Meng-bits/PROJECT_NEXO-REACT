import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { NEXO_YOUTUBE_EMBED_URL } from '../lib/constants';
import VideoEmbed from './VideoEmbed';

// -- GUIDE STEPS ---------------------------------------------------------------
const GUIDE_STEPS = [
  {
    icon: 'fa-solid fa-circle-nodes',
    title: 'Welcome to NEXO Connect',
    desc: 'NEXO Connect is your campus community platform — connect with classmates, join circles, and stay updated with campus life.',
  },
  {
    icon: 'fa-solid fa-house-chimney',
    title: 'Home Feed',
    desc: 'The Home Feed is your campus bulletin board. Here you\'ll find announcements, events, shoutouts, polls, and general posts from the campus community.',
  },
  {
    icon: 'fa-solid fa-message',
    title: 'Global Feed',
    desc: 'A campus-wide chat open to all verified users. Send messages, share media, react to messages, and reply to specific chats in real time.',
  },
  {
    icon: 'fa-solid fa-compass',
    title: 'Explore Circles',
    desc: 'Circles are groups built around interests, projects, or academic topics. Browse by category and send a join request to become a member.',
  },
  {
    icon: 'fa-solid fa-users',
    title: 'Circle Chat',
    desc: 'Once you\'re a member of a circle, you get access to its private chat, announcements, channels, and task boards — exclusive to members only.',
  },
  {
    icon: 'fa-solid fa-user-circle',
    title: 'Profile & Shop',
    desc: 'Customize your profile with avatar borders, badges, name colors, and backgrounds from the shop. Spend Trust Points earned through positive participation.',
  },
  {
    icon: 'fa-solid fa-star',
    title: 'Trust Points',
    desc: 'Trust Points are earned by being active and helpful. They can be spent in the shop for customizations. Violating community rules will reduce your points.',
  },
];

// -- FAQ DATA ------------------------------------------------------------------
const FAQS = [
  {
    q: 'How do I join a circle?',
    a: 'Go to Explore Circles, find a circle you\'re interested in, and click the "Request to Join" button. The circle leader will review your application.',
  },
  {
    q: 'Why is my account still pending?',
    a: 'Your account needs to be verified by an admin. This is usually done within 24 hours. If it\'s been longer, submit a support ticket below.',
  },
  {
    q: 'How do I earn Trust Points?',
    a: 'You earn Trust Points by participating positively — posting in feeds, contributing to circles, and receiving appreciation from other members. Points can also be awarded by circle leaders.',
  },
  {
    q: 'What happens if I get flagged?',
    a: 'If your content is flagged and reviewed by an admin, you may receive a warning. Repeated violations can result in reduced trust points or account suspension.',
  },
  {
    q: 'Can I create my own circle?',
    a: 'Yes. Click the "+" button in the circle dock on the left sidebar to create a circle. Fill in the details and submit — it will be visible to others once created.',
  },
  {
    q: 'What is the difference between Global Feed and Circle Chat?',
    a: 'Global Feed is a campus-wide chat open to all verified users. Circle Chat is a private chat only accessible to members of that specific circle.',
  },
  {
    q: 'How do I apply for a position in a circle?',
    a: 'Some circles have an application process. When you request to join, you may be asked to answer questions. The circle leader reviews submissions and approves or rejects them.',
  },
  {
    q: 'Can I post anonymously?',
    a: 'Yes, when creating a post in the Home Feed, toggle the "Post as me" button to switch to anonymous mode before submitting.',
  },
  {
    q: 'How do I report a user or content?',
    a: 'Hover or tap on any message or post to see the report button (flag icon). For account issues, use the Contact Support tab in this Help center.',
  },
  {
    q: 'What are channels inside a circle?',
    a: 'Channels are sub-spaces inside a circle for specific topics or tasks. Circle leaders can create chat channels or task board channels for better organization.',
  },
];

// -- HELP MODAL ----------------------------------------------------------------
export default function HelpModal({ user, onClose }) {
  const [tab, setTab] = useState('guide');
  const [step, setStep] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);
  const [faqSearch, setFaqSearch] = useState('');
  const [ticketCategory, setTicketCategory] = useState('General Question');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const filteredFaqs = FAQS.filter(f =>
    f.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
    f.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  const submitTicket = async () => {
    if (!ticketMessage.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('support_tickets').insert([{
      user_id: user.id,
      category: ticketCategory,
      message: ticketMessage.trim(),
      status: 'open',
    }]);
    setSubmitting(false);
    if (!error) {
      setSubmitted(true);
      setTicketMessage('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--cyber-cyan)', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
              <i className="fa-solid fa-circle-question"></i> HELP CENTER
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[['guide','fa-solid fa-book-open','Guide'],['video','fa-solid fa-circle-play','Video'],['faq','fa-solid fa-circle-question','FAQ'],['contact','fa-solid fa-headset','Support']].map(([id, icon, label]) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ flex: 1, padding: '8px 0', background: tab === id ? 'rgba(0,240,255,0.1)' : 'none', border: 'none', borderBottom: `2px solid ${tab === id ? 'var(--cyber-cyan)' : 'transparent'}`, color: tab === id ? 'var(--cyber-cyan)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: '0.15s' }}>
                <i className={icon}></i> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* GUIDE TAB */}
          {tab === 'guide' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Step indicator */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
                {GUIDE_STEPS.map((_, i) => (
                  <div key={i} onClick={() => setStep(i)} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, background: i === step ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.15)', cursor: 'pointer', transition: 'all 0.2s' }} />
                ))}
              </div>
              {/* Step content */}
              <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 10px' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(0,240,255,0.1)', border: '2px solid rgba(0,240,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'var(--cyber-cyan)', overflow: 'hidden' }}>
                  {step === 0
                    ? <img src="/logoo.png" alt="NEXO" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : <i className={GUIDE_STEPS[step].icon}></i>
                  }
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'white', margin: 0 }}>{GUIDE_STEPS[step].title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 400, margin: 0 }}>{GUIDE_STEPS[step].desc}</p>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Step {step + 1} of {GUIDE_STEPS.length}</div>
              </div>
              {/* Navigation */}
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
                  style={{ flex: 1, padding: '10px 0', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: step === 0 ? 'var(--text-muted)' : 'white', cursor: step === 0 ? 'default' : 'pointer', fontSize: 13 }}>
                  <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }}></i>Previous
                </button>
                {step < GUIDE_STEPS.length - 1 ? (
                  <button onClick={() => setStep(s => s + 1)}
                    style={{ flex: 1, padding: '10px 0', background: 'rgba(0,240,255,0.15)', border: '1px solid var(--cyber-cyan)', borderRadius: 8, color: 'var(--cyber-cyan)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                    Next<i className="fa-solid fa-arrow-right" style={{ marginLeft: 6 }}></i>
                  </button>
                ) : (
                  <button onClick={() => setTab('faq')}
                    style={{ flex: 1, padding: '10px 0', background: 'rgba(0,240,255,0.2)', border: '1px solid var(--cyber-cyan)', borderRadius: 8, color: 'var(--cyber-cyan)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                    <i className="fa-solid fa-check" style={{ marginRight: 6 }}></i>Done
                  </button>
                )}
              </div>
            </div>
          )}

          {/* VIDEO TAB */}
          {tab === 'video' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Watch this short tutorial to get familiar with all the features of NEXO Connect.
              </p>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,240,255,0.2)' }}>
                <VideoEmbed />
              </div>
            </div>
          )}

          {/* FAQ TAB */}
          {tab === 'faq' && (
            <div>
              <input value={faqSearch} onChange={e => setFaqSearch(e.target.value)}
                placeholder="Search questions..." autoFocus
                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, marginBottom: 16, boxSizing: 'border-box', outline: 'none' }} />
              {filteredFaqs.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>
                  No questions found. Try the Contact Support tab.
                </div>
              )}
              {filteredFaqs.map((f, i) => (
                <div key={i} style={{ marginBottom: 8, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ width: '100%', padding: '12px 16px', background: openFaq === i ? 'rgba(0,240,255,0.07)' : 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', color: 'white', fontSize: 13, fontWeight: 600 }}>
                    <span>{f.q}</span>
                    <i className={`fa-solid fa-chevron-${openFaq === i ? 'up' : 'down'}`} style={{ color: 'var(--cyber-cyan)', fontSize: 11, flexShrink: 0, marginLeft: 10 }}></i>
                  </button>
                  {openFaq === i && (
                    <div style={{ padding: '10px 16px 14px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, background: 'rgba(0,240,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {f.a}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                Can't find your answer? <button onClick={() => setTab('contact')} style={{ background: 'none', border: 'none', color: 'var(--cyber-cyan)', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>Contact Support →</button>
              </div>
            </div>
          )}

          {/* CONTACT TAB */}
          {tab === 'contact' && (
            <div>
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <i className="fa-solid fa-circle-check" style={{ fontSize: 48, color: 'var(--green)', marginBottom: 16, display: 'block' }}></i>
                  <h3 style={{ color: 'white', marginBottom: 8 }}>Ticket Submitted</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>An admin will review your request and respond accordingly. Thank you for reaching out.</p>
                  <button onClick={() => setSubmitted(false)} style={{ marginTop: 16, padding: '8px 20px', background: 'rgba(0,240,255,0.1)', border: '1px solid var(--cyber-cyan)', borderRadius: 8, color: 'var(--cyber-cyan)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    Submit Another
                  </button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                    Having a problem with the system or your account? Send a message to our admin team and we'll get back to you.
                  </p>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, fontWeight: 700, display: 'block', marginBottom: 6 }}>CATEGORY</label>
                    <select value={ticketCategory} onChange={e => setTicketCategory(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                      <option>General Question</option>
                      <option>Account Issue</option>
                      <option>Bug Report</option>
                      <option>Circle Problem</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, fontWeight: 700, display: 'block', marginBottom: 6 }}>MESSAGE</label>
                    <textarea value={ticketMessage} onChange={e => setTicketMessage(e.target.value)}
                      placeholder="Describe your issue or question in detail..."
                      rows={5}
                      style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>
                  <button onClick={submitTicket} disabled={submitting || !ticketMessage.trim()}
                    style={{ width: '100%', padding: '12px 0', background: ticketMessage.trim() ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${ticketMessage.trim() ? 'var(--cyber-cyan)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: ticketMessage.trim() ? 'var(--cyber-cyan)' : 'var(--text-muted)', cursor: ticketMessage.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 700 }}>
                    {submitting ? <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Submitting...</> : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 8 }}></i>Submit Ticket</>}
                  </button>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
