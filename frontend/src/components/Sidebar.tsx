import React, { useState } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, Search, PlusCircle, Server } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  const [isRepositoriesOpen, setIsRepositoriesOpen] = useState(true);

  return (
    <aside className="w-64 h-full flex flex-col border-r border-border bg-muted/30">
      {/* Top section: Search / Actions */}
      <div className="px-3 pt-4 pb-2">
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-0 bottom-0 flex items-center inset-y-0 my-auto text-muted-foreground" size={16} />
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-muted border border-border rounded-md pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground placeholder:text-muted-foreground transition-all"
          />
        </div>
      </div>

      {/* Main tree view container */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {/* Admin Link (Temporary location for Phase 5) */}
        <Link to="/admin" className="flex items-center px-2 py-1.5 text-sm text-muted-foreground tree-item-hover rounded-md mb-4 group">
          <Server size={16} className="mr-2 group-hover:text-primary transition-colors" />
          <span>Admin Settings</span>
        </Link>

        {/* Repositories Tree Node */}
        <div>
          <button
            onClick={() => setIsRepositoriesOpen(!isRepositoriesOpen)}
            className="w-full flex items-center px-2 py-1.5 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
          >
            {isRepositoriesOpen ? <ChevronDown size={16} className="text-muted-foreground mr-1" /> : <ChevronRight size={16} className="text-muted-foreground mr-1" />}
            <span className="font-semibold select-none uppercase text-xs tracking-wider text-muted-foreground">Repositories</span>
          </button>

          {isRepositoriesOpen && (
            <div className="ml-4 mt-1 space-y-[1px] border-l border-border pl-2">
                {/* Placeholder repository 1 */}
                <div className="flex flex-col">
                  <div className="flex items-center px-2 py-1 text-sm text-foreground tree-item-hover rounded-md">
                     <Folder size={16} className="text-primary mr-2" />
                     <span className="truncate">Knowledge Base</span>
                  </div>
                  {/* Nested files/folders placeholder */}
                  <div className="ml-6 space-y-[1px] border-l border-border pl-2">
                      <div className="flex items-center px-2 py-1 text-sm text-muted-foreground tree-item-hover rounded-md">
                        <FileText size={16} className="mr-2" />
                        <span className="truncate">React Patterns.md</span>
                      </div>
                      <div className="flex items-center px-2 py-1 text-sm text-foreground tree-item-active rounded-md">
                        <FileText size={16} className="text-primary mr-2" />
                        <span className="truncate">API Design.md</span>
                      </div>
                  </div>
                </div>

                {/* Placeholder repository 2 */}
                <div className="flex items-center px-2 py-1 text-sm text-muted-foreground tree-item-hover rounded-md opacity-70">
                   <Folder size={16} className="mr-2" />
                   <span className="truncate">Journal</span>
                </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-3 border-t border-border mt-auto">
        <button className="w-full flex items-center justify-center p-2 rounded-md bg-accent hover:bg-primary text-foreground transition-colors text-sm font-medium border border-border">
          <PlusCircle size={16} className="mr-2" />
          New Note
        </button>
      </div>
    </aside>
  );
};
