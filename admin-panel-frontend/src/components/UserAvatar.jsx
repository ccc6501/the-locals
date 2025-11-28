// admin-panel-frontend/src/components/UserAvatar.jsx
// User avatar component with initials and color

import React from 'react';

export const UserAvatar = ({ user, size = 'md', className = '' }) => {
    if (!user) return null;

    const sizeClasses = {
        xs: 'w-6 h-6 text-xs',
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-base',
        lg: 'w-12 h-12 text-lg',
        xl: 'w-16 h-16 text-xl'
    };

    const initials = user.initials || user.display_name?.slice(0, 2).toUpperCase() || user.name?.slice(0, 2).toUpperCase() || '??';
    const color = user.color || '#3B82F6';

    return (
        <div
            className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold text-white ${className}`}
            style={{ backgroundColor: color }}
            title={user.display_name || user.name || user.handle}
        >
            {user.avatar_url ? (
                <img
                    src={user.avatar_url}
                    alt={initials}
                    className="w-full h-full rounded-full object-cover"
                />
            ) : (
                initials
            )}
        </div>
    );
};
