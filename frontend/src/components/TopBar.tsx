import React from 'react';
import { Settings, User, Bell } from 'lucide-react';

export const TopBar: React.FC = () => {
  return (
    <header className="h-12 w-full flex items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur z-10 sticky top-0">
      <div className="flex items-center space-x-4">
        {/* Placeholder for breadcrumbs or title */}
        <span className="text-sm font-medium text-muted-foreground select-none">
          Personal CMS
        </span>
      </div>

      <div className="flex items-center space-x-2">
        <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Notifications">
            <Bell size={18} />
        </button>
        <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Settings">
            <Settings size={18} />
        </button>
        <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Profile">
          <User size={18} />
        </button>
      </div>
    </header>
  );
};
