from backend.database import execute_query, execute_update

def create_notification(user_id, title, message, notif_type='info'):
    """Inserts a notification record for a specific user."""
    query = """
        INSERT INTO notifications (user_id, title, message, type, is_read) 
        VALUES (%s, %s, %s, %s, 0)
    """
    return execute_update(query, (user_id, title, message, notif_type))

def get_user_notifications(user_id):
    """Retrieves all notifications for a specific user, ordered by creation date."""
    query = """
        SELECT id, title, message, type, is_read, created_at 
        FROM notifications 
        WHERE user_id = %s 
        ORDER BY created_at DESC
    """
    return execute_query(query, (user_id,))

def mark_notification_as_read(notification_id, user_id):
    """Marks a notification as read if it belongs to the user."""
    query = """
        UPDATE notifications 
        SET is_read = 1 
        WHERE id = %s AND user_id = %s
    """
    return execute_update(query, (notification_id, user_id))

def mark_all_notifications_as_read(user_id):
    """Marks all notifications for a user as read."""
    query = """
        UPDATE notifications 
        SET is_read = 1 
        WHERE user_id = %s
    """
    return execute_update(query, (user_id,))
