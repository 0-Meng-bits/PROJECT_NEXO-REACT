import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── STATUS HELPERS ────────────────────────────────────────────────────────────
export function auditionStatusLabel(status, phase2Result) {
  if (status === 'phase2') return phase2Result ? (phase2Result === 'accepted' ? 'Accepted' : 'Rejected') : 'Phase 2 — Live Screening';
  const map = { pending: 'Under Review', accepted: 'Accepted', rejected: 'Rejected' };
  return map[status] || status;
}

export function auditionStatusColor(status, phase2Result) {
  if (status === 'phase2' && !phase2Result) return 'var(--cyber-yellow)';
  if (status === 'accepted' || phase2Result === 'accepted') return 'var(--green)';
  if (status === 'rejected' || phase2Result === 'rejected') return 'var(--red)';
  return 'var(--text-muted)';
}

// ── AUDITION FORM BUILDER (leader side, in Settings tab) ──────────────────────
export function AuditionFormBuilder({ comm, onToggle }) {
  const [enabled, setEnabled] = useState(comm.audition_enabled || false);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadQuestions = useCallback(async () => {
    const { data } = await supabase.from('audition_questions')
      .select('*').eq('community_id', comm.id).order('order_index');
    setQuestions(data || []);
    setLoading(false);
  }, [comm.id]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const toggleAudition = async () => {
    const next = !enabled;
    const { error } = await supabase.from('communities')
      .update({ audition_enabled: next }).eq('id', comm.id);
    if (!error) { setEnabled(next); onToggle(next); }
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      id: `new_${Date.now()}`, community_id: comm.id,
      question: '', type: 'text', options: [], order_index: prev.length, _new: true
    }]);
  };

  const updateQuestion = (idx, field, value) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const removeQuestion = async (idx) => {
    const q = questions[idx];
    if (!q._new) await supabase.from('audition_questions').delete().eq('id', q.id);
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const saveQuestions = async () => {
    setSaving(true);
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) continue;
      const payload = {
        community_id: comm.id, question: q.question.trim(),
        type: q.type, options: q.options || [], order_index: i
      };
      if (q._new) {
        await supabase.from('audition_questions').insert([payload]);
      } else {
        await supabase.from('audition_questions').update(payload).eq('id', q.id);
      }
    }
    await loadQuestions();
    setSaving(false);
  };

  return (
    <div className="audition-builder">
      {/* Toggle */}
      <div className="audition-toggle-row">
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'white' }}>Audition Mode</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            Require applicants to fill a form before joining this circle
          </div>
        </div>
        <button
          className={`toggle-btn ${enabled ? 'on' : ''}`}
          onClick={toggleAudition}
        >
          <span className="toggle-knob"></span>
        </button>
      </div>

      {enabled && (
        <>
          <div className="audition-section-label">
            <span>Audition Questions</span>
            <button className="adm-btn approve" onClick={addQuestion} style={{ fontSize: 11 }}>
              <i className="fa-solid fa-plus"></i> Add Question
            </button>
          </div>

          {loading ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</p> : (
            <>
              {questions.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>
                  No questions yet. Add one to get started.
                </p>
              )}
              {questions.map((q, idx) => (
                <div key={q.id} className="question-card">
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      className="question-input"
                      placeholder={`Question ${idx + 1}`}
                      value={q.question}
                      onChange={e => updateQuestion(idx, 'question', e.target.value)}
                    />
                    <select
                      className="question-type-select"
                      value={q.type}
                      onChange={e => updateQuestion(idx, 'type', e.target.value)}
                    >
                      <option value="text">Text</option>
                      <option value="choice">Multiple Choice</option>
                      <option value="file">File Upload</option>
                    </select>
                    <button className="question-remove-btn" onClick={() => removeQuestion(idx)}>
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>

                  {q.type === 'choice' && (
                    <div className="choice-options">
                      {(q.options || []).map((opt, oi) => (
                        <div key={oi} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <input
                            className="question-input"
                            placeholder={`Option ${oi + 1}`}
                            value={opt}
                            onChange={e => {
                              const opts = [...(q.options || [])];
                              opts[oi] = e.target.value;
                              updateQuestion(idx, 'options', opts);
                            }}
                          />
                          <button className="question-remove-btn" onClick={() => {
                            const opts = (q.options || []).filter((_, i) => i !== oi);
                            updateQuestion(idx, 'options', opts);
                          }}>
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      ))}
                      <button
                        style={{ fontSize: 11, color: 'var(--cyber-cyan)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                        onClick={() => updateQuestion(idx, 'options', [...(q.options || []), ''])}
                      >
                        <i className="fa-solid fa-plus" style={{ marginRight: 5 }}></i>Add Option
                      </button>
                    </div>
                  )}

                  {q.type === 'file' && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      <i className="fa-solid fa-paperclip" style={{ marginRight: 5 }}></i>
                      Applicant will upload a file for this question.
                    </p>
                  )}
                </div>
              ))}

              {questions.length > 0 && (
                <button className="cyber-btn" onClick={saveQuestions} disabled={saving} style={{ marginTop: 12, width: '100%' }}>
                  {saving ? 'Saving...' : <><i className="fa-solid fa-floppy-disk" style={{ marginRight: 6 }}></i>Save Questions</>}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── AUDITION APPLICATION FORM (applicant side) ────────────────────────────────
export function AuditionApplicationForm({ comm, applicantId, onSubmitted, onCancel }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('audition_questions')
      .select('*').eq('community_id', comm.id).order('order_index')
      .then(({ data }) => { setQuestions(data || []); setLoading(false); });
  }, [comm.id]);

  const handleFileUpload = async (questionId, file) => {
    const ext = file.name.split('.').pop();
    const path = `auditions/${comm.id}/${applicantId}/${questionId}.${ext}`;
    const { data, error } = await supabase.storage.from('audition-files').upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from('audition-files').getPublicUrl(path);
      setAnswers(prev => ({ ...prev, [questionId]: urlData.publicUrl }));
    }
  };

  const submit = async () => {
    const unanswered = questions.filter(q => q.type !== 'file' && !answers[q.id]?.trim());
    if (unanswered.length > 0) { alert('Please answer all questions.'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('audition_responses').insert([{
      community_id: comm.id, applicant_id: applicantId,
      answers, status: 'pending'
    }]);
    setSubmitting(false);
    if (!error) onSubmitted();
    else alert('Failed to submit. Please try again.');
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading form...</div>;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth: 520, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3><i className="fa-solid fa-microphone" style={{ marginRight: 8 }}></i>Apply to {comm.name}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20, marginTop: -10 }}>
          Fill out the audition form below. The circle leader will review your application.
        </p>

        {questions.map(q => (
          <div key={q.id} className="input-group">
            <label>{q.question}</label>
            {q.type === 'text' && (
              <textarea
                style={{ width: '100%', background: '#000', border: '1px solid #333', padding: 12, color: 'white', borderRadius: 6, fontFamily: 'inherit', fontSize: 13, outline: 'none', height: 80, resize: 'none' }}
                placeholder="Your answer..."
                value={answers[q.id] || ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
              />
            )}
            {q.type === 'choice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {(q.options || []).map((opt, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'white' }}>
                    <input type="radio" name={q.id} value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'file' && (
              <div>
                <input type="file" style={{ color: 'var(--text-muted)', fontSize: 12 }}
                  onChange={e => e.target.files[0] && handleFileUpload(q.id, e.target.files[0])}
                />
                {answers[q.id] && (
                  <p style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>
                    <i className="fa-solid fa-check" style={{ marginRight: 4 }}></i>File uploaded
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        <div className="modal-actions">
          <button className="cyber-btn" onClick={submit} disabled={submitting} style={{ flex: 1 }}>
            {submitting ? 'Submitting...' : <><i className="fa-solid fa-paper-plane" style={{ marginRight: 6 }}></i>Submit Application</>}
          </button>
          <button className="cyber-btn secondary" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── AUDITION REVIEW PANEL (leader side, in Requests tab) ─────────────────────
export function AuditionReviewPanel({ comm }) {
  const [responses, setResponses] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [phase2Details, setPhase2Details] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    const [rRes, qRes] = await Promise.all([
      supabase.from('audition_responses')
        .select('*, profiles(full_name, student_id)')
        .eq('community_id', comm.id)
        .order('submitted_at', { ascending: false }),
      supabase.from('audition_questions')
        .select('*').eq('community_id', comm.id).order('order_index')
    ]);
    setResponses(rRes.data || []);
    setQuestions(qRes.data || []);
    setLoading(false);
  }, [comm.id]);

  useEffect(() => { load(); }, [load]);

  const act = async (responseId, status, extra = {}) => {
    setActing(true);
    const update = { status, reviewed_at: new Date().toISOString(), ...extra };
    const { error } = await supabase.from('audition_responses').update(update).eq('id', responseId);
    if (!error) {
      // If accepted, also create the membership
      if (status === 'accepted' || extra.phase2_result === 'accepted') {
        const resp = responses.find(r => r.id === responseId);
        if (resp) {
          await supabase.from('memberships').insert([{
            community_id: comm.id, user_id: resp.applicant_id,
            rank_level: 0, status: 'active'
          }]);
        }
      }
      await load();
      setSelected(null);
      setFeedback('');
      setPhase2Details('');
    }
    setActing(false);
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Loading applications...</p>;
  if (responses.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No audition applications yet.</p>;

  return (
    <div>
      {/* Application list */}
      {!selected && responses.map(r => (
        <div key={r.id} className="audition-response-row" onClick={() => setSelected(r)}>
          <div className="member-card-avatar" style={{ width: 38, height: 38, fontSize: 13 }}>
            {r.profiles?.full_name?.[0] || '?'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'white' }}>{r.profiles?.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {r.profiles?.student_id} · {new Date(r.submitted_at).toLocaleDateString()}
            </div>
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            color: auditionStatusColor(r.status, r.phase2_result),
            border: `1px solid ${auditionStatusColor(r.status, r.phase2_result)}`,
            background: `${auditionStatusColor(r.status, r.phase2_result)}15`
          }}>
            {auditionStatusLabel(r.status, r.phase2_result)}
          </span>
          <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}></i>
        </div>
      ))}

      {/* Application detail view */}
      {selected && (
        <div>
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--cyber-cyan)', cursor: 'pointer', fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-arrow-left"></i> Back to list
          </button>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'white' }}>{selected.profiles?.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selected.profiles?.student_id}</div>
          </div>

          {/* Answers */}
          <div className="audition-section-label" style={{ marginBottom: 12 }}>
            <span>Submitted Answers</span>
          </div>
          {questions.map(q => (
            <div key={q.id} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{q.question}</div>
              {q.type === 'file' ? (
                selected.answers[q.id]
                  ? <a href={selected.answers[q.id]} target="_blank" rel="noreferrer" style={{ color: 'var(--cyber-cyan)', fontSize: 13 }}>
                      <i className="fa-solid fa-file" style={{ marginRight: 6 }}></i>View uploaded file
                    </a>
                  : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No file uploaded</span>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'white' }}>
                  {selected.answers[q.id] || '—'}
                </div>
              )}
            </div>
          ))}

          {/* Phase 2 details if applicable */}
          {selected.status === 'phase2' && selected.phase2_details && (
            <div style={{ background: 'rgba(252,238,10,0.05)', border: '1px solid rgba(252,238,10,0.2)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--cyber-yellow)', fontWeight: 700, marginBottom: 6 }}>PHASE 2 — LIVE SCREENING DETAILS</div>
              <div style={{ fontSize: 13, color: 'white' }}>{selected.phase2_details}</div>
            </div>
          )}

          {/* Feedback from leader */}
          {selected.feedback && (
            <div style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--cyber-cyan)', fontWeight: 700, marginBottom: 6 }}>LEADER FEEDBACK</div>
              <div style={{ fontSize: 13, color: 'white' }}>{selected.feedback}</div>
            </div>
          )}

          {/* Actions */}
          {(selected.status === 'pending' || (selected.status === 'phase2' && !selected.phase2_result)) && (
            <div style={{ marginTop: 20 }}>
              <div className="input-group">
                <label>{selected.status === 'phase2' ? 'PHASE 2 RESULT MESSAGE (optional)' : 'FEEDBACK / MESSAGE TO APPLICANT (optional)'}</label>
                <textarea
                  style={{ width: '100%', background: '#000', border: '1px solid #333', padding: 10, color: 'white', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, outline: 'none', height: 70, resize: 'none' }}
                  placeholder="Write a message to the applicant..."
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                />
              </div>

              {selected.status === 'pending' && (
                <div className="input-group">
                  <label>PHASE 2 SCREENING DETAILS (if advancing)</label>
                  <textarea
                    style={{ width: '100%', background: '#000', border: '1px solid #333', padding: 10, color: 'white', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, outline: 'none', height: 70, resize: 'none' }}
                    placeholder="e.g. Live audition on June 5, 2025 at 3PM — Room 201, Music Building"
                    value={phase2Details}
                    onChange={e => setPhase2Details(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selected.status === 'pending' && phase2Details.trim() && (
                  <button className="adm-btn" style={{ color: 'var(--cyber-yellow)', borderColor: 'var(--cyber-yellow)', background: 'rgba(252,238,10,0.08)' }}
                    disabled={acting}
                    onClick={() => act(selected.id, 'phase2', { phase2_details: phase2Details, feedback })}>
                    <i className="fa-solid fa-arrow-right"></i> Advance to Phase 2
                  </button>
                )}
                <button className="adm-btn approve" disabled={acting}
                  onClick={() => selected.status === 'phase2'
                    ? act(selected.id, 'phase2', { phase2_result: 'accepted', feedback })
                    : act(selected.id, 'accepted', { feedback })}>
                  <i className="fa-solid fa-check"></i> Accept
                </button>
                <button className="adm-btn reject" disabled={acting}
                  onClick={() => selected.status === 'phase2'
                    ? act(selected.id, 'phase2', { phase2_result: 'rejected', feedback })
                    : act(selected.id, 'rejected', { feedback })}>
                  <i className="fa-solid fa-xmark"></i> Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
