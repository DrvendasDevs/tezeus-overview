import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ActiveUser {
  id: string;
  name: string;
  avatar?: string;
  dealCount: number;
  dealIds: string[];
}

interface ActiveUsersAvatarsProps {
  users: ActiveUser[];
  isLoading: boolean;
  maxVisible?: number;
  className?: string;
  selectedUserIds?: string[];
  onUserClick?: (userId: string) => void;
}

export function ActiveUsersAvatars({ 
  users, 
  isLoading, 
  maxVisible = 5, 
  className,
  selectedUserIds = [],
  onUserClick
}: ActiveUsersAvatarsProps) {
  // Generate initials from user name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  // Different colors for different users
  const getAvatarColor = (index: number) => {
    const colors = [
      "bg-blue-500 text-white",
      "bg-green-500 text-white",
      "bg-purple-500 text-white",
      "bg-orange-500 text-white",
      "bg-pink-500 text-white",
      "bg-indigo-500 text-white",
      "bg-red-500 text-white",
      "bg-teal-500 text-white",
    ];
    return colors[index % colors.length];
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center -space-x-2", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="w-8 h-8 rounded-full" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return null;
  }

  const visibleUsers = users.slice(0, maxVisible);
  const remainingCount = users.length - maxVisible;

  return (
    <TooltipProvider>
      <div className={cn("flex items-center -space-x-2", className)}>
        {visibleUsers.map((user, index) => {
          const isSelected = selectedUserIds.includes(user.id);
          
          return (
            <Tooltip key={user.id}>
              <TooltipTrigger asChild>
                <div 
                  className="relative"
                  onClick={() => onUserClick?.(user.id)}
                >
                  <Avatar className={cn(
                    "w-10 h-10 border-2 hover:z-10 transition-all cursor-pointer",
                    isSelected 
                      ? "border-primary ring-2 ring-primary ring-offset-2 scale-110" 
                      : "border-background hover:scale-110"
                  )}>
                    {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
                    <AvatarFallback className={cn(
                      "text-xs font-medium",
                      isSelected ? "opacity-100" : "opacity-90",
                      getAvatarColor(index)
                    )}>
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  {user.dealCount > 1 && (
                    <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium border border-background">
                      {user.dealCount}
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.dealCount} negócio{user.dealCount > 1 ? "s" : ""} ativo{user.dealCount > 1 ? "s" : ""}
                  </p>
                  {isSelected && (
                    <p className="text-xs text-primary font-medium mt-1">
                      ✓ Filtrado
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="w-8 h-8 border-2 border-background hover:z-10 transition-transform hover:scale-110 cursor-pointer">
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                  +{remainingCount}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                Mais {remainingCount} usuário{remainingCount > 1 ? "s" : ""} com negócios ativos
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
