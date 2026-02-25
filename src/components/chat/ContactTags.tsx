import { useState, useEffect } from "react";
import { X, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { CONVERSATION_TAG_EVENTS, ConversationTagEventDetail } from "@/hooks/useConversationTags";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ContactTagsProps {
  contactId?: string;
  conversationId?: string;
  isDarkMode?: boolean;
  onTagRemoved?: () => void;
}

export function ContactTags({ contactId, conversationId, isDarkMode = false, onTagRemoved }: ContactTagsProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  
  const toggleTagExpansion = (tagId: string) => {
    setExpandedTags(prev => ({
      ...prev,
      [tagId]: !prev[tagId]
    }));
  };
  
  const removeTagFromExpansion = (tagId: string) => {
    setExpandedTags(prev => {
      if (!(tagId in prev)) return prev;
      const next = { ...prev };
      delete next[tagId];
      return next;
    });
  };

  const fetchContactTags = async () => {
    if (!contactId) return;
    
    try {
      const { data, error } = await supabase
        .from('contact_tags')
        .select(`
          id,
          tag_id,
          tags (
            id,
            name,
            color
          )
        `)
        .eq('contact_id', contactId);

      if (error) throw error;
      
      const contactTags = data?.map(item => item.tags).filter(Boolean) || [];
      setTags(contactTags as Tag[]);
    } catch (err) {
      console.error('Error fetching contact tags:', err);
    }
  };

  const removeTag = async (tagId: string) => {
    if (!contactId) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);

      if (error) throw error;

      if (conversationId) {
        const { error: conversationTagError } = await supabase
          .from('conversation_tags')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('tag_id', tagId);

        if (conversationTagError) {
          console.warn('Error removing conversation tag:', conversationTagError);
        }
      }
      
      setTags(prev => prev.filter(tag => tag.id !== tagId));
      removeTagFromExpansion(tagId);

      if (typeof window !== 'undefined' && conversationId) {
        const eventDetail: ConversationTagEventDetail = {
          conversationId,
          contactId,
          tagId
        };
        window.dispatchEvent(new CustomEvent(CONVERSATION_TAG_EVENTS.removed, { detail: eventDetail }));
      }

      onTagRemoved?.();
    } catch (error: any) {
      console.error('Error removing tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContactTags();
  }, [contactId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !contactId) return;

    const handleTagAdded = (event: Event) => {
      const customEvent = event as CustomEvent<ConversationTagEventDetail>;
      if (customEvent.detail?.contactId !== contactId || !customEvent.detail.tag) return;
      setTags(prev => {
        if (prev.some(tag => tag.id === customEvent.detail?.tag?.id)) {
          return prev;
        }
        return [...prev, customEvent.detail.tag];
      });
    };

    const handleTagRemoved = (event: Event) => {
      const customEvent = event as CustomEvent<ConversationTagEventDetail>;
      if (customEvent.detail?.contactId !== contactId) return;
      setTags(prev => prev.filter(tag => tag.id !== customEvent.detail.tagId));
      if (customEvent.detail?.tagId) {
        removeTagFromExpansion(customEvent.detail.tagId);
      }
    };

    window.addEventListener(CONVERSATION_TAG_EVENTS.added, handleTagAdded as EventListener);
    window.addEventListener(CONVERSATION_TAG_EVENTS.removed, handleTagRemoved as EventListener);

    return () => {
      window.removeEventListener(CONVERSATION_TAG_EVENTS.added, handleTagAdded as EventListener);
      window.removeEventListener(CONVERSATION_TAG_EVENTS.removed, handleTagRemoved as EventListener);
    };
  }, [contactId]);

  if (!contactId || tags.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map((tag) => {
        const isExpanded = expandedTags[tag.id];
        return (
          <div key={tag.id} className="flex items-center">
            {isExpanded ? (
              <Badge
                variant="outline"
                className="rounded-none border px-2 py-0.5 text-[11px] font-semibold h-5 gap-1 flex items-center"
                style={{
                  borderColor: tag.color,
                  color: tag.color,
                  backgroundColor: tag.color ? `${tag.color}99` : 'rgba(0,0,0,0.06)'
                }}
              >
                <span className="truncate max-w-[120px] text-black dark:text-white">{tag.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag.id);
                  }}
                  className="ml-1 rounded-sm hover:bg-black/10 flex items-center justify-center"
                  disabled={isLoading}
                >
                  <X className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTagExpansion(tag.id);
                  }}
                  className="ml-1 rounded-sm hover:bg-black/10 flex items-center justify-center"
                >
                  <Tag className="w-3 h-3" style={{ color: tag.color }} />
                </button>
              </Badge>
            ) : (
              <button
                onClick={() => toggleTagExpansion(tag.id)}
                className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <Tag
                  className="w-3 h-3"
                  style={{ color: tag.color }}
                  fill={tag.color}
                />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}