import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, HeartOff, Check, X, Loader2 } from 'lucide-react';
import { useProfileInterests } from '@/hooks/useProfileInterests';

interface SendInterestButtonProps {
  profileUserId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export const SendInterestButton = ({ 
  profileUserId, 
  variant = 'default',
  size = 'default',
  showLabel = true 
}: SendInterestButtonProps) => {
  const { sendInterest, cancelInterest, hasInterestSent, getInterestStatus } = useProfileInterests();
  const [loading, setLoading] = useState(false);

  const interestSent = hasInterestSent(profileUserId);
  const status = getInterestStatus(profileUserId);

  const handleClick = async () => {
    setLoading(true);
    try {
      if (interestSent) {
        await cancelInterest(profileUserId);
      } else {
        await sendInterest(profileUserId);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        {showLabel && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  if (interestSent) {
    if (status === 'accepted') {
      return (
        <Button 
          variant="outline" 
          size={size} 
          className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
          disabled
        >
          <Check className="h-4 w-4" />
          {showLabel && <span className="ml-2">Interest Accepted</span>}
        </Button>
      );
    }
    
    if (status === 'declined') {
      return (
        <Button 
          variant="outline" 
          size={size} 
          className="bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
          disabled
        >
          <X className="h-4 w-4" />
          {showLabel && <span className="ml-2">Interest Declined</span>}
        </Button>
      );
    }

    return (
      <Button 
        variant="outline" 
        size={size}
        onClick={handleClick}
        className="bg-pink-50 border-pink-300 text-pink-700 hover:bg-pink-100"
      >
        <HeartOff className="h-4 w-4" />
        {showLabel && <span className="ml-2">Cancel Interest</span>}
      </Button>
    );
  }

  return (
    <Button 
      variant={variant} 
      size={size}
      onClick={handleClick}
      className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
    >
      <Heart className="h-4 w-4" />
      {showLabel && <span className="ml-2">Send Interest</span>}
    </Button>
  );
};

export default SendInterestButton;
