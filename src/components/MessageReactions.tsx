import { Reaction } from '@/hooks/useReactions';
import { cn } from '@/lib/utils';

interface MessageReactionsProps {
  reactions: Reaction[];
  currentUserId: string | null;
  onReactionClick: (emoji: string) => void;
  isMine: boolean;
}

const MessageReactions = ({ reactions, currentUserId, onReactionClick, isMine }: MessageReactionsProps) => {
  if (reactions.length === 0) return null;

  // Group reactions by emoji
  const reactionGroups = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = {
        count: 0,
        hasCurrentUser: false
      };
    }
    acc[reaction.emoji].count++;
    if (reaction.user_id === currentUserId) {
      acc[reaction.emoji].hasCurrentUser = true;
    }
    return acc;
  }, {} as Record<string, { count: number; hasCurrentUser: boolean }>);

  return (
    <div className={cn('flex gap-1 mt-1 flex-wrap', isMine ? 'justify-end' : 'justify-start')}>
      {Object.entries(reactionGroups).map(([emoji, { count, hasCurrentUser }]) => (
        <button
          key={emoji}
          onClick={() => onReactionClick(emoji)}
          className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors',
            hasCurrentUser
              ? 'bg-primary/20 border border-primary'
              : 'bg-muted hover:bg-muted/80'
          )}
        >
          <span>{emoji}</span>
          {count > 1 && <span className="text-muted-foreground">{count}</span>}
        </button>
      ))}
    </div>
  );
};

export default MessageReactions;
