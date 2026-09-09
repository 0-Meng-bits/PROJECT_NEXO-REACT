import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function TaskBoard({ channelId, canManage, currentUserId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' });

  useEffect(() => {
    loadTasks();
    
    // Real-time subscription
    const channel = supabase
      .channel(`tasks:${channelId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_items',
        filter: `channel_id=eq.${channelId}`
      }, () => {
        loadTasks();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [channelId]);

  const loadTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('task_items')
      .select('*, assigned_user:assigned_to(full_name, ctu_id), creator:created_by(full_name)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false });

    if (!error) setTasks(data || []);
    setLoading(false);
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;

    console.log('Creating task with:', {
      channel_id: channelId,
      created_by: currentUserId,
      user: (await supabase.auth.getUser()).data.user?.id
    });

    const { data, error } = await supabase
      .from('task_items')
      .insert([{
        channel_id: channelId,
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        priority: newTask.priority,
        status: 'todo',
        created_by: currentUserId
      }])
      .select();

    if (error) {
      console.error('Task creation error:', error);
      alert('Failed to create task: ' + error.message);
      return;
    }

    console.log('Task created successfully:', data);
    setNewTask({ title: '', description: '', priority: 'medium' });
    setShowAddTask(false);
    loadTasks();
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    const updateData = { 
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === 'done') {
      updateData.completed_at = new Date().toISOString();
    }

    await supabase
      .from('task_items')
      .update(updateData)
      .eq('id', taskId);
    
    loadTasks();
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    await supabase.from('task_items').delete().eq('id', taskId);
    loadTasks();
  };

  const tasksByStatus = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    done: tasks.filter(t => t.status === 'done')
  };

  const priorityColors = {
    low: 'var(--green)',
    medium: 'var(--cyber-yellow)',
    high: 'var(--red)'
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading tasks...</div>;
  }

  return (
    <div style={{ padding: 20, height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, color: 'var(--cyber-cyan)' }}>
          <i className="fa-solid fa-list-check" style={{ marginRight: 8 }}></i>
          Task Board
        </h3>
        {canManage && (
          <button 
            className="cyber-btn"
            onClick={() => setShowAddTask(true)}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i>
            Add Task
          </button>
        )}
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="modal-overlay" onClick={() => setShowAddTask(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3 style={{ marginBottom: 16, color: 'var(--cyber-cyan)' }}>New Task</h3>
            
            <div className="input-group">
              <label>TITLE</label>
              <input
                type="text"
                value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title"
                autoFocus
              />
            </div>

            <div className="input-group">
              <label>DESCRIPTION</label>
              <textarea
                value={newTask.description}
                onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Task details..."
                rows={4}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, padding: 10, color: 'white', fontFamily: 'inherit' }}
              />
            </div>

            <div className="input-group">
              <label>PRIORITY</label>
              <select
                value={newTask.priority}
                onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                style={{ width: '100%', padding: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, color: 'white' }}
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="cyber-btn" onClick={addTask} disabled={!newTask.title.trim()}>
                <i className="fa-solid fa-check" style={{ marginRight: 6 }}></i>
                Create Task
              </button>
              <button className="cyber-btn secondary" onClick={() => setShowAddTask(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, minHeight: 400 }}>
        {/* TODO Column */}
        <div>
          <div style={{ background: 'rgba(148,163,184,0.1)', padding: '8px 12px', borderRadius: '8px 8px 0 0', borderBottom: '2px solid var(--text-muted)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)' }}>
              📋 TO DO ({tasksByStatus.todo.length})
            </div>
          </div>
          <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tasksByStatus.todo.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onStatusChange={updateTaskStatus}
                onDelete={deleteTask}
                canManage={canManage}
                priorityColors={priorityColors}
              />
            ))}
            {tasksByStatus.todo.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No tasks
              </div>
            )}
          </div>
        </div>

        {/* IN PROGRESS Column */}
        <div>
          <div style={{ background: 'rgba(252,238,10,0.1)', padding: '8px 12px', borderRadius: '8px 8px 0 0', borderBottom: '2px solid var(--cyber-yellow)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--cyber-yellow)' }}>
              🚀 IN PROGRESS ({tasksByStatus.in_progress.length})
            </div>
          </div>
          <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tasksByStatus.in_progress.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onStatusChange={updateTaskStatus}
                onDelete={deleteTask}
                canManage={canManage}
                priorityColors={priorityColors}
              />
            ))}
            {tasksByStatus.in_progress.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No tasks
              </div>
            )}
          </div>
        </div>

        {/* DONE Column */}
        <div>
          <div style={{ background: 'rgba(62,207,142,0.1)', padding: '8px 12px', borderRadius: '8px 8px 0 0', borderBottom: '2px solid var(--green)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--green)' }}>
              ✅ DONE ({tasksByStatus.done.length})
            </div>
          </div>
          <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tasksByStatus.done.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onStatusChange={updateTaskStatus}
                onDelete={deleteTask}
                canManage={canManage}
                priorityColors={priorityColors}
              />
            ))}
            {tasksByStatus.done.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No tasks
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onStatusChange, onDelete, canManage, priorityColors }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div 
      style={{
        background: 'rgba(0,240,255,0.05)',
        border: '1px solid rgba(0,240,255,0.2)',
        borderLeft: `3px solid ${priorityColors[task.priority]}`,
        borderRadius: 8,
        padding: 12,
        position: 'relative'
      }}
    >
      {/* Priority Badge */}
      <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, padding: '2px 6px', borderRadius: 10, background: `${priorityColors[task.priority]}22`, color: priorityColors[task.priority], textTransform: 'uppercase', fontWeight: 700 }}>
        {task.priority}
      </div>

      {/* Title */}
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, paddingRight: 50 }}>
        {task.title}
      </div>

      {/* Description */}
      {task.description && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>
          {task.description}
        </div>
      )}

      {/* Creator */}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
        by {task.creator?.full_name || 'Unknown'}
      </div>

      {/* Status Buttons */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {task.status !== 'todo' && (
          <button
            onClick={() => onStatusChange(task.id, 'todo')}
            style={{ flex: 1, padding: '4px 8px', fontSize: 10, background: 'rgba(148,163,184,0.2)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            📋 To Do
          </button>
        )}
        {task.status !== 'in_progress' && (
          <button
            onClick={() => onStatusChange(task.id, 'in_progress')}
            style={{ flex: 1, padding: '4px 8px', fontSize: 10, background: 'rgba(252,238,10,0.1)', border: '1px solid rgba(252,238,10,0.3)', borderRadius: 4, color: 'var(--cyber-yellow)', cursor: 'pointer' }}
          >
            🚀 Progress
          </button>
        )}
        {task.status !== 'done' && (
          <button
            onClick={() => onStatusChange(task.id, 'done')}
            style={{ flex: 1, padding: '4px 8px', fontSize: 10, background: 'rgba(62,207,142,0.1)', border: '1px solid rgba(62,207,142,0.3)', borderRadius: 4, color: 'var(--green)', cursor: 'pointer' }}
          >
            ✅ Done
          </button>
        )}
        {canManage && (
          <button
            onClick={() => onDelete(task.id)}
            style={{ padding: '4px 8px', fontSize: 10, background: 'rgba(247,95,95,0.1)', border: '1px solid rgba(247,95,95,0.3)', borderRadius: 4, color: 'var(--red)', cursor: 'pointer' }}
          >
            <i className="fa-solid fa-trash"></i>
          </button>
        )}
      </div>
    </div>
  );
}
