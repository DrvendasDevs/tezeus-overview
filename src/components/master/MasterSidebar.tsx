import React, { useEffect, useState } from "react";
import { ChevronLeft, Building2, BarChart3, Search, UserCircle, BrainCircuit, ListOrdered, Settings2, Calendar, MoreVertical, LogOut, User, Moon, Sun, ScrollText, FlaskConical } from "lucide-react";
import logoEx from "@/assets/logo-ex.png";
import logoEnc from "@/assets/logo-enc.png";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { MeuPerfilModal } from "@/components/modals/MeuPerfilModal";
import { useAuth } from "@/hooks/useAuth";
import { useSystemCustomizationContext } from "@/contexts/SystemCustomizationContext";

export type MasterPage =
  | "workspaces"
  | "reports"
  | "busca-ids"
  | "usuarios"
  | "ds-agent"
  | "filas"
  | "configuracoes"
  | "google-agenda-config"
  | "auditoria"
  | "laboratorio";

interface MasterSidebarProps {
  activePage: MasterPage;
  onPageChange: (page: MasterPage) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
  userRole?: 'master' | 'support' | 'admin' | 'user';
}

const menuItems: Array<{
  id: MasterPage;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "workspaces", label: "Empresas", icon: <Building2 className="w-5 h-5" /> },
  { id: "reports", label: "Relatórios", icon: <BarChart3 className="w-5 h-5" /> },
  { id: "busca-ids", label: "Busca por IDs", icon: <Search className="w-5 h-5" /> },
  { id: "usuarios", label: "Usuários", icon: <UserCircle className="w-5 h-5" /> },
  { id: "ds-agent", label: "Agentes de IA", icon: <BrainCircuit className="w-5 h-5" /> },
  { id: "laboratorio", label: "Laboratório", icon: <FlaskConical className="w-5 h-5" /> },
  { id: "filas", label: "Filas", icon: <ListOrdered className="w-5 h-5" /> },
  { id: "auditoria", label: "Auditoria", icon: <ScrollText className="w-5 h-5" /> },
  { id: "configuracoes", label: "Configurações", icon: <Settings2 className="w-5 h-5" /> },
  { id: "google-agenda-config", label: "Google Agenda", icon: <Calendar className="w-5 h-5" /> },
];

// Abas permitidas para o perfil 'support' na Central Tezeus
const supportAllowedPages: MasterPage[] = ['workspaces', 'ds-agent', 'filas', 'laboratorio', 'auditoria'];

