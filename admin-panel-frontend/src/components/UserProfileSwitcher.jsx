// admin-panel-frontend/src/components/UserProfileSwitcher.jsx
// User profile switcher for multi-user accounts

import React, { useState } from 'react';
import { UserAvatar } from './UserAvatar';
import { ChevronDown, Plus } from 'lucide-react';

export const UserProfileSwitcher = ({ users, currentUser, onUserSelect, onCreateProfile }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!currentUser) return null;

    return (
        <div className="relative">
            {/* Current User Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-600"
            >
                <UserAvatar user={currentUser} size="sm" />
                <div className="text-left min-w-0">
                    <div className="text-white text-sm font-medium truncate">
                        {currentUser.display_name || currentUser.name}
                    </div>
                    <div className="text-slate-400 text-xs truncate">
                        {currentUser.handle}
                    </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20">
                        <div className="p-2 space-y-1">
                            {/* User List */}
                            {users.map((user) => (
                                <button
                                    key={user.id}
                                    onClick={() => {
                                        onUserSelect(user);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${user.id === currentUser.id
                                            ? 'bg-violet-600 text-white'
                                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                        }`}
                                >
                                    <UserAvatar user={user} size="sm" />
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="font-medium truncate">
                                            {user.display_name || user.name}
                                        </div>
                                        <div className="text-xs opacity-70 truncate">
                                            {user.handle}
                                        </div>
                                    </div>
                                    {user.role === 'child' && (
                                        <div className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                                            Child
                                        </div>
                                    )}
                                </button>
                            ))}

                            {/* Create Profile Button */}
                            {onCreateProfile && (
                                <>
                                    <div className="border-t border-slate-600 my-2" />
                                    <button
                                        onClick={() => {
                                            onCreateProfile();
                                            setIsOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-violet-400 hover:bg-slate-700 rounded-lg transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-violet-400 flex items-center justify-center">
                                            <Plus className="w-4 h-4" />
                                        </div>
                                        <span className="font-medium">Add Profile</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
