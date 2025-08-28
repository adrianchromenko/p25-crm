import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export const usePermissions = () => {
  const { userProfile, isCoordinator, isAdmin, hasRole } = useAuth();

  const canViewAllUsers = isCoordinator || isAdmin;
  const canManageUsers = isAdmin;
  
  const canViewUserTasks = (userId?: string) => {
    if (!userProfile) return false;
    
    // Coordinators can see everyone's tasks
    if (isCoordinator) return true;
    
    // Regular users can only see their own tasks
    return !userId || userId === userProfile.id;
  };

  const canEditUserTasks = (userId?: string) => {
    if (!userProfile) return false;
    
    // Admins can edit anyone's tasks
    if (isAdmin) return true;
    
    // Users can only edit their own tasks
    return !userId || userId === userProfile.id;
  };

  const canViewUserCalendar = (userId?: string) => {
    if (!userProfile) return false;
    
    // Coordinators can see everyone's calendars
    if (isCoordinator) return true;
    
    // Regular users can only see their own calendar
    return !userId || userId === userProfile.id;
  };

  const canEditUserCalendar = (userId?: string) => {
    if (!userProfile) return false;
    
    // Admins can edit anyone's calendar
    if (isAdmin) return true;
    
    // Users can only edit their own calendar
    return !userId || userId === userProfile.id;
  };

  return {
    userProfile,
    isCoordinator,
    isAdmin,
    hasRole,
    canViewAllUsers,
    canManageUsers,
    canViewUserTasks,
    canEditUserTasks,
    canViewUserCalendar,
    canEditUserCalendar,
  };
};