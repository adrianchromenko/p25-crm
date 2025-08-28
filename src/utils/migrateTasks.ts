import { collection, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

export const migrateTasks = async (currentUserId: string) => {
  try {
    console.log('Starting task migration...');
    
    // Get all tasks
    const tasksSnapshot = await getDocs(collection(db, 'tasks'));
    const batch = writeBatch(db);
    let migratedCount = 0;
    
    tasksSnapshot.forEach((taskDoc) => {
      const taskData = taskDoc.data();
      
      // Check if task already has userId
      if (!taskData.userId) {
        // Add userId to tasks that don't have it
        const taskRef = doc(db, 'tasks', taskDoc.id);
        batch.update(taskRef, {
          userId: currentUserId,
          updatedAt: new Date()
        });
        migratedCount++;
      }
    });
    
    if (migratedCount > 0) {
      await batch.commit();
      console.log(`Successfully migrated ${migratedCount} tasks to user ${currentUserId}`);
    } else {
      console.log('No tasks needed migration');
    }
    
    return migratedCount;
  } catch (error) {
    console.error('Error migrating tasks:', error);
    throw error;
  }
};

export const migrateCalendarEvents = async (currentUserId: string) => {
  try {
    console.log('Starting calendar events migration...');
    
    // Get all calendar events
    const eventsSnapshot = await getDocs(collection(db, 'calendar_events'));
    const batch = writeBatch(db);
    let migratedCount = 0;
    
    eventsSnapshot.forEach((eventDoc) => {
      const eventData = eventDoc.data();
      
      // Check if event already has userId
      if (!eventData.userId) {
        // Add userId to events that don't have it
        const eventRef = doc(db, 'calendar_events', eventDoc.id);
        batch.update(eventRef, {
          userId: currentUserId,
          updatedAt: new Date()
        });
        migratedCount++;
      }
    });
    
    if (migratedCount > 0) {
      await batch.commit();
      console.log(`Successfully migrated ${migratedCount} calendar events to user ${currentUserId}`);
    } else {
      console.log('No calendar events needed migration');
    }
    
    return migratedCount;
  } catch (error) {
    console.error('Error migrating calendar events:', error);
    throw error;
  }
};