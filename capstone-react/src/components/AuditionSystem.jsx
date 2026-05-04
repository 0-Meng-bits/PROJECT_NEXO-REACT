import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function auditionStatusLabel(status, phase2Result) {
  if (status === 'phase2') return phase2Result ? (phase2Result === 'accepted' ? 'Accepted' : 'Rejected') : 'Phase 2 - Live Screening';
  const map = { pending: 'Under Review', accepted: 'Accepted', rejected: 'Rejected' };
  return map[status] || status;
}

export function auditionStatusColor(status, phase2Result) {
  if (status === 'phase2' && !phase2Result) return 'var(--cyber-yellow)';
  if (status === 'accepted' || phase2Result === 'accepted') return 'var(--green)';
  if (status === 'rejected' || phase2Result === 'rejected') return 'var(--red)';
  return 'var(--text-muted)';
}

// ── AUDITION FORM BUILDER (leader side) ──────────────────────────────────────
// Now supports multiple named auditions per circle
export function AuditionFormBuilder({ comm, onToggle }) {
  const [auditions, setAuditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedAudition, setSelectedAudition] = useState(null);
  const [newForm, setNewForm] = useState({ title: '', description: '', type: 'external', post_to_feed: false });
  const [newQuestions, setNewQuestions] = useState([]); // questions for the new audition being created
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);

  const loadAuditions = useCallback(async () => {
    const { data } = await supabase.from('auditions')
      .select('*, audition_responses(count)')
      .eq('community_id', comm.id)
      .order('created_at', { ascending: false });
    setAuditions(data || []);
    setLoading(false);
  }, [comm.id]);

  useEffect(() => { loadAuditions(); }, [loadAuditions]);

  const loadQuestions = useCallback(async (auditionId) => {
    const { data } = await supabase.from('audition_questions')
      .select('*').eq('audition_id', auditionId).order('order_index');
    setQuestions(data || []);
  }, []);

  useEffect(() => {
    if (selectedAudition) loadQuestions(selectedAudition.id);
  }, [selectedAudition, loadQuestions]);

  const createAudition = async () => {
    if (!newForm.title.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.from('auditions').insert([{
      community_id: comm.id,
      title: newForm.title.trim(),
      description: newForm.description.trim(),
      type: newForm.type,
      post_to_feed: newForm.post_to_feed,
      is_open: true,
      created_by: comm.creator_id,
    }]).select().single();

    if (!error && data) {
      // Post announcement based on type
      if (newForm.type === 'external') {
        // Always post to circle announcements
        await supabase.from('announcements').insert([{
          author_id: comm.creator_id,
          author_name: comm.name,
          author_type: 'Leader',
          title: 'Audition Open - ' + data.title,
          content: (newForm.description || 'Applications are now open. Click Apply Now to submit your application.'),
          post_type: 'announcement',
          community_id: comm.id,
        }]);
        // Optionally post to home feed
        if (newForm.post_to_feed) {
          await supabase.from('announcements').insert([{
            author_id: comm.creator_id,
            author_name: comm.name,
            author_type: 'Leader',
            title: 'Audition Open - ' + data.title + ' (' + comm.name + ')',
            content: comm.name + ' is now accepting applications for: ' + data.title + '. Visit the circle to apply.',
            post_type: 'announcement',
            community_id: null,
          }]);
        }
      } else {
        // Internal — post only to circle announcements
        await supabase.from('announcements').insert([{
          author_id: comm.creator_id,
          author_name: 'Circle Leader',
          author_type: 'Leader',
          title: 'Internal Audition Open - ' + data.title,
          content: (newForm.description || 'An internal audition is now open for current members. Click Apply Now to participate.'),
          post_type: 'announcement',
          community_id: comm.id,
        }]);
      }
      // Save questions for this audition
      for (let i = 0; i < newQuestions.length; i++) {
        const q = newQuestions[i];
        if (!q.question.trim()) continue;
        await supabase.from('audition_questions').insert([{
          community_id: comm.id,
          audition_id: data.id,
          question: q.question.trim(),
          type: q.type,
          options: q.options || [],
          order_index: i,
        }]);
      }
      // Also update community audition_enabled flag
      await supabase.from('communities').update({
        audition_enabled: true,
        internal_audition: newForm.type === 'internal',
      }).eq('id', comm.id);
      onToggle(true);
      setNewForm({ title: '', description: '', type: 'external', post_to_feed: false });
      setNewQuestions([]);
      await loadAuditions();
    }
    setCreating(false);
  };

  const toggleAuditionOpen = async (aud) => {
    await supabase.from('auditions').update({ is_open: !aud.is_open }).eq('id', aud.id);
    loadAuditions();
  };

  const deleteAudition = async (id) => {
    if (!confirm('Delete this audition and all its applications?')) return;
    await supabase.from('auditions').delete().eq('id', id);
    if (selectedAudition?.id === id) setSelectedAudition(null);
    loadAuditions();
  };

  const addNewQuestion = () => {
    setNewQuestions(prev => [...prev, { id: 'nq_' + Date.now(), question: '', type: 'text', options: [] }]);
  };

  const updateNewQuestion = (idx, field, value) => {
    setNewQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const removeNewQuestion = (idx) => {
    setNewQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      id: 'new_' + Date.now(), audition_id: selectedAudition.id,
      community_id: comm.id, question: '', type: 'text', options: [], order_index: prev.length, _new: true
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
        community_id: comm.id,
        audition_id: selectedAudition.id,
        question: q.question.trim(),
        type: q.type, options: q.options || [], order_index: i
      };
      if (q._new) {
        await supabase.from('audition_questions').insert([payload]);
      } else {
        await supabase.from('audition_questions').update(payload).eq('id', q.id);
      }
    }
    await loadQuestions(selectedAudition.id);
    setSaving(false);
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading auditions...</p>;

  // ── DETAIL VIEW (selected audition) ──
  if (selectedAudition) {
    return (
      <div className="audition-builder">
        <button onClick={() => setSelectedAudition(null)}
          style={{ background: 'none', border: 'none', color: 'var(--cyber-cyan)', cursor: 'pointer', fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fa-solid fa-arrow-left"></i> Back to all auditions
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{selectedAudition.title}</div>
            <div style={{ fontSize: 11, color: selectedAudition.type === 'internal' ? 'var(--cyber-yellow)' : 'var(--cyber-cyan)', marginTop: 4 }}>
              <i className={selectedAudition.type === 'internal' ? 'fa-solid fa-lock' : 'fa-solid fa-globe'} style={{ marginRight: 5 }}></i>
              {selectedAudition.type === 'internal' ? 'Internal (Members Only)' : 'External (Open to All)'}
              {selectedAudition.type === 'external' && selectedAudition.post_to_feed && (
                <span style={{ marginLeft: 8, color: 'var(--green)', fontSize: 10 }}>
                  <i className="fa-solid fa-bullhorn" style={{ marginRight: 4 }}></i>Posted to Home Feed
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="adm-btn" onClick={() => toggleAuditionOpen(selectedAudition)}
              style={{ color: selectedAudition.is_open ? 'var(--green)' : 'var(--text-muted)', borderColor: selectedAudition.is_open ? 'var(--green)' : '#333' }}>
              <i className={selectedAudition.is_open ? 'fa-solid fa-door-open' : 'fa-solid fa-door-closed'}></i>
              {selectedAudition.is_open ? 'Open' : 'Closed'}
            </button>
            <button className="adm-btn reject" onClick={() => deleteAudition(selectedAudition.id)}>
              <i className="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>

        <div className="audition-section-label">
          <span>Questions</span>
          <button className="adm-btn approve" onClick={addQuestion} style={{ fontSize: 11 }}>
            <i className="fa-solid fa-plus"></i> Add
          </button>
        </div>

        {questions.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>No questions yet. Add one to get started.</p>
        )}
        {questions.map((q, idx) => (
          <div key={q.id} className="question-card">
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input className="question-input" placeholder={'Question ' + (idx + 1)}
                value={q.question} onChange={e => updateQuestion(idx, 'question', e.target.value)} />
              <select className="question-type-select" value={q.type}
                onChange={e => updateQuestion(idx, 'type', e.target.value)}>
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
                    <input className="question-input" placeholder={'Option ' + (oi + 1)} value={opt}
                      onChange={e => { const opts = [...(q.options || [])]; opts[oi] = e.target.value; updateQuestion(idx, 'options', opts); }} />
                    <button className="question-remove-btn" onClick={() => {
                      updateQuestion(idx, 'options', (q.options || []).filter((_, i) => i !== oi));
                    }}><i className="fa-solid fa-xmark"></i></button>
                  </div>
                ))}
                <button style={{ fontSize: 11, color: 'var(--cyber-cyan)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                  onClick={() => updateQuestion(idx, 'options', [...(q.options || []), ''])}>
                  <i className="fa-solid fa-plus" style={{ marginRight: 5 }}></i>Add Option
                </button>
              </div>
            )}
          </div>
        ))}
        {questions.length > 0 && (
          <button className="cyber-btn" onClick={saveQuestions} disabled={saving} style={{ marginTop: 12, width: '100%' }}>
            {saving ? 'Saving...' : <><i className="fa-solid fa-floppy-disk" style={{ marginRight: 6 }}></i>Save Questions</>}
          </button>
        )}
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="audition-builder">
      {/* Create new audition form */}
      <div style={{ background: 'rgba(0,240,255,0.04)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cyber-cyan)', marginBottom: 12 }}>
          <i className="fa-solid fa-plus" style={{ marginRight: 8 }}></i>Create New Audition
        </div>
        <div className="input-group" style={{ marginBottom: 10 }}>
          <label>AUDITION TITLE</label>
          <input className="question-input" style={{ width: '100%' }}
            placeholder="e.g. Vice Leader, Dancer, Vocalist..."
            value={newForm.title}
            onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="input-group" style={{ marginBottom: 10 }}>
          <label>DESCRIPTION (optional)</label>
          <textarea style={{ width: '100%', background: '#000', border: '1px solid #333', padding: 10, color: 'white', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, outline: 'none', height: 60, resize: 'none' }}
            placeholder="What is this audition for?"
            value={newForm.description}
            onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setNewForm(f => ({ ...f, type: 'external' }))}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, transition: '0.2s',
              background: newForm.type === 'external' ? 'rgba(0,240,255,0.12)' : 'transparent',
              borderColor: newForm.type === 'external' ? 'var(--cyber-cyan)' : '#333',
              color: newForm.type === 'external' ? 'var(--cyber-cyan)' : 'var(--text-muted)' }}>
            <i className="fa-solid fa-globe" style={{ marginRight: 6 }}></i>External
            <div style={{ fontSize: 10, fontWeight: 400, marginTop: 3, opacity: 0.8 }}>Open to all students</div>
          </button>
          <button onClick={() => setNewForm(f => ({ ...f, type: 'internal' }))}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, transition: '0.2s',
              background: newForm.type === 'internal' ? 'rgba(252,238,10,0.1)' : 'transparent',
              borderColor: newForm.type === 'internal' ? 'var(--cyber-yellow)' : '#333',
              color: newForm.type === 'internal' ? 'var(--cyber-yellow)' : 'var(--text-muted)' }}>
            <i className="fa-solid fa-lock" style={{ marginRight: 6 }}></i>Internal
            <div style={{ fontSize: 10, fontWeight: 400, marginTop: 3, opacity: 0.8 }}>Members only</div>
          </button>
        </div>
        {newForm.type === 'external' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 12px', background: 'rgba(62,207,142,0.05)', border: '1px solid rgba(62,207,142,0.2)', borderRadius: 8 }}>
            <button className={'toggle-btn ' + (newForm.post_to_feed ? 'on' : '')}
              onClick={() => setNewForm(f => ({ ...f, post_to_feed: !f.post_to_feed }))}>
              <span className="toggle-knob"></span>
            </button>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
                <i className="fa-solid fa-bullhorn" style={{ marginRight: 6 }}></i>Post to Campus Home Feed
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                Announce this audition to all students on the home feed
              </div>
            </div>
          </div>
        )}
        {/* ── QUESTION BUILDER ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 14, paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 1 }}>
              <i className="fa-solid fa-list-check" style={{ marginRight: 7, color: 'var(--cyber-cyan)' }}></i>
              AUDITION QUESTIONS
            </div>
            <button className="adm-btn approve" onClick={addNewQuestion} style={{ fontSize: 11 }}>
              <i className="fa-solid fa-plus"></i> Add Question
            </button>
          </div>

          {newQuestions.length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 0' }}>
              No questions yet — applicants can still submit. Add questions to collect specific info.
            </p>
          )}

          {newQuestions.map((q, idx) => (
            <div key={q.id} className="question-card">
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="question-input" placeholder={'Question ' + (idx + 1) + ' — e.g. What is your name?'}
                  value={q.question}
                  onChange={e => updateNewQuestion(idx, 'question', e.target.value)}
                  style={{ flex: 1 }} />
                <select className="question-type-select" value={q.type}
                  onChange={e => updateNewQuestion(idx, 'type', e.target.value)}>
                  <option value="text">Essay / Text</option>
                  <option value="choice">Multiple Choice</option>
                  <option value="file">File Upload</option>
                </select>
                <button className="question-remove-btn" onClick={() => removeNewQuestion(idx)}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {q.type === 'choice' && (
                <div className="choice-options">
                  {(q.options || []).map((opt, oi) => (
                    <div key={oi} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input className="question-input" placeholder={'Option ' + (oi + 1)} value={opt}
                        onChange={e => {
                          const opts = [...(q.options || [])];
                          opts[oi] = e.target.value;
                          updateNewQuestion(idx, 'options', opts);
                        }} />
                      <button className="question-remove-btn"
                        onClick={() => updateNewQuestion(idx, 'options', (q.options || []).filter((_, i) => i !== oi))}>
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ))}
                  <button style={{ fontSize: 11, color: 'var(--cyber-cyan)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                    onClick={() => updateNewQuestion(idx, 'options', [...(q.options || []), ''])}>
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

              {q.type === 'text' && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  <i className="fa-solid fa-pen-to-square" style={{ marginRight: 5 }}></i>
                  Applicant will write a text/essay answer.
                </p>
              )}
            </div>
          ))}
        </div>

        <button className="cyber-btn" onClick={createAudition} disabled={creating || !newForm.title.trim()} style={{ width: '100%', marginTop: 14 }}>
          {creating ? 'Creating...' : <><i className="fa-solid fa-microphone" style={{ marginRight: 6 }}></i>Create Audition</>}
        </button>
      </div>

      {/* Audition list */}
      <div className="audition-section-label">
        <span>All Auditions ({auditions.length})</span>
      </div>
      {auditions.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>No auditions yet. Create one above.</p>
      ) : (
        auditions.map(aud => {
          const count = aud.audition_responses?.[0]?.count || 0;
          return (
            <div key={aud.id} className="audition-response-row" onClick={() => setSelectedAudition(aud)}
              style={{ cursor: 'pointer' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: aud.type === 'internal' ? 'rgba(252,238,10,0.15)' : 'rgba(0,240,255,0.15)', border: '1px solid ' + (aud.type === 'internal' ? 'var(--cyber-yellow)' : 'var(--cyber-cyan)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: aud.type === 'internal' ? 'var(--cyber-yellow)' : 'var(--cyber-cyan)', flexShrink: 0 }}>
                <i className={aud.type === 'internal' ? 'fa-solid fa-lock' : 'fa-solid fa-globe'}></i>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{aud.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {aud.type === 'internal' ? 'Internal' : 'External'} · {count} applicant{count !== 1 ? 's' : ''}
                  {aud.type === 'external' && aud.post_to_feed && <span style={{ marginLeft: 8, color: 'var(--green)' }}><i className="fa-solid fa-bullhorn" style={{ marginRight: 3 }}></i>On feed</span>}
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: aud.is_open ? 'var(--green)' : 'var(--text-muted)', border: '1px solid ' + (aud.is_open ? 'var(--green)' : '#333'), background: aud.is_open ? 'rgba(62,207,142,0.08)' : 'transparent' }}>
                {aud.is_open ? 'OPEN' : 'CLOSED'}
              </span>
              <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}></i>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── AUDITION APPLICATION FORM (applicant side) ────────────────────────────────
// Now accepts an audition object with audition_id
export function AuditionApplicationForm({ comm, audition, applicantId, onSubmitted, onCancel }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Load questions for this specific audition if audition_id exists, else fall back to community
    const query = audition?.id
      ? supabase.from('audition_questions').select('*').eq('audition_id', audition.id).order('order_index')
      : supabase.from('audition_questions').select('*').eq('community_id', comm.id).order('order_index');
    query.then(({ data }) => { setQuestions(data || []); setLoading(false); });
  }, [comm.id, audition]);

  const handleFileUpload = async (questionId, file) => {
    const ext = file.name.split('.').pop();
    const path = 'auditions/' + comm.id + '/' + applicantId + '/' + questionId + '.' + ext;
    const { error } = await supabase.storage.from('audition-files').upload(path, file, { upsert: true });
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
      community_id: comm.id,
      audition_id: audition?.id || null,
      applicant_id: applicantId,
      answers,
      status: 'pending',
    }]);
    setSubmitting(false);
    if (!error) onSubmitted();
    else alert('Failed to submit. Please try again.');
  };

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading form...</div>;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth: 520, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3><i className="fa-solid fa-microphone" style={{ marginRight: 8 }}></i>
          {audition ? audition.title : 'Apply to ' + comm.name}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20, marginTop: -10 }}>
          {audition?.description || 'Fill out the form below. The circle leader will review your application.'}
        </p>
        {questions.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
            No questions set yet. You can still submit your application.
          </p>
        )}
        {questions.map(q => (
          <div key={q.id} className="input-group">
            <label>{q.question}</label>
            {q.type === 'text' && (
              <textarea style={{ width: '100%', background: '#000', border: '1px solid #333', padding: 12, color: 'white', borderRadius: 6, fontFamily: 'inherit', fontSize: 13, outline: 'none', height: 80, resize: 'none' }}
                placeholder="Your answer..."
                value={answers[q.id] || ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} />
            )}
            {q.type === 'choice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {(q.options || []).map((opt, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'white' }}>
                    <input type="radio" name={q.id} value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))} />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {q.type === 'file' && (
              <div>
                <input type="file" style={{ color: 'var(--text-muted)', fontSize: 12 }}
                  onChange={e => e.target.files[0] && handleFileUpload(q.id, e.target.files[0])} />
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

// ── AUDITION REVIEW PANEL (leader side) ──────────────────────────────────────
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
        .select('*, profiles(full_name, student_id), auditions(title)')
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
      const resp = responses.find(r => r.id === responseId);
      if (status === 'accepted' || extra.phase2_result === 'accepted') {
        if (resp) {
          await supabase.from('memberships').insert([{
            community_id: comm.id, user_id: resp.applicant_id, rank_level: 0, status: 'active'
          }]);
        }
      }
      if (resp?.applicant_id) {
        let message = '';
        const audTitle = resp.auditions?.title || comm.name;
        if (status === 'phase2') message = 'Your audition for "' + audTitle + '" passed Phase 1! Check your application for live screening details.';
        else if (status === 'accepted') message = 'Congratulations! Your audition for "' + audTitle + '" has been accepted.';
        else if (status === 'rejected') message = 'Your audition application for "' + audTitle + '" was not accepted this time.';
        else if (extra.phase2_result === 'accepted') message = 'Congratulations! You passed the live screening for "' + audTitle + '" and are now a member.';
        else if (extra.phase2_result === 'rejected') message = 'Your live screening for "' + audTitle + '" was not successful this time.';
        if (message) {
          await supabase.from('notifications').insert([{
            user_id: resp.applicant_id, type: 'audition_update', message, link_comm_id: comm.id,
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
      {!selected && responses.map(r => (
        <div key={r.id} className="audition-response-row" onClick={() => setSelected(r)}>
          <div className="member-card-avatar" style={{ width: 38, height: 38, fontSize: 13 }}>
            {r.profiles?.full_name?.[0] || '?'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{r.profiles?.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {r.profiles?.student_id} · {r.auditions?.title || 'General'} · {new Date(r.submitted_at).toLocaleDateString()}
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            color: auditionStatusColor(r.status, r.phase2_result),
            border: '1px solid ' + auditionStatusColor(r.status, r.phase2_result),
            background: auditionStatusColor(r.status, r.phase2_result) + '15' }}>
            {auditionStatusLabel(r.status, r.phase2_result)}
          </span>
          <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}></i>
        </div>
      ))}

      {selected && (
        <div>
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--cyber-cyan)', cursor: 'pointer', fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-arrow-left"></i> Back to list
          </button>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{selected.profiles?.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selected.profiles?.student_id} · {selected.auditions?.title || 'General Audition'}</div>
          </div>
          <div className="audition-section-label" style={{ marginBottom: 12 }}><span>Submitted Answers</span></div>
          {questions.filter(q => !q.audition_id || q.audition_id === selected.audition_id).map(q => (
            <div key={q.id} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{q.question}</div>
              {q.type === 'file' ? (
                selected.answers[q.id]
                  ? <a href={selected.answers[q.id]} target="_blank" rel="noreferrer" style={{ color: 'var(--cyber-cyan)', fontSize: 13 }}>
                      <i className="fa-solid fa-file" style={{ marginRight: 6 }}></i>View uploaded file
                    </a>
                  : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No file uploaded</span>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)' }}>
                  {selected.answers?.[q.id] || '—'}
                </div>
              )}
            </div>
          ))}
          {selected.status === 'phase2' && selected.phase2_details && (
            <div style={{ background: 'rgba(252,238,10,0.05)', border: '1px solid rgba(252,238,10,0.2)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--cyber-yellow)', fontWeight: 700, marginBottom: 6 }}>PHASE 2 - LIVE SCREENING DETAILS</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selected.phase2_details}</div>
            </div>
          )}
          {selected.feedback && (
            <div style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--cyber-cyan)', fontWeight: 700, marginBottom: 6 }}>LEADER FEEDBACK</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selected.feedback}</div>
            </div>
          )}
          {(selected.status === 'pending' || (selected.status === 'phase2' && !selected.phase2_result)) && (
            <div style={{ marginTop: 20 }}>
              <div className="input-group">
                <label>{selected.status === 'phase2' ? 'PHASE 2 RESULT MESSAGE (optional)' : 'FEEDBACK (optional)'}</label>
                <textarea style={{ width: '100%', background: '#000', border: '1px solid #333', padding: 10, color: 'white', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, outline: 'none', height: 70, resize: 'none' }}
                  placeholder="Write a message to the applicant..."
                  value={feedback} onChange={e => setFeedback(e.target.value)} />
              </div>
              {selected.status === 'pending' && (
                <div className="input-group">
                  <label>PHASE 2 SCREENING DETAILS (if advancing)</label>
                  <textarea style={{ width: '100%', background: '#000', border: '1px solid #333', padding: 10, color: 'white', borderRadius: 6, fontFamily: 'inherit', fontSize: 12, outline: 'none', height: 70, resize: 'none' }}
                    placeholder="e.g. Live audition on June 5 at 3PM - Room 201"
                    value={phase2Details} onChange={e => setPhase2Details(e.target.value)} />
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