export function MasterSidebar({
  activePage,
  onPageChange,
  isCollapsed,
  onToggleCollapse,
  onLogout,
  userRole = 'master',
}: MasterSidebarProps) {
  const { user } = useAuth();
  const { customization } = useSystemCustomizationContext();
  
  // Filtrar menu items baseado no perfil do usuário
  const filteredMenuItems = userRole === 'support'
    ? menuItems.filter(item => supportAllowedPages.includes(item.id))
    : menuItems;

  const [isPerfilModalOpen, setIsPerfilModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const temporarilyDisableThemeTransitions = () => {
    const root = document.documentElement;
    root.classList.add("disable-theme-transitions");
    window.setTimeout(() => {
      root.classList.remove("disable-theme-transitions");
    }, 0);
  };

  useEffect(() => {
    const isDark =
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    temporarilyDisableThemeTransitions();
    setIsDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleDarkMode = (checked: boolean) => {
    temporarilyDisableThemeTransitions();
    setIsDarkMode(checked);
    document.documentElement.classList.toggle("dark", checked);
    localStorage.setItem("theme", checked ? "dark" : "light");
  };

  const renderMenuItem = (item: (typeof menuItems)[number]) => {
    const isActive = activePage === item.id;

    const menuButton = (
      <button
        key={item.id}
        onClick={() => onPageChange(item.id)}
        className={cn(
          "w-full flex items-center transition-all relative group outline-none",
          isCollapsed ? "justify-center p-2" : "gap-2 px-3 py-1.5",
          "text-sm font-medium rounded-none",
          isActive
            ? "bg-[#FEF3C7] text-black font-bold shadow-sm z-10"
            : "text-black hover:bg-[#e1e1e1] hover:z-10"
        )}
      >
        {React.cloneElement(item.icon as React.ReactElement, {
          className: cn(
            "transition-all duration-300",
            isCollapsed ? "w-4 h-4" : "w-3.5 h-3.5",
            "text-black"
          ),
        })}
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </button>
    );

    if (isCollapsed) {
      return (
        <TooltipProvider key={item.id}>
          <Tooltip>
            <TooltipTrigger asChild>{menuButton}</TooltipTrigger>
            <TooltipContent
              side="right"
              className="ml-2 text-xs bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-md"
            >
              <p>{item.label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return menuButton;
  };

  return (
    <div
      data-sidebar
      className={cn(
        "flex flex-col m-2 shadow-sm font-sans text-xs transition-all duration-300 ease-in-out relative",
        "bg-primary",
        isCollapsed ? "w-12" : "w-52"
      )}
    >
      {/* Title Bar (Logo) */}
      <div
        className={cn(
          "flex-shrink-0 flex items-center bg-primary text-primary-foreground transition-all duration-300 justify-center overflow-hidden",
          isCollapsed ? "h-20 p-2" : "h-36 p-4"
        )}
      >
        {customization.logo_url ? (
          <img
            src={customization.logo_url}
            alt="Logo"
            className="w-full h-full object-contain transition-all duration-300"
          />
        ) : (
          <img
            src={isCollapsed ? logoEnc : logoEx}
            alt="TEZEUS"
            className="w-full h-full object-contain transition-all duration-300"
          />
        )}
      </div>

      {/* Botão de colapso flutuante */}
      <button
        onClick={onToggleCollapse}
        className={cn(
          "absolute top-1/2 -right-3 transform -translate-y-1/2",
          "z-40 w-6 h-6 flex items-center justify-center",
          "bg-[#e85a0c] border border-[#e85a0c]",
          "rounded-full shadow-md hover:opacity-90 transition-all duration-200 group",
          isCollapsed && "rotate-180"
        )}
        style={{ animation: "pulse-subtle 4s ease-in-out infinite" }}
      >
        <style>{`
          @keyframes pulse-subtle {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}</style>
        <ChevronLeft className="w-4 h-4 text-white group-hover:scale-110 transition-all" />
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">{filteredMenuItems.map(renderMenuItem)}</nav>

      {/* Action Icons (tema) */}
      <div className={cn("flex-shrink-0 bg-primary", isCollapsed ? "p-1" : "p-2")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
          {!isCollapsed && (
            <div className="flex items-center px-1">
              <Switch
                checked={isDarkMode}
                onCheckedChange={toggleDarkMode}
                className="scale-75 border-0 data-[state=unchecked]:bg-[#b5bec9] data-[state=checked]:bg-[#3a3a3e]"
                thumbClassName="relative text-[12px] bg-[#4a4a4d] text-white data-[state=checked]:bg-[#f4f4f4] data-[state=checked]:text-[#2b2b2b] shadow-md"
                thumbContent={
                  isDarkMode ? (
                    <Sun className="h-3 w-3" strokeWidth={2} />
                  ) : (
                    <Moon className="h-3 w-3" strokeWidth={2} fill="white" />
                  )
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* User Info */}
      <div className={cn("flex-shrink-0 bg-primary", isCollapsed ? "p-1" : "p-2")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2")}>
          {isCollapsed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200">
                  <User className="w-4 h-4 text-black" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="z-50 bg-white border border-gray-300 shadow-md dark:bg-[#2d2d2d] dark:border-gray-600"
                side="right"
                align="end"
              >
                <DropdownMenuItem onClick={() => setIsPerfilModalOpen(true)} className="text-xs">
                  <User className="w-3 h-3 mr-2" />
                  Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogout} className="text-xs text-red-600 focus:text-red-600">
                  <LogOut className="w-3 h-3 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-black truncate">{user?.name}</div>
                <div className="text-[10px] text-black truncate">{user?.email}</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 hover:bg-gray-100 rounded text-black">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="z-50 bg-white border border-gray-300 shadow-md dark:bg-[#2d2d2d] dark:border-gray-600"
                  align="end"
                >
                  <DropdownMenuItem onClick={() => setIsPerfilModalOpen(true)} className="text-xs">
                    <User className="w-3 h-3 mr-2" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onLogout} className="text-xs text-red-600 focus:text-red-600">
                    <LogOut className="w-3 h-3 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      <MeuPerfilModal isOpen={isPerfilModalOpen} onClose={() => setIsPerfilModalOpen(false)} />
    </div>
  );
}


