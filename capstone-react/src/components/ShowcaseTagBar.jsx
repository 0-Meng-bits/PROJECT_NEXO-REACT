import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Feedback tags configuration
const FEEDBACK_TAGS = [
  { id: 'effort',    label: 'Effort',    emoji: '👏', color: '#22c55e' },
  { id: 'creative',  label: 'Creative',  emoji: '💡', color: '#a855f7' },
  { id: 'technique', label: 'Technique', emoji: '🎯', color: '#3b82f6' },
  { id: 'style',     label: 'Style',     emoji: '🎨', color: '#ec4899' },
  { id: 'impact',    label: 'Impact',    emoji: '🔥', color: '#ef4444' },
];

export default function ShowcaseTagBar({ 
  announcementId, 
  authorId, 
  communityId,
  currentUserId, 
  currentUserName,
  onShowToast
}) {
  const [tagCounts, setTagCounts] = useState({
    effort: 0, creative: 0, technique: 0, style: 0, impact: 0
  });
  const [userTags, setUserTags] = useState(new Set());
  const [loading, setLoading] = useState(false);

  // Fetch tag counts and user's applied tags
  const fetchTagData = useCallback(async () => {
    if (!announcementId) return;

    try {
      // Get all feedback tags for this announcement
      const { data, error } = await supabase
        .from('showcase_feedback')
        .select('tag_type, user_id')
        .eq('announcement_id', announcementId);

      if (error) throw error;

      // Aggregate counts
      const counts = { effort: 0, creative: 0, technique: 0, style: 0, impact: 0 };
      const userTagsSet = new Set();

      data.forEach(row => {
        counts[row.tag_type] = (counts[row.tag_type] || 0) + 1;
        if (row.user_id === currentUserId) {
          userTagsSet.add(row.tag_type);
        }
      });

      setTagCounts(counts);
      setUserTags(userTagsSet);
    } catch (err) {
      console.error('Error fetching tag data:', err);
    }
  }, [announcementId, currentUserId]);

  // Initial fetch
  useEffect(() => {
    fetchTagData();
  }, [fetchTagData]);

  // Real-time subscription for tag updates
  useEffect(() => {
    if (!announcementId) return;

    const subscription = supabase
      .channel(`showcase:${announcementId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'showcase_feedback',
          filter: `announcement_id=eq.${announcementId}`
        },
        () => {
          fetchTagData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [announcementId, fetchTagData]);

  // Apply or remove a tag
  const handleTagClick = async (tagType) => {
    if (loading) return;

    // Prevent self-tagging
    if (currentUserId === authorId) {
      onShowToast && onShowToast('You cannot tag your own showcase');
      return;
    }

    setLoading(true);

    try {
      const isApplied = userTags.has(tagType);

      if (isApplied) {
        // Remove tag
        const { error } = await supabase
          .from('showcase_feedback')
          .delete()
          .eq('announcement_id', announcementId)
          .eq('user_id', currentUserId)
          .eq('tag_type', tagType);

        if (error) throw error;

        // Update local state
        const newUserTags = new Set(userTags);
        newUserTags.delete(tagType);
        setUserTags(newUserTags);
        setTagCounts(prev => ({ ...prev, [tagType]: Math.max(0, prev[tagType] - 1) }));
      } else {
        // Validate before applying

        // Check if post is showcase type
        const { data: post, error: postError } = await supabase
          .from('announcements')
          .select('post_type')
          .eq('id', announcementId)
          .single();

        if (postError || !post) {
          throw new Error('Post not found');
        }

        if (post.post_type !== 'showcase') {
          throw new Error('Can only tag showcase posts');
        }

        // Check if user is member of community
        const { data: membership, error: memberError } = await supabase
          .from('memberships')
          .select('id')
          .eq('user_id', currentUserId)
          .eq('community_id', communityId)
          .eq('status', 'approved')
          .single();

        if (memberError || !membership) {
          throw new Error('You must be a member of this community to give feedback');
        }

        // Apply tag
        const { error } = await supabase
          .from('showcase_feedback')
          .insert({
            announcement_id: announcementId,
            user_id: currentUserId,
            tag_type: tagType
          });

        if (error) throw error;

        // Create notification for post author
        await supabase
          .from('notifications')
          .insert({
            user_id: authorId,
            type: 'showcase_feedback',
            message: `${currentUserName} gave your showcase a ${tagType} tag`,
            link_comm_id: communityId
          });

        // Update local state
        const newUserTags = new Set(userTags);
        newUserTags.add(tagType);
        setUserTags(newUserTags);
        setTagCounts(prev => ({ ...prev, [tagType]: prev[tagType] + 1 }));
      }
    } catch (err) {
      console.error('Error toggling tag:', err);
      onShowToast && onShowToast(err.message || 'Failed to update tag');
    } finally {
      setLoading(false);
    }
  };

  const isSelfTag = currentUserId === authorId;

  return (
    <div style={{ marginTop: 14, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
        FEEDBACK TAGS
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {FEEDBACK_TAGS.map(tag => {
          const count = tagCounts[tag.id] || 0;
          const isApplied = userTags.has(tag.id);
          const isDisabled = isSelfTag || loading;

          return (
            <button
              key={tag.id}
              onClick={() => handleTagClick(tag.id)}
              disabled={isDisabled}
              className={`tag-button ${isApplied ? 'applied' : ''} ${isDisabled ? 'disabled' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                border: isApplied ? `1px solid ${tag.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                background: isApplied ? `${tag.color}15` : 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-primary)',
                opacity: isDisabled ? 0.5 : 1,
                boxShadow: isApplied ? `0 0 10px ${tag.color}30` : 'none',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                if (!isDisabled) {
                  e.currentTarget.style.borderColor = tag.color;
                  e.currentTarget.style.background = `${tag.color}10`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isDisabled && !isApplied) {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                }
              }}
            >
              <span style={{ fontSize: 14 }}>{tag.emoji}</span>
              <span style={{ fontWeight: 700 }}>{count}</span>
              <span>{tag.label}</span>
            </button>
          );
        })}
      </div>
      {isSelfTag && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
          <i className="fa-solid fa-info-circle" style={{ marginRight: 4 }}></i>
          You cannot tag your own showcase
        </div>
      )}
    </div>
  );
}
