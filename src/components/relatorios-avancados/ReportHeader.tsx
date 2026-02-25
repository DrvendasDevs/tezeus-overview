import { Search, Download, Share2, Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ReportHeaderProps {
  viewMode: 'list' | 'bi' | 'kpis' | 'funnel';
  onViewModeChange: (mode: 'list' | 'bi' | 'kpis' | 'funnel') => void;
  onExport: () => void;
}

export function ReportHeader({
  viewMode,
  onViewModeChange,
  onExport
}: ReportHeaderProps) {
  return (
    <div className="bg-[#f3f3f3] dark:bg-[#2d2d2d] border-b border-[#d4d4d4] dark:border-gray-700 px-3 py-1.5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between shrink-0">
      <div className="flex items-center gap-2">
        <div className="flex bg-white dark:bg-[#1f1f1f] border border-[#d4d4d4] dark:border-gray-700 rounded-none p-0.5">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
            className={viewMode === 'list' ? 'h-6 px-2 text-xs rounded-none bg-[#FEF3C7] dark:bg-gray-700 text-black dark:text-white font-bold' : 'h-6 px-2 text-xs rounded-none hover:bg-gray-100 dark:hover:bg-gray-800'}
          >
            Lista
          </Button>
          <Button
            variant={viewMode === 'bi' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('bi')}
            className={viewMode === 'bi' ? 'h-6 px-2 text-xs rounded-none bg-[#FEF3C7] dark:bg-gray-700 text-black dark:text-white font-bold' : 'h-6 px-2 text-xs rounded-none hover:bg-gray-100 dark:hover.bg-gray-800'}
          >
            BI
          </Button>
          <Button
            variant={viewMode === 'kpis' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('kpis')}
            className={viewMode === 'kpis' ? 'h-6 px-2 text-xs rounded-none bg-[#FEF3C7] dark:bg-gray-700 text-black dark:text-white font-bold' : 'h-6 px-2 text-xs rounded-none hover:bg-gray-100 dark:hover.bg-gray-800'}
          >
            KPIs
          </Button>
          <Button
            variant={viewMode === 'funnel' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('funnel')}
            className={viewMode === 'funnel' ? 'h-6 px-2 text-xs rounded-none bg-[#FEF3C7] dark:bg.gray-700 text-black dark:text-white font-bold' : 'h-6 px-2 text-xs rounded-none hover:bg-gray-100 dark:hover.bg-gray-800'}
          >
            Funil
          </Button>
        </div>
      </div>
    </div>
  );
}


