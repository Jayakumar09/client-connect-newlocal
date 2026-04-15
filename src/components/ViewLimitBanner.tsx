import { Button } from '@/components/ui/button';
import { Crown, Eye, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ViewLimitBannerProps {
  remainingViews: number;
  maxViews: number;
  isPaidUser: boolean;
}

export const ViewLimitBanner = ({ remainingViews, maxViews, isPaidUser }: ViewLimitBannerProps) => {
  const navigate = useNavigate();
  const upgradeEnabled = import.meta.env.VITE_ENABLE_UPGRADE === 'true';

  if (isPaidUser || !upgradeEnabled) return null;

  const isLow = remainingViews <= 3;
  const isExhausted = remainingViews <= 0;

  if (isExhausted) {
    return (
      <div className="bg-gradient-to-r from-red-100 to-orange-100 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-200 rounded-full">
              <Lock className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h4 className="font-semibold text-red-800">Daily View Limit Reached</h4>
              <p className="text-sm text-red-600">
                You've viewed {maxViews} profiles today. Upgrade for unlimited access!
              </p>
            </div>
          </div>
          <Button 
            onClick={() => navigate('/plans')}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Crown className="h-4 w-4 mr-2" />
            Upgrade Now
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isLow ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200' : 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200'} border rounded-lg p-3 mb-6`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Eye className={`h-4 w-4 ${isLow ? 'text-yellow-600' : 'text-blue-600'}`} />
          <span className={`text-sm ${isLow ? 'text-yellow-700' : 'text-blue-700'}`}>
            <strong>{remainingViews}</strong> of {maxViews} daily views remaining
          </span>
        </div>
        <Button 
          variant="outline"
          size="sm"
          onClick={() => navigate('/plans')}
          className="text-purple-600 border-purple-200 hover:bg-purple-50"
        >
          <Crown className="h-3 w-3 mr-1" />
          Get Unlimited Views
        </Button>
      </div>
    </div>
  );
};

export default ViewLimitBanner;
