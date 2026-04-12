import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  partnerName: string;
}

const TypingIndicator = ({ partnerName }: TypingIndicatorProps) => {
  return (
    <div className="flex items-center gap-2 p-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-xs text-muted-foreground">{partnerName} is typing...</span>
    </div>
  );
};

export default TypingIndicator;
