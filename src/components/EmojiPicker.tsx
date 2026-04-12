import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';

const COMMON_EMOJIS = ['❤️', '👍', '😂', '😍', '😮', '😢', '🎉', '🔥'];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  children?: React.ReactNode;
}

const EmojiPicker = ({ onEmojiSelect, children }: EmojiPickerProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Smile className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side="top" align="start">
        <div className="flex gap-1 flex-wrap max-w-[200px]">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onEmojiSelect(emoji)}
              className="text-xl hover:bg-muted p-1 rounded transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
