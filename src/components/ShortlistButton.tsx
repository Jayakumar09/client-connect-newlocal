import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useShortlist } from '@/hooks/useShortlist';

interface ShortlistButtonProps {
  profileUserId: string;
  className?: string;
  variant?: 'icon' | 'full';
}

const ShortlistButton = ({ profileUserId, className, variant = 'icon' }: ShortlistButtonProps) => {
  const { isShortlisted, toggleShortlist } = useShortlist();
  const shortlisted = isShortlisted(profileUserId);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleShortlist(profileUserId);
  };

  if (variant === 'full') {
    return (
      <Button
        variant={shortlisted ? 'default' : 'outline'}
        onClick={handleClick}
        className={cn(
          shortlisted && 'bg-pink-500 hover:bg-pink-600 text-white',
          className
        )}
      >
        <Heart className={cn('h-4 w-4 mr-2', shortlisted && 'fill-current')} />
        {shortlisted ? 'Shortlisted' : 'Add to Shortlist'}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className={cn(
        'h-8 w-8 rounded-full',
        shortlisted ? 'text-pink-500 hover:text-pink-600' : 'text-muted-foreground hover:text-pink-500',
        className
      )}
    >
      <Heart className={cn('h-5 w-5', shortlisted && 'fill-current')} />
    </Button>
  );
};

export default ShortlistButton;
