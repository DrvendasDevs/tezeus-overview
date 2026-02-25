import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as LucideIcons from "lucide-react";
import { LucideIcon } from "lucide-react";

// Ícones mais comuns para pipelines de vendas/CRM
const PIPELINE_ICONS = [
  'Handshake', 'MapPin', 'DollarSign', 'FileText', 'Home',
  'Target', 'TrendingUp', 'CheckCircle2', 'Users', 'Phone',
  'Mail', 'Calendar', 'Clock', 'Star', 'Award',
  'Briefcase', 'Building2', 'Package', 'ShoppingCart', 'CreditCard',
  'MessageSquare', 'Send', 'UserPlus', 'UserCheck', 'Zap',
  'Rocket', 'Flag', 'Gift', 'ThumbsUp', 'Heart',
  'Eye', 'Bell', 'Search', 'Filter', 'Settings',
  'ArrowRight', 'ArrowLeft', 'CheckCircle', 'XCircle', 'AlertCircle',
  'Info', 'HelpCircle', 'Plus', 'Minus', 'Circle'
];

interface IconSelectorProps {
  selectedIcon: string;
  onIconSelect: (iconName: string) => void;
  disabled?: boolean;
}

export function IconSelector({ selectedIcon, onIconSelect, disabled }: IconSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filteredIcons = PIPELINE_ICONS.filter(iconName =>
    iconName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const SelectedIconComponent = LucideIcons[selectedIcon as keyof typeof LucideIcons] as LucideIcon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start gap-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#2a2a2a]`}
          disabled={disabled}
        >
          {SelectedIconComponent ? (
            <SelectedIconComponent className="h-4 w-4" />
          ) : (
            <LucideIcons.Circle className="h-4 w-4" />
          )}
          <span className="flex-1 text-left">{selectedIcon}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`w-80 p-0 border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`} align="start">
        <div className={`p-2 border-b border-gray-300 dark:border-gray-700`}>
          <Input
            placeholder="Pesquisar ícone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`h-9 bg-white dark:bg-[#0f0f0f] border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400`}
          />
        </div>
        <ScrollArea className="h-[300px]">
          <div className="grid grid-cols-6 gap-2 p-2">
            {filteredIcons.map((iconName) => {
              const IconComponent = LucideIcons[iconName as keyof typeof LucideIcons] as LucideIcon;
              if (!IconComponent) return null;

              return (
                <button
                  key={iconName}
                  onClick={() => {
                    onIconSelect(iconName);
                    setOpen(false);
                  }}
                  className={`
                    p-2 rounded hover:bg-accent dark:hover:bg-[#2a2a2a] transition-colors text-gray-900 dark:text-gray-100
                    ${selectedIcon === iconName ? 'bg-accent dark:bg-[#2a2a2a]' : ''}
                  `}
                  title={iconName}
                >
                  <IconComponent className="h-5 w-5" />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
